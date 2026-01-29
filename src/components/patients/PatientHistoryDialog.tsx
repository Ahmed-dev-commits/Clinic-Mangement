import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Patient, Payment, Prescription, LabResult } from '@/types/hospital';
import { PatientServices } from '@/types/services';
import { Receipt, Pill, FlaskConical, ClipboardList, User } from 'lucide-react';

interface PatientHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  payments: Payment[];
  prescriptions: Prescription[];
  labResults: LabResult[];
  services: PatientServices[];
}

export function PatientHistoryDialog({
  open,
  onOpenChange,
  patient,
  payments,
  prescriptions,
  labResults,
  services,
}: PatientHistoryDialogProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient History: {patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ID:</span>
              <span className="ml-2 font-medium">{patient.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Age:</span>
              <span className="ml-2 font-medium">{patient.age} years</span>
            </div>
            <div>
              <span className="text-muted-foreground">Gender:</span>
              <span className="ml-2 font-medium">{patient.gender}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phone:</span>
              <span className="ml-2 font-medium">{patient.phone}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="payments">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payments" className="flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
              <Badge variant="secondary" className="ml-1">{payments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="flex items-center gap-1">
              <Pill className="h-4 w-4" />
              <span className="hidden sm:inline">Prescriptions</span>
              <Badge variant="secondary" className="ml-1">{prescriptions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="labResults" className="flex items-center gap-1">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Lab</span>
              <Badge variant="secondary" className="ml-1">{labResults.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Services</span>
              <Badge variant="secondary" className="ml-1">{services.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {/* Payments Tab */}
            <TabsContent value="payments" className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payment records found
                </div>
              ) : (
                payments.map((payment) => (
                  <Card key={payment.id}>
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">{payment.id}</CardTitle>
                        <Badge variant="outline">{payment.paymentMode}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Consultation:</span>
                          <span className="ml-2">Rs. {payment.consultationFee}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lab:</span>
                          <span className="ml-2">Rs. {payment.labFee}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Medicine:</span>
                          <span className="ml-2">Rs. {payment.medicineFee}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between">
                        <span className="font-medium">Total</span>
                        <span className="font-bold text-primary">Rs. {payment.totalAmount}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Prescriptions Tab */}
            <TabsContent value="prescriptions" className="space-y-4">
              {prescriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No prescriptions found
                </div>
              ) : (
                prescriptions.map((rx) => (
                  <Card key={rx.id}>
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">{rx.id}</CardTitle>
                        <Badge>{rx.diagnosis}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(rx.createdAt)}</p>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium">Medicines:</span>
                          <ul className="mt-1 space-y-1">
                            {rx.medicines.map((med, i) => (
                              <li key={i} className="text-sm text-muted-foreground">
                                • {med.name} - {med.dosage}, {med.frequency}, {med.duration}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {rx.labTests.length > 0 && (
                          <div>
                            <span className="text-sm font-medium">Lab Tests:</span>
                            <p className="text-sm text-muted-foreground">{rx.labTests.join(', ')}</p>
                          </div>
                        )}
                        {rx.followUpDate && (
                          <div>
                            <span className="text-sm font-medium">Follow-up:</span>
                            <span className="ml-2 text-sm">{rx.followUpDate}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Lab Results Tab */}
            <TabsContent value="labResults" className="space-y-4">
              {labResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No lab results found
                </div>
              ) : (
                labResults.map((lab) => (
                  <Card key={lab.id}>
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">{lab.id}</CardTitle>
                        <Badge variant={lab.status === 'Collected' ? 'default' : 'secondary'}>
                          {lab.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Test Date: {lab.testDate} | Report: {lab.reportDate}
                      </p>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-1">
                        {lab.tests.map((test, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{test.name}</span>
                            <span className={
                              test.status === 'Normal' ? 'text-green-600' :
                              test.status === 'Critical' ? 'text-red-600' : 'text-yellow-600'
                            }>
                              {test.value} {test.unit} ({test.status})
                            </span>
                          </div>
                        ))}
                      </div>
                      {lab.notes && (
                        <p className="mt-2 pt-2 border-t text-sm text-muted-foreground">{lab.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4">
              {services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No service records found
                </div>
              ) : (
                services.map((service) => (
                  <Card key={service.id}>
                    <CardHeader className="py-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">{service.id}</CardTitle>
                        <Badge variant={service.status === 'Completed' ? 'default' : 'secondary'}>
                          {service.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(service.createdAt)}</p>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Grand Total</span>
                        <span className="font-bold text-primary">Rs. {service.grandTotal}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
