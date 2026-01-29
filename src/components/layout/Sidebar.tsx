import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  FileText,
  Activity,
  Menu,
  X,
  FlaskConical,
  Settings,
  LogOut,
  User,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types/services';
import { Permission } from '@/types/user';

// Navigation items for the sidebar with role restrictions
const navItems: { path: string; label: string; icon: React.ComponentType<any>; roles: UserRole[]; permission?: Permission }[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Receptionist', 'Doctor', 'LabTechnician', 'Admin'] },
  { path: '/patients', label: 'Patients', icon: Users, roles: ['Receptionist', 'Doctor', 'Admin'], permission: 'view_patients' },
  { path: '/fees', label: 'Fee Collection', icon: CreditCard, roles: ['Receptionist', 'Admin'], permission: 'view_payments' },
  { path: '/medicines', label: 'Medicines', icon: Activity, roles: ['Doctor', 'Admin'], permission: 'view_medicines' },
  { path: '/stock', label: 'Pharmacy', icon: Package, roles: ['Receptionist', 'Admin'], permission: 'manage_stock' },
  { path: '/prescriptions', label: 'Prescriptions', icon: FileText, roles: ['Doctor', 'Admin'], permission: 'view_prescriptions' },
  { path: '/lab-results', label: 'Lab Results', icon: FlaskConical, roles: ['LabTechnician', 'Admin'], permission: 'view_lab_results' },
  { path: '/users', label: 'User Management', icon: ShieldCheck, roles: ['Admin'], permission: 'manage_users' },
  { path: '/daily-expenses', label: 'Daily Expenses', icon: Receipt, roles: ['Admin', 'Receptionist'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['Receptionist', 'Doctor', 'LabTechnician', 'Admin'] },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, hasRole, hasPermission } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter nav items based on user role
  // Filter nav items based on user role and permissions
  const filteredNavItems = navItems.filter((item) => {
    if (!user) return false;

    // Check role match
    const roleMatch = item.roles.includes(user.role);

    // Check permission match if permission is defined
    const permissionMatch = item.permission ? hasPermission(item.permission) : true;

    return roleMatch && permissionMatch;
  });

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Receptionist':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Doctor':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'LabTechnician':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return '';
    }
  };

  const NavContent = () => (
    <>
      {/* Logo/Header */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <Activity className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">MediCare</h1>
          <p className="text-xs text-sidebar-foreground/60">Hospital System</p>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
              <User className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.name}
              </p>
              <Badge variant="outline" className={cn("text-xs", getRoleBadgeColor(user.role))}>
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'sidebar-link',
                isActive && 'sidebar-link-active'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer with Logout */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
        <p className="text-xs text-sidebar-foreground/50 text-center">
          © 2024 MediCare HMS
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-card shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar transform transition-transform duration-300 md:hidden flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar flex-col min-h-screen">
        <NavContent />
      </aside>
    </>
  );
}
