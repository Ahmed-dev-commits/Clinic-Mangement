import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ClinicSettings {
  clinicName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegNo: string;
  consultationHours: string;
  logo: string | null; // Base64 string for logo
  pdfSettings: {
    primaryColor: string;
    secondaryColor: string;
    footerText: string;
    showLogo: boolean;
    showWatermark: boolean;
  };
  themeColor: string;
}

const defaultSettings: ClinicSettings = {
  clinicName: 'Salamaat Medicare',
  address: 'Qabarastan Road Wah Cantt',
  city: 'Wah Cantt',
  phone: '+91 98765 43210',
  email: 'care@salamaat.com',
  doctorName: 'Dr.Aqsa Safdar',
  doctorQualification: 'MBBS(Gyanecologist)',
  doctorRegNo: '',
  consultationHours: '10 AM - 6 PM',
  logo: null,
  pdfSettings: {
    primaryColor: '#1a56db', // Blue
    secondaryColor: '#64748b', // Slate-500
    footerText: 'Please consult your doctor before taking any medicine. Self-medication can be harmful.',
    showLogo: true,
    showWatermark: true,
  },
  themeColor: '221 83% 53%', // Default Blue
};

interface SettingsStore {
  settings: ClinicSettings;
  updateSettings: (settings: Partial<ClinicSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
    }),
    {
      name: 'clinic-settings',
    }
  )
);
