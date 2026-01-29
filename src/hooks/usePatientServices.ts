import { useState, useEffect, useCallback } from 'react';
import { patientServicesApi, PatientServicesDTO } from '@/services/accessApi';
import { supabasePatientServicesApi, PatientServicesRow } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { ServicesState, PatientServices } from '@/types/services';
import type { Json } from '@/integrations/supabase/types';

// Get demo services from localStorage
function getDemoServices(): PatientServices[] {
  try {
    const stored = localStorage.getItem('demo-services');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Failed to parse demo services');
  }
  return [];
}

// Save demo services to localStorage
function saveDemoServices(services: PatientServices[]) {
  localStorage.setItem('demo-services', JSON.stringify(services));
}

// Convert API DTO to local type
function dtoToPatientServices(dto: PatientServicesDTO | any): PatientServices {
  return {
    id: dto.ID || dto.id || '',
    patientId: dto.PatientID || dto.patientId || '',
    services: dto.Services || dto.services || '{}',
    grandTotal: dto.GrandTotal || dto.grandTotal || 0,
    status: (dto.Status || dto.status || 'Draft') as 'Draft' | 'Completed',
    createdAt: dto.CreatedAt || dto.createdAt || new Date().toISOString(),
    updatedAt: dto.UpdatedAt || dto.updatedAt || new Date().toISOString(),
  };
}

// Convert Supabase row to local type
function rowToPatientServices(row: PatientServicesRow): PatientServices {
  return {
    id: row.id,
    patientId: row.patient_id,
    services: typeof row.services === 'string' ? row.services : JSON.stringify(row.services),
    grandTotal: row.grand_total || 0,
    status: (row.status as 'Draft' | 'Completed') || 'Draft',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function usePatientServices() {
  const [services, setServices] = useState<PatientServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);

      if (isCloudEnvironment()) {
        setIsCloud(true);
        const data = await supabasePatientServicesApi.getAll();
        setServices(data.map(rowToPatientServices));
        setIsDemoMode(false);
      } else {
        setIsCloud(false);
        try {
          const data = await patientServicesApi.getAll();
          setServices(data.map(dtoToPatientServices));
          setIsDemoMode(false);
        } catch {
          console.log('Backend unavailable, using demo mode for services');
          setServices(getDemoServices());
          setIsDemoMode(true);
        }
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setServices(getDemoServices());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const addService = async (
    patientId: string,
    servicesState: ServicesState,
    grandTotal: number
  ): Promise<string> => {
    const id = `SRV-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const newService: PatientServices = {
      id,
      patientId,
      services: JSON.stringify(servicesState),
      grandTotal,
      status: 'Completed',
      createdAt: now,
      updatedAt: now,
    };

    if (isCloud) {
      await supabasePatientServicesApi.create({
        id,
        patient_id: patientId,
        services: servicesState as unknown as Json,
        grand_total: grandTotal,
        status: 'Completed',
      });
      await fetchServices();
      return id;
    }

    if (isDemoMode) {
      const updatedServices = [...services, newService];
      setServices(updatedServices);
      saveDemoServices(updatedServices);
      return id;
    }

    try {
      await patientServicesApi.create({
        id,
        patientId,
        services: servicesState,
        grandTotal,
        status: 'Completed',
      });
      await fetchServices();
      return id;
    } catch {
      console.log('Backend unavailable, saving service in demo mode');
      const updatedServices = [...services, newService];
      setServices(updatedServices);
      saveDemoServices(updatedServices);
      setIsDemoMode(true);
      return id;
    }
  };

  const getServicesByPatientId = (patientId: string): PatientServices[] => {
    return services.filter(s => s.patientId === patientId);
  };

  return {
    services,
    loading,
    isDemoMode,
    isCloud,
    addService,
    getServicesByPatientId,
    refetch: fetchServices,
  };
}
