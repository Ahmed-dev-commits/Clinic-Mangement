import { useState, useEffect, useCallback } from 'react';
import { User, UserDTO, Permission } from '@/types/user';

const API_BASE_URL = 'http://localhost:3001/api';

// Convert API DTO to local type
function dtoToUser(dto: UserDTO | any): User {
    let permissions: Permission[] = [];

    // Parse permissions if it's a string
    if (dto.Permissions || dto.permissions) {
        const permStr = dto.Permissions || dto.permissions;
        try {
            permissions = typeof permStr === 'string' ? JSON.parse(permStr) : permStr;
        } catch {
            permissions = [];
        }
    }

    return {
        id: dto.ID || dto.id || '',
        username: dto.Username || dto.username || '',
        name: dto.Name || dto.name || '',
        email: dto.Email || dto.email,
        phone: dto.Phone || dto.phone,
        role: (dto.Role || dto.role || 'Receptionist') as any,
        permissions,
        isActive: Boolean(dto.IsActive !== undefined ? dto.IsActive : dto.isActive !== undefined ? dto.isActive : true),
        createdBy: dto.CreatedBy || dto.createdBy,
        createdAt: dto.CreatedAt || dto.createdAt || new Date().toISOString(),
        updatedAt: dto.UpdatedAt || dto.updatedAt,
        lastLogin: dto.LastLogin || dto.lastLogin,
    };
}

export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE_URL}/users`);

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            const usersArray = Array.isArray(data) ? data : [];
            setUsers(usersArray.map(dtoToUser));
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const addUser = async (userData: {
        username: string;
        password: string;
        name: string;
        email?: string;
        phone?: string;
        role: string;
        permissions?: Permission[];
    }): Promise<string> => {
        const id = `USR-${Date.now().toString(36).toUpperCase()}`;

        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                ...userData,
                permissions: JSON.stringify(userData.permissions || []),
                createdBy: localStorage.getItem('currentUserId') || 'SYSTEM',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }

        await fetchUsers();
        return id;
    };

    const updateUser = async (id: string, userData: {
        username: string;
        name: string;
        email?: string;
        phone?: string;
        role: string;
        isActive?: boolean;
    }): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update user');
        }

        await fetchUsers();
    };

    const updatePermissions = async (id: string, permissions: Permission[]): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/users/${id}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: JSON.stringify(permissions) }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update permissions');
        }

        await fetchUsers();
    };

    const updatePassword = async (id: string, password: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/users/${id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update password');
        }
    };

    const deleteUser = async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
        }

        await fetchUsers();
    };

    return {
        users,
        loading,
        error,
        addUser,
        updateUser,
        updatePermissions,
        updatePassword,
        deleteUser,
        refetch: fetchUsers,
    };
}
