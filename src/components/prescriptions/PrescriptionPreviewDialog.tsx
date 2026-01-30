import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { Prescription } from '@/types/hospital';
import { useSettingsStore } from '@/store/settingsStore';

interface PrescriptionPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prescription: Prescription | null;
    onDownloadPDF: (prescription: Prescription) => void;
}

export function PrescriptionPreviewDialog({
    open,
    onOpenChange,
    prescription,
    onDownloadPDF,
}: PrescriptionPreviewDialogProps) {
    const { settings } = useSettingsStore();

    if (!prescription) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Prescription Preview</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                            {prescription.id}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Clinic Header */}
                    <div className="border-b pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                {settings.logo && (
                                    <img src={settings.logo} alt="Clinic Logo" className="w-16 h-16 object-contain mb-2" />
                                )}
                                <h2 className="text-xl font-bold text-primary">{settings.clinicName}</h2>
                                <p className="text-sm text-muted-foreground">{settings.address}</p>
                                <p className="text-sm text-muted-foreground">{settings.city}</p>
                                <p className="text-sm text-muted-foreground">Phone: {settings.phone} | Email: {settings.email}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold">{settings.doctorName}</p>
                                <p className="text-sm text-muted-foreground">{settings.doctorQualification}</p>
                                <p className="text-sm text-muted-foreground">Reg. No: {settings.doctorRegNo}</p>
                                <p className="text-sm text-muted-foreground">Hours: {settings.consultationHours}</p>
                            </div>
                        </div>
                    </div>

                    {/* Patient Details */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div>
                            <p className="text-xs text-muted-foreground">Patient Name</p>
                            <p className="font-semibold">{prescription.patientName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Age</p>
                            <p className="font-semibold">{prescription.patientAge} years</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Patient ID</p>
                            <p className="font-semibold font-mono text-sm">{prescription.patientId}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="font-semibold">{format(new Date(prescription.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                        </div>
                    </div>

                    {/* Diagnosis */}
                    <div className="p-4 bg-primary/5 rounded-lg">
                        <p className="text-xs font-semibold text-primary mb-1">DIAGNOSIS</p>
                        <p className="text-sm">{prescription.diagnosis}</p>
                    </div>

                    {/* Medicines */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3">PRESCRIBED MEDICINES</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-primary text-primary-foreground">
                                    <tr>
                                        <th className="p-2 text-left">#</th>
                                        <th className="p-2 text-left">Medicine Name</th>
                                        <th className="p-2 text-left">Dosage</th>
                                        <th className="p-2 text-left">Frequency</th>
                                        <th className="p-2 text-left">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescription.medicines.map((med, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-muted/50' : ''}>
                                            <td className="p-2">{i + 1}</td>
                                            <td className="p-2 font-medium">{med.name}</td>
                                            <td className="p-2">{med.dosage}</td>
                                            <td className="p-2">{med.frequency}</td>
                                            <td className="p-2">{med.duration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Lab Tests */}
                    {prescription.labTests.length > 0 && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">LAB TESTS ADVISED</p>
                            <p className="text-sm">{prescription.labTests.join(', ')}</p>
                        </div>
                    )}

                    {/* Doctor Notes & Precautions */}
                    {(prescription.doctorNotes || prescription.precautions) && (
                        <div className="p-4 border rounded-lg space-y-2">
                            <p className="text-xs font-semibold text-primary">NOTES & ADVICE</p>
                            {prescription.doctorNotes && (
                                <p className="text-sm">{prescription.doctorNotes}</p>
                            )}
                            {prescription.precautions && (
                                <div>
                                    <p className="text-xs font-semibold text-destructive">Precautions:</p>
                                    <p className="text-sm">{prescription.precautions}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Follow-up Date */}
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">FOLLOW-UP DATE</p>
                        <p className="text-sm font-semibold">
                            {prescription.followUpDate ? format(new Date(prescription.followUpDate), 'dd MMM yyyy') : 'To be scheduled'}
                        </p>
                    </div>

                    {/* Disclaimer */}
                    <div className="text-center text-xs text-muted-foreground italic border-t pt-4">
                        <p>Please consult your doctor before taking any medicine. Self-medication can be harmful.</p>
                        <p className="mt-1">This is a computer-generated e-prescription from {settings.clinicName}.</p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="mr-2 h-4 w-4" />
                        Close
                    </Button>
                    <Button onClick={() => {
                        onDownloadPDF(prescription);
                        onOpenChange(false);
                    }}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
