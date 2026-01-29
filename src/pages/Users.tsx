import { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Shield, Key } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUsers } from '@/hooks/useUsers';
import { User, UserRole, Permission, DEFAULT_PERMISSIONS } from '@/types/user';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const ROLE_COLORS: Record<UserRole, string> = {
    Admin: 'bg-purple-500',
    Doctor: 'bg-blue-500',
    Receptionist: 'bg-green-500',
    LabTechnician: 'bg-orange-500',
};

const PERMISSION_LABELS: Record<Permission, string> = {
    view_patients: 'View Patients',
    edit_patients: 'Edit Patients',
    delete_patients: 'Delete Patients',
    view_payments: 'View Payments',
    create_payments: 'Create Payments',
    view_lab_results: 'View Lab Results',
    edit_lab_results: 'Edit Lab Results',
    view_prescriptions: 'View Prescriptions',
    create_prescriptions: 'Create Prescriptions',
    view_reports: 'View Reports',
    manage_users: 'Manage Users',
    manage_stock: 'Manage Stock',
    view_medicines: 'View Medicines',
};

export function UsersPage() {
    const { users, loading, addUser, updateUser, updatePermissions, deleteUser, refetch } = useUsers();
    const { toast } = useToast();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        phone: '',
        role: 'Receptionist' as UserRole,
    });

    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

    const handleAddUser = async () => {
        try {
            await addUser({
                ...formData,
                permissions: selectedPermissions,
            });

            toast({
                title: 'Success',
                description: 'User created successfully',
            });

            setAddDialogOpen(false);
            resetForm();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create user',
                variant: 'destructive',
            });
        }
    };

    const handleEditUser = async () => {
        if (!selectedUser) return;

        try {
            await updateUser(selectedUser.id, {
                username: formData.username,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                role: formData.role,
            });

            toast({
                title: 'Success',
                description: 'User updated successfully',
            });

            setEditDialogOpen(false);
            setSelectedUser(null);
            resetForm();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update user',
                variant: 'destructive',
            });
        }
    };

    const handleUpdatePermissions = async () => {
        if (!selectedUser) return;

        try {
            await updatePermissions(selectedUser.id, selectedPermissions);

            toast({
                title: 'Success',
                description: 'Permissions updated successfully',
            });

            setPermissionsDialogOpen(false);
            setSelectedUser(null);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update permissions',
                variant: 'destructive',
            });
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;

        try {
            await deleteUser(selectedUser.id);

            toast({
                title: 'Success',
                description: 'User deleted successfully',
            });

            setDeleteDialogOpen(false);
            setSelectedUser(null);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete user',
                variant: 'destructive',
            });
        }
    };

    const openEditDialog = (user: User) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            password: '',
            name: user.name,
            email: user.email || '',
            phone: user.phone || '',
            role: user.role,
        });
        setEditDialogOpen(true);
    };

    const openPermissionsDialog = (user: User) => {
        setSelectedUser(user);
        setSelectedPermissions(user.permissions || []);
        setPermissionsDialogOpen(true);
    };

    const openDeleteDialog = (user: User) => {
        setSelectedUser(user);
        setDeleteDialogOpen(true);
    };

    const resetForm = () => {
        setFormData({
            username: '',
            password: '',
            name: '',
            email: '',
            phone: '',
            role: 'Receptionist',
        });
        setSelectedPermissions([]);
    };

    const handleRoleChange = (role: UserRole) => {
        setFormData({ ...formData, role });
        setSelectedPermissions(DEFAULT_PERMISSIONS[role] || []);
    };

    const togglePermission = (permission: Permission) => {
        setSelectedPermissions(prev =>
            (prev || []).includes(permission)
                ? prev.filter(p => p !== permission)
                : [...(prev || []), permission]
        );
    };

    return (
        <div>
            <PageHeader
                title="User Management"
                description="Manage users and their permissions"
                action={
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button onClick={() => { resetForm(); setAddDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add User
                        </Button>
                    </div>
                }
            />

            {/* Users Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        {loading && users.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No users found</div>
                        ) : (
                            users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold">{user.name}</h3>
                                            <Badge className={ROLE_COLORS[user.role]}>{user.role}</Badge>
                                            {!user.isActive && <Badge variant="destructive">Inactive</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>@{user.username}</p>
                                            {user.email && <p>{user.email}</p>}
                                            {user.lastLogin && (
                                                <p>Last login: {format(new Date(user.lastLogin), 'MMM dd, yyyy HH:mm')}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openPermissionsDialog(user)}
                                            title="Manage Permissions"
                                        >
                                            <Shield className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(user)}
                                            title="Edit User"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDeleteDialog(user)}
                                            title="Delete User"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Add User Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">Username *</Label>
                                <Input
                                    id="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="johndoe"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+92 300 1234567"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role *</Label>
                                <Select value={formData.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Admin">Admin</SelectItem>
                                        <SelectItem value="Doctor">Doctor</SelectItem>
                                        <SelectItem value="Receptionist">Receptionist</SelectItem>
                                        <SelectItem value="LabTechnician">Lab Technician</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                                {(Object.entries(PERMISSION_LABELS) as [Permission, string][]).map(([permission, label]) => (
                                    <div key={permission} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`add-${permission}`}
                                            checked={selectedPermissions?.includes(permission)}
                                            onCheckedChange={() => togglePermission(permission)}
                                        />
                                        <Label htmlFor={`add-${permission}`} className="text-sm font-normal cursor-pointer">
                                            {label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddUser} disabled={!formData.username || !formData.name || !formData.password}>
                            Create User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Full Name *</Label>
                                <Input
                                    id="edit-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-username">Username *</Label>
                                <Input
                                    id="edit-username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-phone">Phone</Label>
                                <Input
                                    id="edit-phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Role *</Label>
                            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Doctor">Doctor</SelectItem>
                                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                                    <SelectItem value="LabTechnician">Lab Technician</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditUser} disabled={!formData.username || !formData.name}>
                            Update User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Permissions Dialog */}
            <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Manage Permissions - {selectedUser?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                            {(Object.entries(PERMISSION_LABELS) as [Permission, string][]).map(([permission, label]) => (
                                <div key={permission} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`perm-${permission}`}
                                        checked={selectedPermissions?.includes(permission)}
                                        onCheckedChange={() => togglePermission(permission)}
                                    />
                                    <Label htmlFor={`perm-${permission}`} className="text-sm font-normal cursor-pointer">
                                        {label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdatePermissions}>
                            <Shield className="mr-2 h-4 w-4" />
                            Update Permissions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will deactivate the user <strong>{selectedUser?.name}</strong>. They will no longer be able to log in.
                            This action can be reversed by reactivating the user.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
                            Delete User
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
