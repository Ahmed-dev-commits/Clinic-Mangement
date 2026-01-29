// Hospital Management System Types

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  address: string;
  visitDate: string;
  symptoms: string;
  createdAt: string;
  registeredBy?: string;
  registeredByRole?: string;
}

export interface PaymentMedicine {
  stockId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Payment {
  id: string;
  patientId: string;
  patientName: string;
  consultationFee: number;
  labFee: number;
  medicineFee: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'Card';
  createdAt: string;
  medicines: PaymentMedicine[];
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  lowStockThreshold: number;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  labTests: string[];
  doctorNotes: string;
  precautions: string;
  generatedText: string;
  followUpDate: string;
  createdAt: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface LabTestResult {
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'Normal' | 'High' | 'Low' | 'Critical';
}

export type LabResultStatus = 'Sample Collected' | 'Processing' | 'Ready' | 'Notified' | 'Collected';

export interface LabResult {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  testDate: string;
  reportDate: string;
  tests: LabTestResult[];
  notes: string;
  technician: string;
  status: LabResultStatus;
  notifiedAt?: string;
  collectedAt?: string;
  createdAt: string;
}

export interface DailyExpense {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: 'Cash' | 'Card' | 'Online' | 'Other';
  createdBy: string;
  createdAt: string;
}
