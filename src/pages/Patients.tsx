import { useState, useEffect } from 'react';
import { useAccessPatients } from '@/hooks/useAccessPatients';
import { usePatientServices } from '@/hooks/usePatientServices';
import { usePayments } from '@/hooks/usePayments';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useLabResults } from '@/hooks/useLabResults';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Loader2, RefreshCw, ClipboardPlus, History } from 'lucide-react';
import { toast } from 'sonner';
import { Patient } from '@/types/hospital';
import { ServicesState } from '@/types/services';
import { format, differenceInHours } from 'date-fns';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { AdditionalServicesPanel } from '@/components/patients/AdditionalServicesPanel';
import { ServicesSummaryDialog } from '@/components/patients/ServicesSummaryDialog';
import { ServiceReceiptDialog } from '@/components/fees/ServiceReceiptDialog';
import { PatientHistoryDialog } from '@/components/patients/PatientHistoryDialog';
import { PatientServices } from '@/types/services';

// Helper function to check if patient is "new" (registered within last 24 hours)
const isNewPatient = (createdAt: string): boolean => {
  if (!createdAt) return false;
  const hours = differenceInHours(new Date(), new Date(createdAt));
  return hours < 24;
};

// Helper to get badge variant based on role
const getRoleBadgeVariant = (role?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (role) {
    case 'Doctor':
      return 'default';
    case 'LabTechnician':
      return 'secondary';
    case 'Admin':
      return 'destructive';
    default:
      return 'outline';
  }
};

// Helper to get display text for role
const getRoleDisplayText = (role?: string): string => {
  switch (role) {
    case 'Doctor':
      return 'Dr.';
    case 'LabTechnician':
      return 'Lab';
    case 'Receptionist':
      return 'Rec.';
    case 'Admin':
      return 'Admin';
    default:
      return '';
  }
};

export function PatientsPage() {
  // Destructure pagination props
  const { patients, loading, error, isDemoMode, isCloud, addPatient, updatePatient, deletePatient, refetch, page, setPage, totalPages, setSearch } = useAccessPatients();
  const { services: patientServices, addService } = usePatientServices();
  const { payments, getPatientPayments, addPayment } = usePayments();
  const { prescriptions, getPatientPrescriptions } = usePrescriptions();
  const { labResults, getPatientLabResults } = useLabResults();
  const { user, hasPermission } = useAuthStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [currentServices, setCurrentServices] = useState<ServicesState | null>(null);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState(''); // Local state for input
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyRegisteredPatientId, setNewlyRegisteredPatientId] = useState<string | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<{ service: PatientServices; patient: Patient } | null>(null);



  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchQuery);
      if (searchQuery) setPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, setSearch, setPage]);


  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '',
    address: '',
    visitDate: new Date().toISOString().split('T')[0],
    symptoms: '',
  });

  // Lookup state
  const [lookupResults, setLookupResults] = useState<Patient[]>([]);

  const handleLookupPatient = async (query: string) => {
    try {
      // We use the patientsApi directly to avoid messing with the main table state
      const response = await import('@/services/accessApi').then(m => m.patientsApi.getAll({ search: query, limit: 5 }));
      if ('data' in response) {
        // Map DTO to Patient using a local helper or duplicate logic (simplest here to map manually for just required fields)
        const results: Patient[] = response.data.map((dto: any) => ({
          id: dto.ID,
          name: dto.Name,
          age: dto.Age,
          gender: dto.Gender,
          phone: dto.Phone,
          address: dto.Address,
          visitDate: dto.VisitDate,
          symptoms: dto.Symptoms,
          createdAt: dto.CreatedAt
        }));
        setLookupResults(results);
      }
    } catch (e) {
      console.error("Lookup failed", e);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      age: '',
      gender: 'Male',
      phone: '',
      address: '',
      visitDate: new Date().toISOString().split('T')[0],
      symptoms: '',
    });
    setEditingPatient(null);
    setLookupResults([]);
  };

  const handleOpenDialog = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        name: patient.name,
        age: patient.age.toString(),
        gender: patient.gender,
        phone: patient.phone,
        address: patient.address,
        visitDate: patient.visitDate,
        symptoms: patient.symptoms,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim() || !formData.age || !formData.phone.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const patientData = {
      name: formData.name.trim(),
      age: parseInt(formData.age),
      gender: formData.gender,
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      visitDate: formData.visitDate,
      symptoms: formData.symptoms.trim(),
      registeredBy: user?.name,
      registeredByRole: user?.role,
    };

    setIsSubmitting(true);
    try {
      if (editingPatient) {
        await updatePatient(editingPatient.id, patientData);
        toast.success('Patient updated successfully');
        handleCloseDialog();
      } else {
        const id = await addPatient(patientData);
        toast.success(`Patient registered with ID: ${id}`);
        // After registration, open services dialog
        const newPatient: Patient = {
          ...patientData,
          id,
          createdAt: new Date().toISOString(),
        };
        setNewlyRegisteredPatientId(id);
        setSelectedPatient(newPatient);
        setIsDialogOpen(false);
        setIsServicesDialogOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddServices = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsServicesDialogOpen(true);
  };

  const handleSaveServices = async (services: ServicesState, grandTotal: number) => {
    if (!selectedPatient) return;

    try {
      setIsSubmitting(true);
      // 1. Save Service Record
      const serviceId = await addService(selectedPatient.id, services, grandTotal);

      // 2. Create Payment Record (only if there are charges)
      if (grandTotal > 0) {
        const medicineFee = services.feeCollection.medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);

        await addPayment({
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          consultationFee: services.consultation.enabled ? services.consultation.fee : 0,
          labFee: services.feeCollection.labFee,
          medicineFee: medicineFee,
          totalAmount: grandTotal,
          paymentMode: services.feeCollection.paymentMode,
          medicines: services.feeCollection.medicines,
        });
      }

      toast.success('Services and Payment saved successfully!');

      // Prepare receipt data
      setReceiptData({
        service: {
          id: serviceId,
          patientId: selectedPatient.id,
          services: JSON.stringify(services), // Pass as string to match type
          grandTotal: grandTotal,
          status: 'Completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        patient: selectedPatient
      });
      setIsReceiptOpen(true);

      setNewlyRegisteredPatientId(null);
      setIsServicesDialogOpen(false);
      setSelectedPatient(null);
    } catch (err) {
      toast.error('Failed to save services');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewSummary = (services: ServicesState, grandTotal: number) => {
    setCurrentServices(services);
    setCurrentTotal(grandTotal);
    setIsSummaryOpen(true);
  };

  const handleViewHistory = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsHistoryOpen(true);
  };

  const handleDelete = async (patient: Patient) => {
    if (confirm(`Are you sure you want to delete ${patient.name}?`)) {
      try {
        await deletePatient(patient.id);
        toast.success('Patient deleted successfully');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete patient');
      }
    }
  };

  const handleServicesDialogChange = (open: boolean) => {
    if (!open) {
      // If closing and we have a new patient pending services
      if (newlyRegisteredPatientId && selectedPatient?.id === newlyRegisteredPatientId) {
        // Rollback: delete the incomplete patient record
        deletePatient(newlyRegisteredPatientId).catch(console.error);
        toast.info('Registration cancelled - Patient removed as no service was selected');
        setNewlyRegisteredPatientId(null);
      }
      setIsServicesDialogOpen(false);
      setSelectedPatient(null);
    } else {
      setIsServicesDialogOpen(true);
    }
  };

  // Filter patients (Client-side gender filter only)
  // Backend handles search, so we just filter by gender on the current page data
  const displayPatients = patients.filter((patient) => {
    const matchesGender = genderFilter === 'all' || patient.gender === genderFilter;
    return matchesGender;
  });

  return (
    <div>
      <PageHeader
        title="Patient Registration"
        description="Manage patient records and registrations"
        action={
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {hasPermission('edit_patients') && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Patient
              </Button>
            )}
          </div>
        }
      />

      {/* Cloud/Demo Mode Banner */}
      {
        isDemoMode && !isCloud && (
          <div className="bg-amber-500/10 border border-amber-500 text-amber-700 px-4 py-3 rounded-lg mb-4">
            <strong>Demo Mode:</strong> Backend server not available. Data is stored locally in your browser.
          </div>
        )
      }
      {
        isCloud && (
          <div className="bg-blue-500/10 border border-blue-500 text-blue-700 px-4 py-3 rounded-lg mb-4">
            <strong>Cloud Mode:</strong> Connected to Lovable Cloud database. Data persists across sessions.
          </div>
        )
      }

      {/* Error Banner */}
      {
        error && !isDemoMode && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-4">
            <strong>Connection Error:</strong> {error}
            <p className="text-sm mt-1">Make sure the backend server is running on localhost:3001</p>
          </div>
        )
      }

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Patients Table */}
      <div className="table-container min-h-[400px]">
        {loading && patients.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading patients...</span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Visit Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {error ? 'Unable to load patients' : 'No patients found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-mono text-sm">{patient.id}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {patient.name}
                          {isNewPatient(patient.createdAt) && (
                            <Badge
                              variant={getRoleBadgeVariant(patient.registeredByRole)}
                              className="text-[10px] px-1.5 py-0"
                            >
                              New {getRoleDisplayText(patient.registeredByRole) && `• ${getRoleDisplayText(patient.registeredByRole)}`}
                            </Badge>
                          )}
                        </div>
                        {patient.registeredBy && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Created by {patient.registeredBy} ({patient.registeredByRole})
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{patient.age}</TableCell>
                      <TableCell>{patient.gender}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell>{format(new Date(patient.visitDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View History"
                            onClick={() => handleViewHistory(patient)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {hasPermission('edit_patients') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Add Services"
                              onClick={() => handleAddServices(patient)}
                            >
                              <ClipboardPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('edit_patients') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(patient)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('delete_patients') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(patient)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2 py-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                Previous
              </Button>
              <div className="text-sm font-medium text-muted-foreground w-24 text-center">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Patient Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPatient ? 'Edit Patient' : 'Register New Patient'}
            </DialogTitle>
            <DialogDescription>
              {editingPatient
                ? 'Update patient information below.'
                : 'Fill in the patient details to register.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Patient Lookup for Revisit */}
            {!editingPatient && (
              <div className="bg-muted/30 p-4 rounded-lg border mb-4">
                <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Returning Patient? Search to Auto-fill
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    className="pl-9"
                    onChange={(e) => {
                      const query = e.target.value;
                      if (query.length >= 3) {
                        // Quick lookup (using existing patients list if available, or we could add a dedicated lookup api call)
                        // For now, let's filter the already loaded patients as a quick hint, 
                        // but ideally we should fetch from backend if list is huge.
                        // Triggering a search here might be complex without a dedicated hook method.
                        // Simple approach: Use a new effect or function to fetch lookup results.
                        handleLookupPatient(query);
                      } else {
                        setLookupResults([]);
                      }
                    }}
                  />
                  {lookupResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {lookupResults.map(p => (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-accent cursor-pointer text-sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              name: p.name,
                              age: p.age.toString(),
                              gender: p.gender,
                              phone: p.phone,
                              address: p.address,
                              // Keep visitDate as today
                              // Clear symptoms
                              symptoms: ''
                            });
                            setLookupResults([]);
                            toast.success("Patient details loaded!");
                          }}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.phone} • Age: {p.age}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Patient Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    min="0"
                    max="150"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Age"
                  />
                </div>

                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: 'Male' | 'Female' | 'Other') =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="03001234567"
                  />
                </div>

                <div>
                  <Label htmlFor="visitDate">Visit Date</Label>
                  <Input
                    id="visitDate"
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="symptoms">Symptoms</Label>
                  <Textarea
                    id="symptoms"
                    value={formData.symptoms}
                    onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                    placeholder="Describe symptoms..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPatient ? 'Update' : 'Register'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Additional Services Dialog */}
      <Dialog open={isServicesDialogOpen} onOpenChange={handleServicesDialogChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Additional Services</DialogTitle>
            <DialogDescription>
              Add optional services for the registered patient
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <AdditionalServicesPanel
              patientId={selectedPatient.id}
              patientName={selectedPatient.name}
              onSave={handleSaveServices}
              onViewSummary={handleViewSummary}
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      {
        selectedPatient && currentServices && (
          <ServicesSummaryDialog
            open={isSummaryOpen}
            onOpenChange={setIsSummaryOpen}
            patient={selectedPatient}
            services={currentServices}
            grandTotal={currentTotal}
          />
        )
      }

      {/* Patient History Dialog */}
      {
        selectedPatient && (
          <PatientHistoryDialog
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            patient={selectedPatient}
            payments={getPatientPayments(selectedPatient.id)}
            prescriptions={getPatientPrescriptions(selectedPatient.id)}
            labResults={getPatientLabResults(selectedPatient.id)}
            services={patientServices.filter(s => s.patientId === selectedPatient.id)}
          />
        )
      }
      {/* Service Receipt Dialog */}
      <ServiceReceiptDialog
        open={isReceiptOpen}
        onOpenChange={setIsReceiptOpen}
        service={receiptData?.service || null}
        patient={receiptData?.patient || null}
      />
    </div >
  );
}
