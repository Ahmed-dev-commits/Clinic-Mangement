import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Patient, Payment, StockItem, Prescription, LabResult, LabResultStatus } from '@/types/hospital';

// Helper to generate unique IDs - shorter format
const generateId = (prefix: string) => {
  const num = Math.floor(Math.random() * 9000) + 1000; // 4-digit number
  const suffix = Math.random().toString(36).substr(2, 3).toUpperCase(); // 3-char suffix
  return `${prefix}-${num}${suffix}`;
};

// Sample data for initial state
const samplePatients: Patient[] = [
  {
    id: 'PAT-001',
    name: 'Ahmed Khan',
    age: 32,
    gender: 'Male',
    phone: '03001234567',
    address: '123 Main Street, Karachi',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: 'Fever, headache, body aches',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'PAT-002',
    name: 'Fatima Ali',
    age: 28,
    gender: 'Female',
    phone: '03009876543',
    address: '456 Garden Road, Lahore',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: 'Cough, sore throat',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'PAT-003',
    name: 'Muhammad Rizwan',
    age: 45,
    gender: 'Male',
    phone: '03211234567',
    address: '789 Hospital Lane, Islamabad',
    visitDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    symptoms: 'Diabetes checkup, fatigue',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const sampleStock: StockItem[] = [
  { id: 'STK-001', name: 'Paracetamol 500mg', category: 'Tablet', quantity: 500, price: 10, lowStockThreshold: 50, createdAt: new Date().toISOString() },
  { id: 'STK-002', name: 'Amoxicillin 250mg', category: 'Capsule', quantity: 200, price: 25, lowStockThreshold: 30, createdAt: new Date().toISOString() },
  { id: 'STK-003', name: 'Cough Syrup', category: 'Syrup', quantity: 15, price: 150, lowStockThreshold: 20, createdAt: new Date().toISOString() },
  { id: 'STK-004', name: 'Vitamin C 1000mg', category: 'Tablet', quantity: 300, price: 15, lowStockThreshold: 40, createdAt: new Date().toISOString() },
  { id: 'STK-005', name: 'Antiseptic Solution', category: 'Liquid', quantity: 8, price: 200, lowStockThreshold: 10, createdAt: new Date().toISOString() },
  { id: 'STK-006', name: 'Bandages', category: 'Supplies', quantity: 100, price: 50, lowStockThreshold: 20, createdAt: new Date().toISOString() },
];

const samplePayments: Payment[] = [
  {
    id: 'PAY-001',
    patientId: 'PAT-001',
    patientName: 'Ahmed Khan',
    consultationFee: 500,
    labFee: 1000,
    medicineFee: 350,
    totalAmount: 1850,
    paymentMode: 'Card',
    createdAt: new Date().toISOString(),
    medicines: [
      { stockId: 'STK-001', name: 'Paracetamol 500mg', quantity: 10, price: 10 },
      { stockId: 'STK-002', name: 'Amoxicillin 250mg', quantity: 10, price: 25 },
    ],
  },
  {
    id: 'PAY-002',
    patientId: 'PAT-002',
    patientName: 'Fatima Ali',
    consultationFee: 500,
    labFee: 0,
    medicineFee: 200,
    totalAmount: 700,
    paymentMode: 'Cash',
    createdAt: new Date().toISOString(),
    medicines: [
      { stockId: 'STK-001', name: 'Paracetamol 500mg', quantity: 20, price: 10 },
    ],
  },
];

const samplePrescriptions: Prescription[] = [
  {
    id: 'RX-001',
    patientId: 'PAT-001',
    patientName: 'Ahmed Khan',
    patientAge: 32,
    diagnosis: 'Viral Fever',
    medicines: [
      { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' },
      { name: 'Cough Syrup', dosage: '10ml', frequency: 'At night', duration: '3 days' },
    ],
    labTests: ['Blood test if fever persists'],
    doctorNotes: 'Rest and hydration recommended',
    precautions: 'Avoid cold drinks, follow-up after 3 days',
    generatedText: 'Patient Ahmed Khan (Age 32) diagnosed with Viral Fever. Prescribed Paracetamol 500mg twice daily for 5 days, Cough Syrup 10ml at night for 3 days. Advised blood test if fever persists. General advice: Rest and hydration recommended. Precautions: Avoid cold drinks, follow-up after 3 days.',
    followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
];

const sampleLabResults: LabResult[] = [
  {
    id: 'LAB-001',
    patientId: 'PAT-001',
    patientName: 'Ahmed Khan',
    patientAge: 32,
    testDate: new Date().toISOString().split('T')[0],
    reportDate: new Date().toISOString().split('T')[0],
    tests: [
      { name: 'Hemoglobin', value: '14.5', unit: 'g/dL', normalRange: '13.5-17.5', status: 'Normal' },
      { name: 'Blood Sugar (Fasting)', value: '95', unit: 'mg/dL', normalRange: '70-100', status: 'Normal' },
      { name: 'Total Cholesterol', value: '220', unit: 'mg/dL', normalRange: '<200', status: 'High' },
    ],
    notes: 'Slightly elevated cholesterol. Recommend dietary changes.',
    technician: 'Lab Tech - Asif',
    status: 'Ready',
    createdAt: new Date().toISOString(),
  },
];

interface HospitalStore {
  // Data
  patients: Patient[];
  payments: Payment[];
  stock: StockItem[];
  prescriptions: Prescription[];
  labResults: LabResult[];

  // Patient actions
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => string;
  updatePatient: (id: string, patient: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  // Payment actions
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => string;

  // Stock actions
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt'>) => string;
  updateStockItem: (id: string, item: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  reduceStock: (itemId: string, quantity: number) => void;

  // Prescription actions
  addPrescription: (prescription: Omit<Prescription, 'id' | 'createdAt'>) => string;

  // Lab Result actions
  addLabResult: (labResult: Omit<LabResult, 'id' | 'createdAt'>) => string;
  updateLabResultStatus: (id: string, status: LabResultStatus) => void;
  notifyPatient: (id: string) => void;
  markAsCollected: (id: string) => void;

  // Getters
  getPatientById: (id: string) => Patient | undefined;
  getLowStockItems: () => StockItem[];
  getTodayPayments: () => Payment[];
  getTodayTotalCollection: () => number;
}

export const useHospitalStore = create<HospitalStore>()(
  persist(
    (set, get) => ({
      // Initial data
      patients: samplePatients,
      payments: samplePayments,
      stock: sampleStock,
      prescriptions: samplePrescriptions,
      labResults: sampleLabResults,

      // Patient actions
      addPatient: (patient) => {
        const id = generateId('PAT');
        const newPatient: Patient = {
          ...patient,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ patients: [...state.patients, newPatient] }));
        return id;
      },

      updatePatient: (id, patient) => {
        set((state) => ({
          patients: state.patients.map((p) =>
            p.id === id ? { ...p, ...patient } : p
          ),
        }));
      },

      deletePatient: (id) => {
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== id),
        }));
      },

      // Payment actions
      addPayment: (payment) => {
        const id = generateId('PAY');
        const newPayment: Payment = {
          ...payment,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ payments: [...state.payments, newPayment] }));
        return id;
      },

      // Stock actions
      addStockItem: (item) => {
        const id = generateId('STK');
        const newItem: StockItem = {
          ...item,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ stock: [...state.stock, newItem] }));
        return id;
      },

      updateStockItem: (id, item) => {
        set((state) => ({
          stock: state.stock.map((s) =>
            s.id === id ? { ...s, ...item } : s
          ),
        }));
      },

      deleteStockItem: (id) => {
        set((state) => ({
          stock: state.stock.filter((s) => s.id !== id),
        }));
      },

      reduceStock: (itemId, quantity) => {
        set((state) => ({
          stock: state.stock.map((s) =>
            s.id === itemId ? { ...s, quantity: Math.max(0, s.quantity - quantity) } : s
          ),
        }));
      },

      // Prescription actions
      addPrescription: (prescription) => {
        const id = generateId('RX');
        const newPrescription: Prescription = {
          ...prescription,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ prescriptions: [...state.prescriptions, newPrescription] }));
        return id;
      },

      // Lab Result actions
      addLabResult: (labResult) => {
        const id = generateId('LAB');
        const newLabResult: LabResult = {
          ...labResult,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ labResults: [...state.labResults, newLabResult] }));
        return id;
      },

      updateLabResultStatus: (id, status) => {
        set((state) => ({
          labResults: state.labResults.map((l) =>
            l.id === id ? { ...l, status } : l
          ),
        }));
      },

      notifyPatient: (id) => {
        set((state) => ({
          labResults: state.labResults.map((l) =>
            l.id === id ? { ...l, status: 'Notified' as LabResultStatus, notifiedAt: new Date().toISOString() } : l
          ),
        }));
      },

      markAsCollected: (id) => {
        set((state) => ({
          labResults: state.labResults.map((l) =>
            l.id === id ? { ...l, status: 'Collected' as LabResultStatus, collectedAt: new Date().toISOString() } : l
          ),
        }));
      },

      // Getters
      getPatientById: (id) => {
        return get().patients.find((p) => p.id === id);
      },

      getLowStockItems: () => {
        return get().stock.filter((item) => item.quantity <= item.lowStockThreshold);
      },

      getTodayPayments: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().payments.filter(
          (p) => p.createdAt.split('T')[0] === today
        );
      },

      getTodayTotalCollection: () => {
        return get().getTodayPayments().reduce((sum, p) => sum + p.totalAmount, 0);
      },
    }),
    {
      name: 'hospital-storage',
    }
  )
);
