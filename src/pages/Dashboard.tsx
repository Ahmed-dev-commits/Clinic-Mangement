import { useHospitalStore } from '@/store/hospitalStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, CreditCard, Package, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function DashboardPage() {
  const { patients, prescriptions, getLowStockItems, getTodayTotalCollection } = useHospitalStore();
  
  const lowStockItems = getLowStockItems();
  const todayCollection = getTodayTotalCollection();
  const recentPrescriptions = [...prescriptions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome to MediCare Hospital Management System"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Patients"
          value={patients.length}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Today's Collection"
          value={`Rs. ${todayCollection.toLocaleString()}`}
          icon={CreditCard}
          variant="success"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockItems.length}
          icon={Package}
          variant={lowStockItems.length > 0 ? 'destructive' : 'default'}
        />
        <StatCard
          title="Total Prescriptions"
          value={prescriptions.length}
          icon={FileText}
          variant="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <div className="form-section">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Low Stock Alerts</h2>
          </div>
          
          {lowStockItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">All stock levels are healthy!</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-1">
                      {item.quantity} left
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Threshold: {item.lowStockThreshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Prescriptions */}
        <div className="form-section">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Recent Prescriptions</h2>
          </div>
          
          {recentPrescriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No prescriptions yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{rx.patientName}</p>
                      <p className="text-sm text-muted-foreground">{rx.diagnosis}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(rx.createdAt), 'MMM dd')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {rx.medicines.map(m => m.name).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
