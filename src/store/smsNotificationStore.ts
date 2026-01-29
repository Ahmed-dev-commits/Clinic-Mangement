import { create } from 'zustand';

export type SmsStatus = 'queued' | 'sending' | 'delivered' | 'failed';

export interface SmsNotification {
  id: string;
  to: string;
  patientName: string;
  message: string;
  status: SmsStatus;
  createdAt: string;
  updatedAt: string;
  labResultId: string;
}

interface SmsNotificationStore {
  notifications: SmsNotification[];
  addNotification: (notification: Omit<SmsNotification, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateStatus: (id: string, status: SmsStatus) => void;
  clearNotifications: () => void;
  getRecentNotifications: (limit?: number) => SmsNotification[];
}

const generateId = () => `SMS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useSmsNotificationStore = create<SmsNotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = generateId();
    const now = new Date().toISOString();
    const newNotification: SmsNotification = {
      ...notification,
      id,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
    }));
    return id;
  },

  updateStatus: (id, status) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, status, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  getRecentNotifications: (limit = 10) => {
    return get().notifications.slice(0, limit);
  },
}));
