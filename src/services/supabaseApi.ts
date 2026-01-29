/**
 * Supabase API Service for Lovable Cloud
 * Used when running in the cloud preview environment
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// ============ PATIENTS API ============

export interface PatientRow {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  visit_date: string | null;
  symptoms: string | null;
  created_at: string | null;
  registered_by: string | null;
  registered_by_role: string | null;
}

export const supabasePatientsApi = {
  getAll: async (): Promise<PatientRow[]> => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  getById: async (id: string): Promise<PatientRow | null> => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data;
  },

  create: async (patient: Omit<PatientRow, 'created_at'>): Promise<string> => {
    const { error } = await supabase
      .from('patients')
      .insert([patient]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return patient.id;
  },

  update: async (id: string, patient: Partial<PatientRow>): Promise<void> => {
    const { error } = await supabase
      .from('patients')
      .update(patient)
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },
};

// ============ STOCK API ============

export interface StockRow {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  price: number | null;
  low_stock_threshold: number | null;
  created_at: string | null;
}

export const supabaseStockApi = {
  getAll: async (): Promise<StockRow[]> => {
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .order('name');
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  create: async (item: Omit<StockRow, 'created_at'>): Promise<string> => {
    const { error } = await supabase
      .from('stock')
      .insert([item]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return item.id;
  },

  update: async (id: string, item: Partial<StockRow>): Promise<void> => {
    const { error } = await supabase
      .from('stock')
      .update(item)
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },
};

// ============ PAYMENTS API ============

export interface PaymentRow {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  consultation_fee: number | null;
  lab_fee: number | null;
  medicine_fee: number | null;
  total_amount: number | null;
  payment_mode: string | null;
  medicines: Json;
  created_at: string | null;
}

export const supabasePaymentsApi = {
  getAll: async (): Promise<PaymentRow[]> => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  create: async (payment: Omit<PaymentRow, 'created_at'>): Promise<string> => {
    const { error } = await supabase
      .from('payments')
      .insert([payment]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return payment.id;
  },
};

// ============ PRESCRIPTIONS API ============

export interface PrescriptionRow {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_age: number | null;
  diagnosis: string | null;
  medicines: Json;
  lab_tests: Json;
  doctor_notes: string | null;
  precautions: string | null;
  generated_text: string | null;
  follow_up_date: string | null;
  created_at: string | null;
}

export const supabasePrescriptionsApi = {
  getAll: async (): Promise<PrescriptionRow[]> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  create: async (prescription: Omit<PrescriptionRow, 'created_at'>): Promise<string> => {
    const { error } = await supabase
      .from('prescriptions')
      .insert([prescription]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return prescription.id;
  },
};

// ============ LAB RESULTS API ============

export interface LabResultRow {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_age: number | null;
  test_date: string | null;
  report_date: string | null;
  tests: Json;
  notes: string | null;
  technician: string | null;
  status: string | null;
  notified_at: string | null;
  collected_at: string | null;
  created_at: string | null;
}

export const supabaseLabResultsApi = {
  getAll: async (): Promise<LabResultRow[]> => {
    const { data, error } = await supabase
      .from('lab_results')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  create: async (labResult: Omit<LabResultRow, 'created_at'>): Promise<string> => {
    const { error } = await supabase
      .from('lab_results')
      .insert([labResult]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return labResult.id;
  },

  updateStatus: async (id: string, status: string, notifiedAt?: string, collectedAt?: string): Promise<void> => {
    const updateData: { status: string; notified_at?: string; collected_at?: string } = { status };
    if (notifiedAt) updateData.notified_at = notifiedAt;
    if (collectedAt) updateData.collected_at = collectedAt;

    const { error } = await supabase
      .from('lab_results')
      .update(updateData)
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },
};

// ============ PATIENT SERVICES API ============

export interface PatientServicesRow {
  id: string;
  patient_id: string;
  services: Json;
  grand_total: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const supabasePatientServicesApi = {
  getAll: async (): Promise<PatientServicesRow[]> => {
    const { data, error } = await supabase
      .from('patient_services')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  getByPatientId: async (patientId: string): Promise<PatientServicesRow[]> => {
    const { data, error } = await supabase
      .from('patient_services')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data || [];
  },

  create: async (service: { id: string; patient_id: string; services: Json; grand_total: number; status: string }): Promise<string> => {
    const { error } = await supabase
      .from('patient_services')
      .insert([service]);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return service.id;
  },

  update: async (id: string, service: { services?: Json; grand_total?: number; status?: string }): Promise<void> => {
    const { error } = await supabase
      .from('patient_services')
      .update({ ...service, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
  },
};

// ============ USERS API ============

export interface UserRow {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export const supabaseUsersApi = {
  getAll: async (): Promise<UserRow[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, name, role, is_active, created_at');
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return (data || []) as UserRow[];
  },

  login: async (username: string, password: string): Promise<UserRow | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      toast.error(`Database Error: ${error.message}`);
      throw error;
    }
    return data;
  },
};

// ============ HEALTH CHECK ============

export const supabaseHealthCheck = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};
