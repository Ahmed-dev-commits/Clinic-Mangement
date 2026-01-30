import { useState, useEffect, useCallback } from 'react';
import { patientsApi, PatientDTO } from '@/services/accessApi';
import { supabasePatientsApi, PatientRow } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { Patient } from '@/types/hospital';

// Demo patients for testing when backend is unavailable
const DEMO_PATIENTS: Patient[] = [
  {
    id: 'PAT-DEMO001',
    name: 'John Smith',
    age: 45,
    gender: 'Male',
    phone: '03001234567',
    address: '123 Main Street',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: 'Fever, headache',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'PAT-DEMO002',
    name: 'Sarah Johnson',
    age: 32,
    gender: 'Female',
    phone: '03009876543',
    address: '456 Oak Avenue',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: 'Cough, cold',
    createdAt: new Date().toISOString(),
  },
];

// Get demo patients from localStorage or use defaults
function getDemoPatients(): Patient[] {
  try {
    const stored = localStorage.getItem('demo-patients');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Failed to parse demo patients');
  }
  return [...DEMO_PATIENTS];
}

// Save demo patients to localStorage
function saveDemoPatients(patients: Patient[]) {
  localStorage.setItem('demo-patients', JSON.stringify(patients));
}

// Convert API DTO to local Patient type
function dtoToPatient(dto: PatientDTO): Patient {
  return {
    id: dto.ID,
    name: dto.Name,
    age: dto.Age,
    gender: dto.Gender as 'Male' | 'Female' | 'Other',
    phone: dto.Phone,
    address: dto.Address,
    visitDate: dto.VisitDate,
    symptoms: dto.Symptoms,
    createdAt: dto.CreatedAt,
    registeredBy: dto.CreatedBy,
    registeredByRole: dto.CreatedByRole,
  };
}

// Convert Supabase row to local Patient type
function rowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age || 0,
    gender: (row.gender as 'Male' | 'Female' | 'Other') || 'Other',
    phone: row.phone || '',
    address: row.address || '',
    visitDate: row.visit_date || '',
    symptoms: row.symptoms || '',
    createdAt: row.created_at || new Date().toISOString(),
    registeredBy: row.registered_by || undefined,
    registeredByRole: row.registered_by_role || undefined,
  };
}

export function useAccessPatients(createdTodayOnly = false) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if running in cloud environment
      if (isCloudEnvironment()) {
        setIsCloud(true);
        // Note: Supabase implementation pending filtering update
        const data = await supabasePatientsApi.getAll();
        setPatients(data.map(rowToPatient));
        setTotal(data.length);
        setTotalPages(1);
        setIsDemoMode(false);
      } else {
        // Try local SQLite backend
        setIsCloud(false);
        try {
          const response = await patientsApi.getAll({ page, limit, search, createdToday: createdTodayOnly });
          // Check if response has data/meta structure (new backend) or array (old/fallback)
          if ('data' in response && 'meta' in response) {
            setPatients(response.data.map(dtoToPatient));
            setTotal(response.meta.total);
            setTotalPages(response.meta.totalPages);
          } else if (Array.isArray(response)) {
            // Fallback if backend is old
            const allPatients = (response as PatientDTO[]).map(dtoToPatient);

            // Client side filter fallback
            let filtered = allPatients;
            if (createdTodayOnly) {
              const today = new Date().toISOString().split('T')[0];
              filtered = allPatients.filter(p => p.createdAt && p.createdAt.startsWith(today));
            }

            setPatients(filtered);
            setTotal(filtered.length);
            setTotalPages(1);
          }
          setIsDemoMode(false);
        } catch {
          // Fallback to demo mode
          console.log('Backend unavailable, using demo mode for patients');
          const allDemo = getDemoPatients();
          // Implement client-side search/pagination for demo
          let filtered = allDemo;

          if (createdTodayOnly) {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(p => p.createdAt && p.createdAt.startsWith(today));
          }

          if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter(p =>
              p.name.toLowerCase().includes(lowerSearch) ||
              p.id.toLowerCase().includes(lowerSearch) ||
              p.phone.includes(lowerSearch)
            );
          }
          setTotal(filtered.length);
          setTotalPages(Math.ceil(filtered.length / limit));

          const start = (page - 1) * limit;
          setPatients(filtered.slice(start, start + limit));

          setIsDemoMode(true);
        }
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setPatients(getDemoPatients());
      setIsDemoMode(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, createdTodayOnly]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt'>) => {
    const id = `PAT-${Date.now().toString(36).toUpperCase()}`;

    if (isCloud) {
      // ... (Supabase impl)
      await supabasePatientsApi.create({
        id,
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
        phone: patientData.phone,
        address: patientData.address,
        visit_date: patientData.visitDate,
        symptoms: patientData.symptoms,
        registered_by: patientData.registeredBy || null,
        registered_by_role: patientData.registeredByRole || null,
      });
      await fetchPatients();
      return id;
    }

    if (isDemoMode) {
      // Demo mode - use local storage
      const newPatient: Patient = {
        ...patientData,
        id,
        createdAt: new Date().toISOString(),
      };
      const allPatients = getDemoPatients();
      const updatedPatients = [...allPatients, newPatient];
      saveDemoPatients(updatedPatients);
      // setPatients updated by fetchPatients refetch or manual update
      // Logic for manual update complexity with pagination: just refetch or update if on page 1?
      // Simpler to refetch.
      fetchPatients();
      return id;
    }

    // SQLite backend
    try {
      await patientsApi.create({
        ID: id,
        Name: patientData.name,
        Age: patientData.age,
        Gender: patientData.gender,
        Phone: patientData.phone,
        Address: patientData.address,
        VisitDate: patientData.visitDate,
        Symptoms: patientData.symptoms,
        CreatedBy: patientData.registeredBy,
        CreatedByRole: patientData.registeredByRole,
      });
      await fetchPatients();
      return id;
    } catch {
      // Fallback logic...
      // Keep existing logic but trigger fetch
      console.log('Backend unavailable, adding patient in demo mode');
      const newPatient: Patient = {
        ...patientData,
        id,
        createdAt: new Date().toISOString(),
      };
      const allPatients = getDemoPatients();
      const updatedPatients = [...allPatients, newPatient];
      saveDemoPatients(updatedPatients);
      setIsDemoMode(true);
      fetchPatients();
      return id;
    }
  };

  const updatePatient = async (id: string, patientData: Partial<Patient>) => {
    // ... existing update logic ...
    // Simplified: Just refetch after update to ensure list is correct
    if (isCloud) {
      await supabasePatientsApi.update(id, {
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
        phone: patientData.phone,
        address: patientData.address,
        visit_date: patientData.visitDate,
        symptoms: patientData.symptoms,
      });
      await fetchPatients();
      return;
    }

    if (isDemoMode) {
      const allPatients = getDemoPatients();
      const updatedPatients = allPatients.map(p =>
        p.id === id ? { ...p, ...patientData } : p
      );
      saveDemoPatients(updatedPatients);
      fetchPatients();
      return;
    }

    try {
      await patientsApi.update(id, {
        Name: patientData.name,
        Age: patientData.age,
        Gender: patientData.gender,
        Phone: patientData.phone,
        Address: patientData.address,
        VisitDate: patientData.visitDate,
        Symptoms: patientData.symptoms,
      });
      await fetchPatients();
    } catch {
      // ... fallback
      console.log('Backend unavailable, updating patient in demo mode');
      const allPatients = getDemoPatients();
      const updatedPatients = allPatients.map(p =>
        p.id === id ? { ...p, ...patientData } : p
      );
      saveDemoPatients(updatedPatients);
      setIsDemoMode(true);
      fetchPatients();
    }
  };

  const deletePatient = async (id: string) => {
    if (isCloud) {
      await supabasePatientsApi.delete(id);
      await fetchPatients();
      return;
    }

    if (isDemoMode) {
      const allPatients = getDemoPatients();
      const updatedPatients = allPatients.filter(p => p.id !== id);
      saveDemoPatients(updatedPatients);
      fetchPatients();
      return;
    }

    try {
      await patientsApi.delete(id);
      await fetchPatients();
    } catch {
      // ...
      console.log('Backend unavailable, deleting patient in demo mode');
      const allPatients = getDemoPatients();
      const updatedPatients = allPatients.filter(p => p.id !== id);
      saveDemoPatients(updatedPatients);
      setIsDemoMode(true);
      fetchPatients();
    }
  };

  return {
    patients,
    loading,
    error,
    isDemoMode,
    isCloud,
    addPatient,
    updatePatient,
    deletePatient,
    refetch: fetchPatients,
    // Pagination props
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    total,
    totalPages
  };
}
