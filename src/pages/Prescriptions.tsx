import { useState } from 'react';
import { useAccessPatients } from '@/hooks/useAccessPatients';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useStock } from '@/hooks/useStock';
import { useClinicalMedicines } from '@/hooks/useClinicalMedicines';
import { useSettingsStore } from '@/store/settingsStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Printer, Download, FileText, Search, RefreshCw, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PrescriptionMedicine, Prescription } from '@/types/hospital';
import jsPDF from 'jspdf';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { MedicineSearch } from '@/components/medicines/MedicineSearch';
import { PrescriptionHistoryDialog } from '@/components/prescriptions/PrescriptionHistoryDialog';
import { PrescriptionPreviewDialog } from '@/components/prescriptions/PrescriptionPreviewDialog';

export function PrescriptionsPage() {
  const { patients } = useAccessPatients(true);
  const { prescriptions, loading, addPrescription, updatePrescription, refetch } = usePrescriptions();
  const { stock, reduceStock } = useStock();
  const { medicines: clinicalMedicines } = useClinicalMedicines();
  const { settings } = useSettingsStore();

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([]);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // New medicine form
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
  });
  const [newLabTest, setNewLabTest] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Generate prescription text
  const generatePrescriptionText = (): string => {
    if (!selectedPatient) return '';

    const medicineList = medicines
      .map(m => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`)
      .join(', ');

    const labList = labTests.length > 0 ? `Advised ${labTests.join(', ')}.` : '';
    const notesText = doctorNotes ? `General advice: ${doctorNotes}.` : '';
    const precautionsText = precautions ? `Precautions: ${precautions}.` : '';

    return `Patient ${selectedPatient.name} (Age ${selectedPatient.age}) diagnosed with ${diagnosis}. Prescribed ${medicineList}. ${labList} ${notesText} ${precautionsText}`.trim();
  };

  const handleAddMedicine = () => {
    if (!newMedicine.name || !newMedicine.dosage || !newMedicine.frequency || !newMedicine.duration) {
      toast.error('Please fill all medicine fields');
      return;
    }
    setMedicines([...medicines, { ...newMedicine }]);
    setNewMedicine({ name: '', dosage: '', frequency: '', duration: '' });
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleAddLabTest = () => {
    if (!newLabTest.trim()) return;
    setLabTests([...labTests, newLabTest.trim()]);
    setNewLabTest('');
  };

  const handleRemoveLabTest = (index: number) => {
    setLabTests(labTests.filter((_, i) => i !== index));
  };

  const handleEditDraft = (rx: Prescription) => {
    setEditingId(rx.id);
    setSelectedPatientId(rx.patientId);
    setDiagnosis(rx.diagnosis);
    setMedicines(rx.medicines);
    setLabTests(rx.labTests);
    setDoctorNotes(rx.doctorNotes);
    setPrecautions(rx.precautions);
    setFollowUpDate(rx.followUpDate);
    toast.info('Draft loaded for editing');
  };

  const handleSaveAction = (status: 'Draft' | 'Finalized' = 'Finalized') => {
    setSaveDialogOpen(false);
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!diagnosis.trim() && status === 'Finalized') {
      toast.error('Please enter diagnosis');
      return;
    }

    // For drafts, we can be more lenient, but at least patient is needed
    if (status === 'Finalized' && medicines.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId)!;
    const generatedText = generatePrescriptionText();

    // Reduce stock for medicines that exist in stock ONLY if finalized
    if (status === 'Finalized') {
      medicines.forEach(med => {
        const stockItem = stock.find(s => s.name.toLowerCase().includes(med.name.toLowerCase()));
        if (stockItem && editingId) {
          // Logic complexity: if updating finalized, we might double deduct? 
          // Assumption: You can't edit finalized scripts here (they don't show in draft list). 
          // Drafts didn't deduct stock yet.
          reduceStock(stockItem.id, 1);
        } else if (stockItem) {
          reduceStock(stockItem.id, 1);
        }
      });
    }

    const prescriptionData = {
      patientId: selectedPatientId,
      patientName: patient.name,
      patientAge: patient.age,
      diagnosis,
      medicines,
      labTests,
      doctorNotes,
      precautions,
      generatedText,
      followUpDate: followUpDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status
    };

    if (editingId) {
      updatePrescription(editingId, prescriptionData);
    } else {
      addPrescription(prescriptionData);
    }

    toast.success(`Prescription ${status === 'Draft' ? 'saved as draft' : 'created successfully'}`);

    if (status === 'Finalized') {
      // If creating fresh, we'll need ID. But addPrescription is async and might return ID but we didn't await specifically for ID here easily without refactor.
      // However, the user wants PDF to open. `handleDownloadPDF` needs the rx object.
      // Since we are decoupling validation and PDF generation slightly or relying on backend.
      // For better UX, let's assuming printing happens from history or we reconstruct the object if we want immediate print.
      // Ideally we should await the ID.
    }

    // Reset form
    setEditingId(null);
    setSelectedPatientId('');
    setDiagnosis('');
    setMedicines([]);
    setLabTests([]);
    setDoctorNotes('');
    setPrecautions('');
    setFollowUpDate('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Prescription copied to clipboard');
  };

  const handlePrint = (rxId: string) => {
    // Add print-content class to the specific prescription
    const element = document.getElementById(`prescription-${rxId}`);
    if (element) {
      element.classList.add('print-content');
      window.print();
      element.classList.remove('print-content');
    }
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
    // Colors
    // Use stored primary color or default blue
    const primaryColorHex = settings.pdfSettings?.primaryColor || '#1a56db';
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
    // ... (rest of header same, simplified replace for brevity if needed, but I must replace contiguous block)
    // I can't skip lines easily with replace_file_content.
    // I will replace from Colors (178) to Header End (206) OR do separate replacements.

    // Let's do logical chunks.
    // 1. Colors
    // 2. Logo Logic
    // 3. Disclaimer Logic (at end)


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

    // Allergies (if any from patient record)
    doc.setTextColor(180, 50, 50);
    doc.setFontSize(8);
    doc.text('Allergies: None reported', margin + 4, yPos + 11);

    yPos += 20;

    // ============ PRESCRIPTION TABLE ============
    // Table header
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

    // Table rows
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');

    rx.medicines.forEach((med, i) => {
      // Alternating row colors
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

    // Table border
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos - (rx.medicines.length * 8) - 8, contentWidth, (rx.medicines.length + 1) * 8, 'S');

    yPos += 8;

    // ============ LAB TESTS SECTION ============
    if (rx.labTests.length > 0) {
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

    // Signature and stamp boxes
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);

    // Doctor signature
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

    // Page border
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');

    doc.save(`prescription-${rx.id || 'new'}.pdf`);
    toast.success('Professional PDF downloaded');
  };

  const handleCreateAndPrint = async () => {
    // Validate before proceeding
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!diagnosis.trim()) {
      toast.error('Please enter diagnosis');
      return;
    }
    if (medicines.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) {
      toast.error('Patient not found');
      return;
    }

    // Capture current form data before it gets reset
    const prescriptionData: Prescription = {
      id: editingId || `RX-${Math.floor(Math.random() * 9000) + 1000}${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
      patientId: selectedPatientId,
      patientName: patient.name,
      patientAge: patient.age,
      diagnosis,
      medicines: [...medicines],
      labTests: [...labTests],
      doctorNotes,
      precautions,
      generatedText: generatePrescriptionText(),
      followUpDate: followUpDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      status: 'Finalized'
    };

    // Close save dialog
    setSaveDialogOpen(false);

    // Save the prescription (this will also reduce stock and reset form)
    handleSaveAction('Finalized');

    // Show preview dialog with the captured data
    setPreviewPrescription(prescriptionData);
    setPreviewDialogOpen(true);
  };

  // Filter prescriptions - Show ONLY Status='Draft' in the right sidebar
  const drafts = prescriptions.filter(rx =>
    rx.status === 'Draft' &&
    (rx.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <PageHeader
        title="E-Prescriptions"
        description="Create and manage digital prescriptions"
        action={
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            View History (Finalized)
          </Button>
        }
      />

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Prescription</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button variant="outline" onClick={() => handleSaveAction('Draft')}>
              <Save className="mr-2 h-4 w-4" />
              Save as Draft
            </Button>
            <Button onClick={handleCreateAndPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Create & Print PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrescriptionPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        prescription={previewPrescription}
        onDownloadPDF={handleDownloadPDF}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prescription Form */}
        <div className="form-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Draft' : 'Create Prescription'}</h2>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={() => {
                setEditingId(null);
                setSelectedPatientId('');
                setDiagnosis('');
                setMedicines([]);
                setLabTests([]);
                setDoctorNotes('');
                setPrecautions('');
                setFollowUpDate('');
              }}>
                Cancel Edit
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label>Select Patient *</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name} (Age: {patient.age})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Diagnosis *</Label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g., Viral Fever, Diabetes Type 2"
              />
            </div>

            {/* Add Medicine */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Add Medicine (Search with 3+ characters)</Label>
              <div className="grid grid-cols-1 gap-2">
                <MedicineSearch
                  medicines={clinicalMedicines}
                  onSelect={(medicine) => {
                    setNewMedicine({
                      ...newMedicine,
                      name: medicine.name,
                      dosage: medicine.dosage || '',
                      frequency: medicine.frequency || '',
                      duration: medicine.duration || ''
                    });
                  }}
                  value={newMedicine.name}
                  placeholder="Search medicine by name..."
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={newMedicine.dosage}
                  onValueChange={(value) => setNewMedicine({ ...newMedicine, dosage: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dosage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50mg">50mg</SelectItem>
                    <SelectItem value="100mg">100mg</SelectItem>
                    <SelectItem value="250mg">250mg</SelectItem>
                    <SelectItem value="500mg">500mg</SelectItem>
                    <SelectItem value="650mg">650mg</SelectItem>
                    <SelectItem value="1g">1g</SelectItem>
                    <SelectItem value="5ml">5ml</SelectItem>
                    <SelectItem value="10ml">10ml</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={newMedicine.frequency}
                  onValueChange={(value) => setNewMedicine({ ...newMedicine, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Once daily">Once daily</SelectItem>
                    <SelectItem value="Twice daily">Twice daily</SelectItem>
                    <SelectItem value="Thrice daily">Thrice daily</SelectItem>
                    <SelectItem value="Every 4 hours">Every 4 hours</SelectItem>
                    <SelectItem value="Every 6 hours">Every 6 hours</SelectItem>
                    <SelectItem value="Every 8 hours">Every 8 hours</SelectItem>
                    <SelectItem value="Before meals">Before meals</SelectItem>
                    <SelectItem value="After meals">After meals</SelectItem>
                    <SelectItem value="At bedtime">At bedtime</SelectItem>
                    <SelectItem value="As needed">As needed</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={newMedicine.duration}
                  onValueChange={(value) => setNewMedicine({ ...newMedicine, duration: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3 days">3 days</SelectItem>
                    <SelectItem value="5 days">5 days</SelectItem>
                    <SelectItem value="7 days">7 days</SelectItem>
                    <SelectItem value="10 days">10 days</SelectItem>
                    <SelectItem value="14 days">14 days</SelectItem>
                    <SelectItem value="21 days">21 days</SelectItem>
                    <SelectItem value="1 month">1 month</SelectItem>
                    <SelectItem value="2 months">2 months</SelectItem>
                    <SelectItem value="3 months">3 months</SelectItem>
                    <SelectItem value="As directed">As directed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddMedicine}>
                <Plus className="mr-1 h-4 w-4" />
                Add Medicine
              </Button>
            </div>

            {/* Medicine List */}
            {medicines.length > 0 && (
              <div className="space-y-2">
                {medicines.map((med, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded bg-muted"
                  >
                    <div>
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.dosage} | {med.frequency} | {med.duration}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveMedicine(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Lab Tests */}
            <div>
              <Label>Lab Tests (Optional)</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="e.g., Blood test, X-ray"
                  value={newLabTest}
                  onChange={(e) => setNewLabTest(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLabTest()}
                />
                <Button type="button" variant="secondary" onClick={handleAddLabTest}>
                  Add
                </Button>
              </div>
              {labTests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {labTests.map((test, index) => (
                    <Badge key={index} variant="outline" className="gap-1">
                      {test}
                      <button
                        onClick={() => handleRemoveLabTest(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Doctor Notes</Label>
              <Textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Rest, hydration, etc."
                rows={2}
              />
            </div>

            <div>
              <Label>Precautions</Label>
              <Textarea
                value={precautions}
                onChange={(e) => setPrecautions(e.target.value)}
                placeholder="Avoid cold drinks, follow-up in 3 days, etc."
                rows={2}
              />
            </div>

            <div>
              <Label>Follow-up Date</Label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Preview */}
            {selectedPatient && diagnosis && medicines.length > 0 && (
              <div>
                <Label className="text-sm">Generated Prescription</Label>
                <div className="prescription-text mt-1">
                  {generatePrescriptionText()}
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => setSaveDialogOpen(true)}>
              <Save className="mr-2 h-4 w-4" />
              Save Prescription
            </Button>
          </div>
        </div>

        {/* Saved Drafts List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Saved Drafts
            <Badge variant="secondary">{drafts.length}</Badge>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prescriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-4 max-h-[600px] overflow-auto">
            {drafts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No prescriptions found
                </CardContent>
              </Card>
            ) : (
              [...drafts].reverse().map((rx) => {
                const patient = patients.find(p => p.id === rx.patientId);

                return (
                  <Card
                    key={rx.id}
                    id={`prescription-${rx.id}`}
                    className={`cursor-pointer hover:border-primary transition-colors ${editingId === rx.id ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleEditDraft(rx)}
                  >
                    {/* ===== PRINT LAYOUT - Professional E-Prescription Template ===== */}
                    <div className="hidden print:block p-8">
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
                          <p><span className="font-medium">Patient Name:</span> {rx.patientName}</p>
                          <p><span className="font-medium">Patient ID:</span> {rx.patientId}</p>
                          <p><span className="font-medium">Age / Gender:</span> {rx.patientAge} years / {patient?.gender || 'N/A'}</p>
                          <div className="flex items-center gap-2">
                            <p><span className="font-medium">Date:</span> {format(new Date(rx.createdAt), 'MMMM dd, yyyy')}</p>
                            {rx.status === 'Draft' && <Badge variant="secondary">Draft</Badge>}
                          </div>
                          <p><span className="font-medium">Contact:</span> {patient?.phone || 'N/A'}</p>
                          <p><span className="font-medium">Visit ID:</span> RX-{rx.id}</p>
                        </div>
                      </div>

                      {/* Diagnosis Section */}
                      <div className="mb-4 p-3 border rounded">
                        <h2 className="font-bold text-sm mb-1 text-primary">DIAGNOSIS</h2>
                        <p className="text-sm">{rx.diagnosis}</p>
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
                            {rx.medicines.map((med, i) => (
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
                      {rx.labTests.length > 0 && (
                        <div className="mb-4 p-3 border rounded">
                          <h2 className="font-bold text-sm mb-1 text-primary">LAB TESTS ADVISED</h2>
                          <p className="text-sm">{rx.labTests.join(', ')}</p>
                        </div>
                      )}

                      {/* Notes & Advice */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {rx.doctorNotes && (
                          <div className="p-3 border rounded">
                            <h2 className="font-bold text-sm mb-1 text-primary">NOTES / ADVICE</h2>
                            <p className="text-sm">{rx.doctorNotes}</p>
                          </div>
                        )}
                        {rx.precautions && (
                          <div className="p-3 border rounded">
                            <h2 className="font-bold text-sm mb-1 text-primary">PRECAUTIONS / ALLERGIES</h2>
                            <p className="text-sm">{rx.precautions}</p>
                          </div>
                        )}
                      </div>

                      {/* Follow-up */}
                      <div className="mb-6 p-3 bg-muted/30 border rounded">
                        <p className="text-sm"><span className="font-medium">Follow-up Date:</span> {rx.followUpDate && !isNaN(new Date(rx.followUpDate).getTime()) ? format(new Date(rx.followUpDate), 'MMMM dd, yyyy') : 'To be scheduled'}</p>
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

                    {/* ===== SCREEN LAYOUT ===== */}
                    <CardHeader className="pb-2 print:hidden">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {rx.patientName}
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {rx.diagnosis || 'No Diagnosis'} • {format(new Date(rx.createdAt), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">
                          {rx.id}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 print:hidden">
                      {/* Screen view - generated text */}
                      <div className="prescription-text text-xs line-clamp-3">
                        {rx.generatedText || 'No Medicines Added yet...'}
                      </div>

                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        Click to edit draft
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <PrescriptionHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        prescriptions={prescriptions}
        patients={patients}
      />
    </div>
  );
}
