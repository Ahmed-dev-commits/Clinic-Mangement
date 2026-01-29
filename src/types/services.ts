// Additional Hospital Services Types

export type ConsultationType = 'General' | 'Specialist';
export type UltrasoundType = 'Abdomen' | 'Pelvic' | 'Pregnancy' | 'Obstetric' | 'Thyroid' | 'Breast' | 'Other';
export type ECGType = 'Resting' | 'Stress';
export type InjectionType = 'IV' | 'IM';
export type SurgeryType = 'Normal' | 'Cesarean';

export interface Consultation {
  enabled: boolean;
  type: ConsultationType;
  doctorName: string;
  fee: number;
}

export interface Ultrasound {
  enabled: boolean;
  type: UltrasoundType;
  charges: number;
}

export interface ECG {
  enabled: boolean;
  type: ECGType;
  charges: number;
}

export interface BPReading {
  enabled: boolean;
  systolic: number;
  diastolic: number;
  pulse: number;
  recordedAt: string;
}

export interface InjectionCharge {
  enabled: boolean;
  type: InjectionType;
  name: string;
  quantity: number;
  charges: number;
}

export interface RetentionCharge {
  enabled: boolean;
  duration: string;
  charges: number;
}

export interface Surgery {
  enabled: boolean;
  type: SurgeryType;
  surgeonName: string;
  operationCharges: number;
  otCharges: number;
  anesthesiaCharges: number;
  surgeryDate: string;
}

export interface MedicineEntry {
  stockId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface FeeCollection {
  labFee: number;
  medicines: MedicineEntry[];
  paymentMode: 'Cash' | 'Card';
}

export interface ServicesState {
  consultation: Consultation;
  ultrasound: Ultrasound;
  ecg: ECG;
  bpReading: BPReading;
  injection: InjectionCharge;
  retention: RetentionCharge;
  surgery: Surgery;
  feeCollection: FeeCollection;
}

export interface PatientServices {
  id: string;
  patientId: string;
  services: string; // JSON string of ServicesState
  grandTotal: number;
  status: 'Draft' | 'Completed';
  createdAt: string;
  updatedAt: string;
}

// User Roles
export type UserRole = 'Receptionist' | 'Doctor' | 'LabTechnician' | 'Admin';

export interface User {
  id: string;
  username: string;
  password: string; // In real app, this would be hashed
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// Default empty services state
export const createEmptyServices = (): ServicesState => ({
  consultation: {
    enabled: false,
    type: 'General',
    doctorName: '',
    fee: 0,
  },
  ultrasound: {
    enabled: false,
    type: 'Abdomen',
    charges: 0,
  },
  ecg: {
    enabled: false,
    type: 'Resting',
    charges: 0,
  },
  bpReading: {
    enabled: false,
    systolic: 0,
    diastolic: 0,
    pulse: 0,
    recordedAt: new Date().toISOString(),
  },
  injection: {
    enabled: false,
    type: 'IM',
    name: '',
    quantity: 1,
    charges: 0,
  },
  retention: {
    enabled: false,
    duration: '',
    charges: 0,
  },
  surgery: {
    enabled: false,
    type: 'Normal',
    surgeonName: '',
    operationCharges: 0,
    otCharges: 0,
    anesthesiaCharges: 0,
    surgeryDate: new Date().toISOString().split('T')[0],
  },
  feeCollection: {
    labFee: 0,
    medicines: [],
    paymentMode: 'Cash',
  },
});
