import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@/types/services';
import { Permission, DEFAULT_PERMISSIONS } from '@/types/user';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions?: Permission[];
  email?: string;
  phone?: string;
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Demo users for testing when backend is unavailable
const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  receptionist: {
    password: 'reception123',
    user: { id: 'demo-1', username: 'receptionist', name: 'Reception Staff', role: 'Receptionist' },
  },
  doctor: {
    password: 'doctor123',
    user: { id: 'demo-2', username: 'doctor', name: 'Dr. Smith', role: 'Doctor' },
  },
  labtech: {
    password: 'lab123',
    user: { id: 'demo-3', username: 'labtech', name: 'Lab Technician', role: 'LabTechnician' },
  },
  admin: {
    password: 'admin123',
    user: { id: 'demo-4', username: 'admin', name: 'Administrator', role: 'Admin' },
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        // First try the backend
        try {
          const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              // Parse permissions if they're a string
              let permissions: Permission[] = [];
              if (data.user.Permissions || data.user.permissions) {
                const permStr = data.user.Permissions || data.user.permissions;
                try {
                  permissions = typeof permStr === 'string' ? JSON.parse(permStr) : permStr;
                } catch {
                  permissions = [];
                }
              }

              // Fallback to default permissions if none assigned
              if (!permissions || permissions.length === 0) {
                const role = (data.user.Role || data.user.role) as UserRole;
                permissions = DEFAULT_PERMISSIONS[role] || [];
              }

              set({
                user: {
                  id: data.user.ID || data.user.id,
                  username: data.user.Username || data.user.username,
                  name: data.user.Name || data.user.name,
                  role: (data.user.Role || data.user.role) as UserRole,
                  permissions,
                  email: data.user.Email || data.user.email,
                  phone: data.user.Phone || data.user.phone,
                },
                isAuthenticated: true,
              });

              // Store user ID in localStorage for API calls
              localStorage.setItem('currentUserId', data.user.ID || data.user.id);

              return true;
            }
          }
        } catch (error) {
          console.log('Backend unavailable, using demo mode');
        }

        // Fallback to demo users when backend is unavailable
        const demoUser = DEMO_USERS[username.toLowerCase()];
        if (demoUser && demoUser.password === password) {
          set({
            user: demoUser.user,
            isAuthenticated: true,
          });
          return true;
        }

        return false;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      hasRole: (roles: UserRole[]) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(user.role);
      },

      hasPermission: (permission: Permission) => {
        const user = get().user;
        if (!user) return false;
        // Admin always has all permissions
        if (user.role === 'Admin') return true;
        // Check if user has specific permission
        return user.permissions ? user.permissions.includes(permission) : false;
      },
    }),
    {
      name: 'hospital-auth',
    }
  )
);
