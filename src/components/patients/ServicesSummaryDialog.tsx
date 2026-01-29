import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ServicesState } from '@/types/services';
import { Patient } from '@/types/hospital';

interface ServicesSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  services: ServicesState;
  grandTotal: number;
}

export function ServicesSummaryDialog({
  open,
  onOpenChange,
  patient,
  services,
  grandTotal,
}: ServicesSummaryDialogProps) {
  const enabledServices = [];
  
  if (services.consultation.enabled) enabledServices.push('Consultation');
  if (services.ultrasound.enabled) enabledServices.push('Ultrasound');
  if (services.ecg.enabled) enabledServices.push('ECG');
  if (services.bpReading.enabled) enabledServices.push('BP Reading');
  if (services.injection.enabled) enabledServices.push('Injection');
  if (services.retention.enabled) enabledServices.push('Retention');
  if (services.surgery.enabled) enabledServices.push('Surgery');

  const medicineFee = services.feeCollection?.medicines?.reduce((sum, m) => sum + m.price * m.quantity, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Services Summary</DialogTitle>
          <DialogDescription>
            Complete breakdown of services for patient
          </DialogDescription>
        </DialogHeader>

        {/* Patient Details */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h3 className="font-semibold text-lg">{patient.name}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Patient ID:</span> {patient.id}</div>
            <div><span className="text-muted-foreground">Age:</span> {patient.age} years</div>
            <div><span className="text-muted-foreground">Gender:</span> {patient.gender}</div>
            <div><span className="text-muted-foreground">Phone:</span> {patient.phone}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Visit Date:</span> {format(new Date(patient.visitDate), 'PPP')}</div>
          </div>
        </div>

        <Separator />

        {/* Selected Services */}
        <div className="space-y-2">
          <h4 className="font-medium">Selected Services</h4>
          <div className="flex flex-wrap gap-2">
            {enabledServices.length > 0 ? (
              enabledServices.map((service) => (
                <Badge key={service} variant="secondary">{service}</Badge>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No services selected</p>
            )}
            {services.feeCollection?.medicines?.length > 0 && (
              <Badge variant="outline">Medicines ({services.feeCollection.medicines.length})</Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Service Details & Charges */}
        <div className="space-y-3">
          <h4 className="font-medium">Charges Breakdown</h4>
          
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Service</th>
                <th className="text-left py-2">Details</th>
                <th className="text-right py-2">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {services.consultation.enabled && (
                <tr className="border-b">
                  <td className="py-2">Consultation</td>
                  <td className="py-2 text-muted-foreground">
                    {services.consultation.type} - Dr. {services.consultation.doctorName}
                  </td>
                  <td className="py-2 text-right">{services.consultation.fee.toLocaleString()}</td>
                </tr>
              )}
              
              {services.ultrasound.enabled && (
                <tr className="border-b">
                  <td className="py-2">Ultrasound</td>
                  <td className="py-2 text-muted-foreground">{services.ultrasound.type}</td>
                  <td className="py-2 text-right">{services.ultrasound.charges.toLocaleString()}</td>
                </tr>
              )}
              
              {services.ecg.enabled && (
                <tr className="border-b">
                  <td className="py-2">ECG</td>
                  <td className="py-2 text-muted-foreground">{services.ecg.type}</td>
                  <td className="py-2 text-right">{services.ecg.charges.toLocaleString()}</td>
                </tr>
              )}
              
              {services.bpReading.enabled && (
                <tr className="border-b">
                  <td className="py-2">BP Reading</td>
                  <td className="py-2 text-muted-foreground">
                    {services.bpReading.systolic}/{services.bpReading.diastolic} mmHg, Pulse: {services.bpReading.pulse}
                  </td>
                  <td className="py-2 text-right">-</td>
                </tr>
              )}
              
              {services.injection.enabled && (
                <tr className="border-b">
                  <td className="py-2">Injection ({services.injection.type})</td>
                  <td className="py-2 text-muted-foreground">
                    {services.injection.name} x {services.injection.quantity}
                  </td>
                  <td className="py-2 text-right">
                    {(services.injection.charges * services.injection.quantity).toLocaleString()}
                  </td>
                </tr>
              )}
              
              {services.retention.enabled && (
                <tr className="border-b">
                  <td className="py-2">Retention</td>
                  <td className="py-2 text-muted-foreground">{services.retention.duration}</td>
                  <td className="py-2 text-right">{services.retention.charges.toLocaleString()}</td>
                </tr>
              )}
              
              {services.surgery.enabled && (
                <>
                  <tr className="border-b">
                    <td className="py-2">Surgery ({services.surgery.type})</td>
                    <td className="py-2 text-muted-foreground">
                      Surgeon: Dr. {services.surgery.surgeonName} | Date: {services.surgery.surgeryDate}
                    </td>
                    <td className="py-2 text-right"></td>
                  </tr>
                  <tr className="border-b pl-4">
                    <td className="py-1 pl-4 text-muted-foreground">- Operation Charges</td>
                    <td></td>
                    <td className="py-1 text-right">{services.surgery.operationCharges.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b pl-4">
                    <td className="py-1 pl-4 text-muted-foreground">- OT Charges</td>
                    <td></td>
                    <td className="py-1 text-right">{services.surgery.otCharges.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b pl-4">
                    <td className="py-1 pl-4 text-muted-foreground">- Anesthesia Charges</td>
                    <td></td>
                    <td className="py-1 text-right">{services.surgery.anesthesiaCharges.toLocaleString()}</td>
                  </tr>
                </>
              )}
              
              {/* Fee Collection - Lab Fee */}
              {services.feeCollection?.labFee > 0 && (
                <tr className="border-b">
                  <td className="py-2">Lab Fee</td>
                  <td className="py-2 text-muted-foreground">Laboratory Tests</td>
                  <td className="py-2 text-right">{services.feeCollection.labFee.toLocaleString()}</td>
                </tr>
              )}
              
              {/* Fee Collection - Medicines */}
              {services.feeCollection?.medicines?.length > 0 && (
                <>
                  <tr className="border-b">
                    <td className="py-2">Medicines</td>
                    <td className="py-2 text-muted-foreground">
                      {services.feeCollection.medicines.length} item(s)
                    </td>
                    <td className="py-2 text-right">{medicineFee.toLocaleString()}</td>
                  </tr>
                  {services.feeCollection.medicines.map((m) => (
                    <tr key={m.stockId} className="border-b">
                      <td className="py-1 pl-4 text-muted-foreground">- {m.name}</td>
                      <td className="py-1 text-muted-foreground">× {m.quantity} @ Rs. {m.price}</td>
                      <td className="py-1 text-right">{(m.price * m.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="py-2 text-muted-foreground" colSpan={2}>Payment Mode</td>
                <td className="py-2 text-right">{services.feeCollection?.paymentMode || 'Cash'}</td>
              </tr>
              <tr className="font-bold text-lg">
                <td className="py-3" colSpan={2}>Grand Total</td>
                <td className="py-3 text-right text-primary">Rs. {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
