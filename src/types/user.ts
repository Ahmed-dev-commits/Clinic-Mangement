export type UserRole = 'Admin' | 'Doctor' | 'Receptionist' | 'LabTechnician';

export type Permission =
    | 'view_patients'
    | 'edit_patients'
    | 'delete_patients'
    | 'view_payments'
    | 'create_payments'
    | 'view_lab_results'
    | 'edit_lab_results'
    | 'view_prescriptions'
    | 'create_prescriptions'
    | 'view_reports'
    | 'manage_users'
    | 'manage_stock'
    | 'view_medicines';

export interface User {
    id: string;
    username: string;
    name: string;
    email?: string;
    phone?: string;
    role: UserRole;
    permissions?: Permission[];
    isActive: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt?: string;
    lastLogin?: string;
}

export interface UserDTO {
    ID: string;
    Username: string;
    Name: string;
    Email?: string;
    Phone?: string;
    Role: string;
    Permissions?: string;
    IsActive: number;
    CreatedBy?: string;
    CreatedAt: string;
    UpdatedAt?: string;
    LastLogin?: string;
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
    Admin: [
        'view_patients',
        'edit_patients',
        'delete_patients',
        'view_payments',
        'create_payments',
        'view_lab_results',
        'edit_lab_results',
        'view_prescriptions',
        'create_prescriptions',
        'view_reports',
        'manage_users',
        'manage_stock',
        'view_medicines',
    ],
    Doctor: [
        'view_patients',
        'edit_patients',
        'view_prescriptions',
        'create_prescriptions',
        'view_lab_results',
        'view_medicines',
    ],
    Receptionist: [
        'view_patients',
        'edit_patients',
        'view_payments',
        'create_payments',
        'manage_stock',
    ],
    LabTechnician: [
        'view_patients',
        'view_lab_results',
        'edit_lab_results',
    ],
};
