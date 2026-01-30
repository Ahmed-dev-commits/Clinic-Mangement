import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, Calendar, Pill, User, Copy, Printer, Download, X, ChevronLeft } from 'lucide-react';
import { format, isSameDay, subDays, isAfter } from 'date-fns';
import { Prescription, Patient } from '@/types/hospital';
import jsPDF from 'jspdf';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';

interface PrescriptionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescriptions: Prescription[];
  patients: Patient[];
}

export function PrescriptionHistoryDialog({
  open,
  onOpenChange,
  prescriptions,
  patients,
}: PrescriptionHistoryDialogProps) {
  const { settings } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Get unique patients from prescriptions
  const prescribedPatients = [...new Set(prescriptions.map(p => p.patientId))].map(id => {
    const patient = patients.find(p => p.id === id);
    return patient ? { id, name: patient.name } : { id, name: prescriptions.find(p => p.patientId === id)?.patientName || 'Unknown' };
  });

  // Filter prescriptions - Only show Finalized (and exclude Drafts)
  const filteredPrescriptions = prescriptions.filter(rx => {
    // Treat undefined status as 'Finalized' for backward compatibility
    if (rx.status === 'Draft') return false;

    const matchesSearch =
      rx.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.medicines.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPatient = patientFilter === 'all' || rx.patientId === patientFilter;

    // Date Filtering
    const rxDate = new Date(rx.createdAt);
    const today = new Date();
    let matchesDate = true;

    if (dateFilter === 'today') {
      matchesDate = isSameDay(rxDate, today);
    } else if (dateFilter === 'yesterday') {
      matchesDate = isSameDay(rxDate, subDays(today, 1));
    } else if (dateFilter === 'last7') {
      matchesDate = isAfter(rxDate, subDays(today, 7));
    } else if (dateFilter === 'last30') {
      matchesDate = isAfter(rxDate, subDays(today, 30));
    }

    return matchesSearch && matchesPatient && matchesDate;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Prescription copied to clipboard');
  };

  const handleDownloadPDF = (rx: Prescription) => {
    const doc = new jsPDF();

    // Set document properties without URLs
    doc.setProperties({
      title: `Prescription-${rx.id}`,
      subject: 'Medical Prescription',
      author: settings.clinicName,
      creator: settings.clinicName
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Colors
    const primaryColorHex = settings.pdfSettings?.primaryColor || '#db671aff';
    const r = parseInt(primaryColorHex.slice(1, 3), 16);
    const g = parseInt(primaryColorHex.slice(3, 5), 16);
    const b = parseInt(primaryColorHex.slice(5, 7), 16);
    const primaryColor: [number, number, number] = [r, g, b];

    const textColor: [number, number, number] = [30, 30, 30];
    const mutedColor: [number, number, number] = [100, 100, 100];
    const lineColor: [number, number, number] = [200, 200, 200];

    // Get patient details
    const patient = patients.find(p => p.id === rx.patientId);

    // ============ HEADER SECTION ============
    // Logo
    const showLogo = settings.pdfSettings?.showLogo ?? true;
    if (settings.logo && showLogo) {
      try {
        doc.addImage(settings.logo, 'PNG', margin, 10, 25, 25);
      } catch {
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin, 10, 25, 25, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('LOGO', margin + 12.5, 25, { align: 'center' });
      }
    } else if (showLogo) {
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, 10, 25, 25, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('LOGO', margin + 12.5, 25, { align: 'center' });
    }

    // Clinic Info
    doc.setTextColor(...primaryColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.clinicName, margin + 30, 18);

    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.address, margin + 30, 24);
    doc.text(settings.city, margin + 30, 29);
    doc.text(`Phone: ${settings.phone} | Email: ${settings.email}`, margin + 30, 34);

    // Doctor Info (right side)
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.doctorName, pageWidth - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(settings.doctorQualification, pageWidth - margin, 23, { align: 'right' });
    doc.text(`Reg. No: ${settings.doctorRegNo}`, pageWidth - margin, 28, { align: 'right' });
    doc.text(`Consultation Hours: ${settings.consultationHours}`, pageWidth - margin, 33, { align: 'right' });

    // Header line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(margin, 40, pageWidth - margin, 40);

    // E-Prescription title
    doc.setFillColor(...primaryColor);
    doc.roundedRect(pageWidth / 2 - 25, 43, 50, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('E-PRESCRIPTION', pageWidth / 2, 48.5, { align: 'center' });

    // ============ PATIENT DETAILS SECTION ============
    let yPos = 58;

    // Patient info box
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'S');

    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Left column
    doc.text('Patient Name:', margin + 4, yPos + 7);
    doc.text('Age / Gender:', margin + 4, yPos + 14);
    doc.text('Patient ID:', margin + 4, yPos + 21);

    // Left column values
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(rx.patientName, margin + 30, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rx.patientAge} years / ${patient?.gender || 'N/A'}`, margin + 30, yPos + 14);
    doc.text(rx.patientId, margin + 30, yPos + 21);

    // Right column
    const rightCol = pageWidth / 2 + 10;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Date:', rightCol, yPos + 7);
    doc.text('Prescription ID:', rightCol, yPos + 14);
    doc.text('Visit ID:', rightCol, yPos + 21);

    // Right column values
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(format(new Date(rx.createdAt), 'dd MMM yyyy, hh:mm a'), rightCol + 30, yPos + 7);
    doc.text(rx.id, rightCol + 30, yPos + 14);
    doc.text(`V-${rx.id.slice(-6).toUpperCase()}`, rightCol + 30, yPos + 21);

    yPos += 35;

    // ============ DIAGNOSIS SECTION ============
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DIAGNOSIS:', margin + 4, yPos + 6);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(rx.diagnosis, margin + 28, yPos + 6);

    // Allergies
    doc.setTextColor(180, 50, 50);
    doc.setFontSize(8);
    doc.text('Allergies: None reported', margin + 4, yPos + 11);

    yPos += 20;

    // ============ PRESCRIPTION TABLE ============
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    const colWidths = [8, 45, 25, 30, 22, 50];
    let xPos = margin + 2;

    doc.text('#', xPos, yPos + 5.5);
    xPos += colWidths[0];
    doc.text('Medicine Name', xPos, yPos + 5.5);
    xPos += colWidths[1];
    doc.text('Dosage', xPos, yPos + 5.5);
    xPos += colWidths[2];
    doc.text('Frequency', xPos, yPos + 5.5);
    xPos += colWidths[3];
    doc.text('Duration', xPos, yPos + 5.5);
    xPos += colWidths[4];
    doc.text('Instructions', xPos, yPos + 5.5);

    yPos += 8;

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');

    rx.medicines.forEach((med, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
      }

      xPos = margin + 2;
      doc.text(`${i + 1}`, xPos, yPos + 5.5);
      xPos += colWidths[0];
      doc.setFont('helvetica', 'bold');
      doc.text(med.name, xPos, yPos + 5.5);
      doc.setFont('helvetica', 'normal');
      xPos += colWidths[1];
      doc.text(med.dosage, xPos, yPos + 5.5);
      xPos += colWidths[2];
      doc.text(med.frequency, xPos, yPos + 5.5);
      xPos += colWidths[3];
      doc.text(med.duration, xPos, yPos + 5.5);
      xPos += colWidths[4];
      doc.text('After food', xPos, yPos + 5.5);

      yPos += 8;
    });

    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos - (rx.medicines.length * 8) - 8, contentWidth, (rx.medicines.length + 1) * 8, 'S');

    yPos += 8;

    // ============ LAB TESTS SECTION ============
    if (rx.labTests && rx.labTests.length > 0) {
      doc.setFillColor(255, 250, 245);
      doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
      doc.setTextColor(200, 120, 50);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('LAB TESTS ADVISED:', margin + 4, yPos + 5);
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'normal');
      doc.text(rx.labTests.join(', '), margin + 38, yPos + 5);
      doc.setTextColor(...mutedColor);
      doc.setFontSize(7);
      doc.text('(Please complete tests before next visit)', margin + 4, yPos + 10);
      yPos += 16;
    }

    // ============ NOTES & ADVICE SECTION ============
    if (rx.doctorNotes || rx.precautions) {
      doc.setDrawColor(...lineColor);
      doc.setLineWidth(0.3);

      const notesHeight = 24;
      doc.roundedRect(margin, yPos, contentWidth, notesHeight, 2, 2, 'S');

      doc.setTextColor(...primaryColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES & ADVICE:', margin + 4, yPos + 6);

      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      if (rx.doctorNotes) {
        const splitNotes = doc.splitTextToSize(rx.doctorNotes, contentWidth - 8);
        doc.text(splitNotes, margin + 4, yPos + 12);
      }

      if (rx.precautions) {
        doc.setTextColor(180, 50, 50);
        doc.setFont('helvetica', 'bold');
        doc.text('Precautions:', margin + 4, yPos + 18);
        doc.setFont('helvetica', 'normal');
        doc.text(rx.precautions, margin + 25, yPos + 18);
      }

      yPos += notesHeight + 6;
    }

    // ============ FOLLOW-UP SECTION ============
    doc.setFillColor(240, 255, 240);
    doc.roundedRect(margin, yPos, contentWidth / 2 - 5, 12, 2, 2, 'F');
    doc.setTextColor(50, 150, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FOLLOW-UP DATE:', margin + 4, yPos + 7);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    const followUpDatePdf = rx.followUpDate ? new Date(rx.followUpDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    doc.text(isNaN(followUpDatePdf.getTime()) ? 'To be scheduled' : format(followUpDatePdf, 'dd MMM yyyy'), margin + 38, yPos + 7);

    // ============ FOOTER SECTION ============
    const footerY = pageHeight - 50;

    // Signature
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);

    doc.rect(margin, footerY, 60, 25, 'S');
    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.text('Doctor\'s Signature', margin + 30, footerY + 3, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(margin + 5, footerY + 18, margin + 55, footerY + 18);
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text(settings.doctorName, margin + 30, footerY + 22, { align: 'center' });

    // Clinic stamp
    doc.setLineWidth(0.3);
    doc.rect(pageWidth - margin - 60, footerY, 60, 25, 'S');
    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.text('Clinic Stamp', pageWidth - margin - 30, footerY + 3, { align: 'center' });
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.roundedRect(pageWidth - margin - 50, footerY + 6, 40, 16, 2, 2, 'S');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const clinicShortName = settings.clinicName.split(' ')[0];
    doc.text(clinicShortName, pageWidth - margin - 30, footerY + 14, { align: 'center' });
    doc.setFontSize(6);
    doc.text('HOSPITAL', pageWidth - margin - 30, footerY + 19, { align: 'center' });

    // Disclaimer
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    const disclaimer = settings.pdfSettings?.footerText || 'Please consult your doctor before taking any medicine. Self-medication can be harmful.';
    const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth);
    doc.text(splitDisclaimer, pageWidth / 2, pageHeight - 14, { align: 'center' });

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');

    doc.save(`prescription-${rx.id}.pdf`);
    toast.success('Professional PDF downloaded');
  };

  const selectedPatient = selectedPrescription ? patients.find(p => p.id === selectedPrescription.patientId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prescription History
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[70vh]">
          {/* Left Panel - List */}
          <div className={`${selectedPrescription ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/2 border-r`}>
            {/* Filters */}
            <div className="p-4 space-y-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient, diagnosis, or medicine..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={patientFilter} onValueChange={setPatientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Patient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patients</SelectItem>
                    {prescribedPatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last7">Last 7 Days</SelectItem>
                    <SelectItem value="last30">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prescription List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {filteredPrescriptions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No prescriptions found</p>
                  </div>
                ) : (
                  [...filteredPrescriptions].reverse().map((rx) => (
                    <Card
                      key={rx.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedPrescription?.id === rx.id ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => setSelectedPrescription(rx)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium text-sm">{rx.patientName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{rx.diagnosis}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(rx.createdAt), 'MMM dd, yyyy')}
                              <span>•</span>
                              <Pill className="h-3 w-3" />
                              {rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {rx.status === 'Draft' && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {rx.id}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                {filteredPrescriptions.length} prescription{filteredPrescriptions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className={`${selectedPrescription ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-1/2`}>
            {selectedPrescription ? (
              <>
                {/* Mobile back button */}
                <div className="md:hidden p-3 border-b">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPrescription(null)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to list
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6 bg-white min-h-[600px] border shadow-sm mx-auto max-w-3xl">
                    {/* Header with Logo and Clinic Info */}
                    <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
                      <div className="flex items-start gap-4">
                        {/* Logo */}
                        {settings.logo ? (
                          <img src={settings.logo} alt="Clinic Logo" className="w-16 h-16 object-contain rounded-lg" />
                        ) : (
                          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xs">
                            LOGO
                          </div>
                        )}
                        <div>
                          <h1 className="text-2xl font-bold text-primary">{settings.clinicName}</h1>
                          <p className="text-sm text-muted-foreground">{settings.address}</p>
                          <p className="text-sm text-muted-foreground">{settings.city}</p>
                          <p className="text-sm text-muted-foreground">Phone: {settings.phone} | Email: {settings.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{settings.doctorName}</p>
                        <p className="text-sm text-muted-foreground">{settings.doctorQualification}</p>
                        <p className="text-sm text-muted-foreground">Reg. No: {settings.doctorRegNo}</p>
                        <p className="text-sm text-muted-foreground">Consultation: {settings.consultationHours}</p>
                      </div>
                    </div>

                    {/* Patient Details Section */}
                    <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
                      <h2 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h2>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                        <p><span className="font-medium">Patient Name:</span> {selectedPrescription.patientName}</p>
                        <p><span className="font-medium">Patient ID:</span> {selectedPrescription.patientId}</p>
                        <p><span className="font-medium">Age / Gender:</span> {selectedPrescription.patientAge} years / {selectedPatient?.gender || 'N/A'}</p>
                        <p><span className="font-medium">Date:</span> {format(new Date(selectedPrescription.createdAt), 'MMMM dd, yyyy')}</p>
                        <p><span className="font-medium">Contact:</span> {selectedPatient?.phone || 'N/A'}</p>
                        <p><span className="font-medium">Visit ID:</span> RX-{selectedPrescription.id}</p>
                      </div>
                    </div>

                    {/* Diagnosis Section */}
                    <div className="mb-4 p-3 border rounded">
                      <h2 className="font-bold text-sm mb-1 text-primary">DIAGNOSIS</h2>
                      <p className="text-sm">{selectedPrescription.diagnosis}</p>
                    </div>

                    {/* Medications Table */}
                    <div className="mb-4">
                      <h2 className="font-bold text-sm mb-2 text-primary">PRESCRIBED MEDICATIONS</h2>
                      <table className="w-full border-collapse border text-sm">
                        <thead>
                          <tr className="bg-primary/10">
                            <th className="border p-2 text-left font-semibold">#</th>
                            <th className="border p-2 text-left font-semibold">Medicine Name</th>
                            <th className="border p-2 text-left font-semibold">Dosage</th>
                            <th className="border p-2 text-left font-semibold">Frequency</th>
                            <th className="border p-2 text-left font-semibold">Duration</th>
                            <th className="border p-2 text-left font-semibold">Instructions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPrescription.medicines.map((med, i) => (
                            <tr key={i}>
                              <td className="border p-2">{i + 1}</td>
                              <td className="border p-2 font-medium">{med.name}</td>
                              <td className="border p-2">{med.dosage}</td>
                              <td className="border p-2">{med.frequency}</td>
                              <td className="border p-2">{med.duration}</td>
                              <td className="border p-2">As directed</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Lab Tests */}
                    {selectedPrescription.labTests.length > 0 && (
                      <div className="mb-4 p-3 border rounded">
                        <h2 className="font-bold text-sm mb-1 text-primary">LAB TESTS ADVISED</h2>
                        <p className="text-sm">{selectedPrescription.labTests.join(', ')}</p>
                      </div>
                    )}

                    {/* Notes & Advice */}
                    {(selectedPrescription.doctorNotes || selectedPrescription.precautions) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {selectedPrescription.doctorNotes && (
                          <div className="p-3 border rounded">
                            <h2 className="font-bold text-sm mb-1 text-primary">NOTES / ADVICE</h2>
                            <p className="text-sm">{selectedPrescription.doctorNotes}</p>
                          </div>
                        )}
                        {selectedPrescription.precautions && (
                          <div className="p-3 border rounded">
                            <h2 className="font-bold text-sm mb-1 text-primary">PRECAUTIONS / ALLERGIES</h2>
                            <p className="text-sm">{selectedPrescription.precautions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow-up */}
                    <div className="mb-6 p-3 bg-muted/30 border rounded">
                      <p className="text-sm"><span className="font-medium">Follow-up Date:</span> {selectedPrescription.followUpDate && !isNaN(new Date(selectedPrescription.followUpDate).getTime()) ? format(new Date(selectedPrescription.followUpDate), 'MMMM dd, yyyy') : 'To be scheduled'}</p>
                    </div>

                    {/* Footer - Signature & Stamp */}
                    <div className="flex justify-between items-end mt-8 pt-4 border-t">
                      <div className="text-center">
                        <div className="w-32 h-20 border-2 border-dashed border-muted-foreground rounded flex items-center justify-center text-xs text-muted-foreground mb-1">
                          Clinic Stamp
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="w-40 border-b border-black mb-1 h-12"></div>
                        <p className="text-sm font-medium">Doctor's Signature</p>
                        <p className="text-xs text-muted-foreground">{settings.doctorName}</p>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-6 pt-4 border-t text-center">
                      <p className="text-xs text-muted-foreground italic">
                        Please consult your doctor before taking any medicine. Self-medication can be harmful.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This is a computer-generated e-prescription from {settings.clinicName}.
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="p-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCopy(selectedPrescription.generatedText)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownloadPDF(selectedPrescription)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p>Select a prescription to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
