-- Patients table
CREATE TABLE public.patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone TEXT,
  address TEXT,
  visit_date TEXT,
  symptoms TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock/Inventory table
CREATE TABLE public.stock (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  lab_fee DECIMAL(10,2) DEFAULT 0,
  medicine_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode TEXT,
  medicines JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  patient_age INTEGER,
  diagnosis TEXT,
  medicines JSONB,
  lab_tests JSONB,
  doctor_notes TEXT,
  precautions TEXT,
  generated_text TEXT,
  follow_up_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lab Results table
CREATE TABLE public.lab_results (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  patient_age INTEGER,
  test_date TEXT,
  report_date TEXT,
  tests JSONB,
  notes TEXT,
  technician TEXT,
  status TEXT DEFAULT 'Sample Collected',
  notified_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Patient Services table
CREATE TABLE public.patient_services (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  services JSONB,
  grand_total DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users table for role management
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Receptionist',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a hospital management system accessed by staff)
CREATE POLICY "Allow all access to patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to stock" ON public.stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to prescriptions" ON public.prescriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to lab_results" ON public.lab_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to patient_services" ON public.patient_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Insert default users
INSERT INTO public.users (id, username, password, name, role) VALUES
  ('USR-001', 'receptionist', 'reception123', 'Front Desk', 'Receptionist'),
  ('USR-002', 'doctor', 'doctor123', 'Dr. Admin', 'Doctor'),
  ('USR-003', 'labtech', 'lab123', 'Lab Technician', 'LabTechnician'),
  ('USR-004', 'admin', 'admin123', 'Administrator', 'Admin');
