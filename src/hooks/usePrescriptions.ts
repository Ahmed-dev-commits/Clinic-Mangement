import { useState, useEffect, useCallback } from 'react';
import { prescriptionsApi, PrescriptionDTO } from '@/services/accessApi';
import { supabasePrescriptionsApi, PrescriptionRow } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { Prescription, PrescriptionMedicine } from '@/types/hospital';
import type { Json } from '@/integrations/supabase/types';

// Get demo prescriptions from localStorage
function getDemoPrescriptions(): Prescription[] {
  try {
    const stored = localStorage.getItem('demo-prescriptions');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Failed to parse demo prescriptions');
  }
  return [];
}

// Save demo prescriptions to localStorage
function saveDemoPrescriptions(prescriptions: Prescription[]) {
  localStorage.setItem('demo-prescriptions', JSON.stringify(prescriptions));
}

// Convert API DTO to local type
function dtoToPrescription(dto: PrescriptionDTO): Prescription {
  return {
    id: dto.ID,
    patientId: dto.PatientID,
    patientName: dto.PatientName,
    patientAge: dto.PatientAge,
    diagnosis: dto.Diagnosis,
    medicines: typeof dto.Medicines === 'string' ? JSON.parse(dto.Medicines) : [],
    labTests: typeof dto.LabTests === 'string' ? JSON.parse(dto.LabTests) : [],
    doctorNotes: dto.DoctorNotes,
    precautions: dto.Precautions,
    generatedText: dto.GeneratedText,
    followUpDate: dto.FollowUpDate,
    createdAt: dto.CreatedAt,
    status: dto.Status,
  };
}

// Convert Supabase row to local type
function rowToPrescription(row: PrescriptionRow): Prescription {
  return {
    id: row.id,
    patientId: row.patient_id || '',
    patientName: row.patient_name || '',
    patientAge: row.patient_age || 0,
    diagnosis: row.diagnosis || '',
    medicines: Array.isArray(row.medicines) ? row.medicines as unknown as PrescriptionMedicine[] : [],
    labTests: Array.isArray(row.lab_tests) ? row.lab_tests as unknown as string[] : [],
    doctorNotes: row.doctor_notes || '',
    precautions: row.precautions || '',
    generatedText: row.generated_text || '',
    followUpDate: row.follow_up_date || '',
    createdAt: row.created_at || new Date().toISOString(),
    // Supabase row might not have status yet, default to finalized for now or update supabase types later
    status: 'Finalized',
  };
}

// Generate unique ID
const generateId = (prefix: string) => {
  const num = Math.floor(Math.random() * 9000) + 1000;
  const suffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `${prefix}-${num}${suffix}`;
};

export function usePrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);

      if (isCloudEnvironment()) {
        setIsCloud(true);
        const data = await supabasePrescriptionsApi.getAll();
        setPrescriptions(data.map(rowToPrescription));
        setIsDemoMode(false);
      } else {
        setIsCloud(false);
        try {
          const data = await prescriptionsApi.getAll();
          setPrescriptions(data.map(dtoToPrescription));
          setIsDemoMode(false);
        } catch {
          console.log('Backend unavailable, using demo mode for prescriptions');
          setPrescriptions(getDemoPrescriptions());
          setIsDemoMode(true);
        }
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      setPrescriptions(getDemoPrescriptions());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const addPrescription = async (prescriptionData: Omit<Prescription, 'id' | 'createdAt'>) => {
    const id = generateId('RX');

    if (isCloud) {
      await supabasePrescriptionsApi.create({
        id,
        patient_id: prescriptionData.patientId,
        patient_name: prescriptionData.patientName,
        patient_age: prescriptionData.patientAge,
        diagnosis: prescriptionData.diagnosis,
        medicines: prescriptionData.medicines as unknown as Json,
        lab_tests: prescriptionData.labTests as unknown as Json,
        doctor_notes: prescriptionData.doctorNotes,
        precautions: prescriptionData.precautions,
        generated_text: prescriptionData.generatedText,
        follow_up_date: prescriptionData.followUpDate,
        // status: prescriptionData.status // Supabase schema update pending
      });
      await fetchPrescriptions();
      return id;
    }

    if (isDemoMode) {
      const newPrescription: Prescription = { ...prescriptionData, id, createdAt: new Date().toISOString() };
      const updated = [...prescriptions, newPrescription];
      setPrescriptions(updated);
      saveDemoPrescriptions(updated);
      return id;
    }

    try {
      await prescriptionsApi.create({
        id,
        patientId: prescriptionData.patientId,
        patientName: prescriptionData.patientName,
        patientAge: prescriptionData.patientAge,
        diagnosis: prescriptionData.diagnosis,
        medicines: prescriptionData.medicines,
        labTests: prescriptionData.labTests,
        doctorNotes: prescriptionData.doctorNotes,
        precautions: prescriptionData.precautions,
        generatedText: prescriptionData.generatedText,
        followUpDate: prescriptionData.followUpDate,
        status: prescriptionData.status || 'Finalized',
      });
      await fetchPrescriptions();
      return id;
    } catch {
      const newPrescription: Prescription = { ...prescriptionData, id, createdAt: new Date().toISOString() };
      const updated = [...prescriptions, newPrescription];
      setPrescriptions(updated);
      saveDemoPrescriptions(updated);
      setIsDemoMode(true);
      return id;
    }
  };

  const updatePrescription = async (id: string, prescriptionData: Omit<Prescription, 'id' | 'createdAt'>) => {
    if (isCloud) {
      // Cloud update pending implementation
      return;
    }

    if (isDemoMode) {
      const updated = prescriptions.map(p =>
        p.id === id ? { ...p, ...prescriptionData } : p
      );
      setPrescriptions(updated);
      saveDemoPrescriptions(updated);
      return;
    }

    try {
      await prescriptionsApi.update(id, {
        patientId: prescriptionData.patientId,
        patientName: prescriptionData.patientName,
        patientAge: prescriptionData.patientAge,
        diagnosis: prescriptionData.diagnosis,
        medicines: prescriptionData.medicines,
        labTests: prescriptionData.labTests,
        doctorNotes: prescriptionData.doctorNotes,
        precautions: prescriptionData.precautions,
        generatedText: prescriptionData.generatedText,
        followUpDate: prescriptionData.followUpDate,
        status: prescriptionData.status || 'Finalized',
      });
      await fetchPrescriptions();
    } catch (err) {
      // Fallback to demo mode if backend fails
      console.error('Update failed', err);
    }
  };

  const getPatientPrescriptions = (patientId: string) => prescriptions.filter(p => p.patientId === patientId);

  return {
    prescriptions,
    loading,
    isDemoMode,
    isCloud,
    addPrescription,
    updatePrescription,
    getPatientPrescriptions,
    refetch: fetchPrescriptions,
  };
}
