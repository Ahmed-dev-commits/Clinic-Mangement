import { useState, useCallback } from 'react';
import { useAccessPatients } from '@/hooks/useAccessPatients';
import { useLabResults } from '@/hooks/useLabResults';
import { useSettingsStore } from '@/store/settingsStore';
import { useSmsNotificationStore } from '@/store/smsNotificationStore';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Printer, Download, Search, FlaskConical, Bell, CheckCircle, Clock, Package, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LabTestResult, LabResult, LabResultStatus } from '@/types/hospital';
import jsPDF from 'jspdf';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SmsNotificationPanel } from '@/components/SmsNotificationPanel';
import { ConnectionStatus } from '@/components/ConnectionStatus';

// Common lab tests with normal ranges
const commonLabTests = [
  { name: 'Hemoglobin', unit: 'g/dL', normalRange: '13.5-17.5 (M) / 12.0-15.5 (F)' },
  { name: 'Blood Sugar (Fasting)', unit: 'mg/dL', normalRange: '70-100' },
  { name: 'Blood Sugar (PP)', unit: 'mg/dL', normalRange: '< 140' },
  { name: 'HbA1c', unit: '%', normalRange: '< 5.7' },
  { name: 'Total Cholesterol', unit: 'mg/dL', normalRange: '< 200' },
  { name: 'HDL Cholesterol', unit: 'mg/dL', normalRange: '> 40' },
  { name: 'LDL Cholesterol', unit: 'mg/dL', normalRange: '< 100' },
  { name: 'Triglycerides', unit: 'mg/dL', normalRange: '< 150' },
  { name: 'Creatinine', unit: 'mg/dL', normalRange: '0.7-1.3' },
  { name: 'Blood Urea', unit: 'mg/dL', normalRange: '7-20' },
  { name: 'Uric Acid', unit: 'mg/dL', normalRange: '3.5-7.2' },
  { name: 'SGOT (AST)', unit: 'U/L', normalRange: '10-40' },
  { name: 'SGPT (ALT)', unit: 'U/L', normalRange: '7-56' },
  { name: 'Bilirubin Total', unit: 'mg/dL', normalRange: '0.1-1.2' },
  { name: 'TSH', unit: 'mIU/L', normalRange: '0.4-4.0' },
  { name: 'T3', unit: 'ng/dL', normalRange: '80-200' },
  { name: 'T4', unit: 'mcg/dL', normalRange: '4.5-12.5' },
  { name: 'Vitamin D', unit: 'ng/mL', normalRange: '30-100' },
  { name: 'Vitamin B12', unit: 'pg/mL', normalRange: '200-900' },
  { name: 'WBC Count', unit: 'cells/mcL', normalRange: '4,500-11,000' },
  { name: 'Platelet Count', unit: 'lakh/mcL', normalRange: '1.5-4.0' },
];

export function LabResultsPage() {
  const { patients } = useAccessPatients(true);
  const { labResults, loading, addLabResult, updateLabResultStatus, notifyPatient, markAsCollected, refetch } = useLabResults();
  const { settings } = useSettingsStore();

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [tests, setTests] = useState<LabTestResult[]>([]);
  const [notes, setNotes] = useState('');
  const [technician, setTechnician] = useState('');

  // New test form
  const [selectedTest, setSelectedTest] = useState('');
  const [testValue, setTestValue] = useState('');
  const [testStatus, setTestStatus] = useState<'Normal' | 'High' | 'Low' | 'Critical'>('Normal');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleAddTest = () => {
    if (!selectedTest || !testValue) {
      toast.error('Please select a test and enter value');
      return;
    }

    const testInfo = commonLabTests.find(t => t.name === selectedTest);
    if (!testInfo) return;

    // Check if test already added
    if (tests.find(t => t.name === selectedTest)) {
      toast.error('This test is already added');
      return;
    }

    setTests([...tests, {
      name: selectedTest,
      value: testValue,
      unit: testInfo.unit,
      normalRange: testInfo.normalRange,
      status: testStatus,
    }]);

    setSelectedTest('');
    setTestValue('');
    setTestStatus('Normal');
  };

  const handleRemoveTest = (index: number) => {
    setTests(tests.filter((_, i) => i !== index));
  };

  // Safe date formatter
  const safeFormatDate = (dateStr: string | undefined, formatStr: string): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatStr);
    } catch {
      return 'N/A';
    }
  };

  const handleSubmit = () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!testDate || isNaN(new Date(testDate).getTime())) {
      toast.error('Please enter a valid sample date');
      return;
    }
    if (tests.length === 0) {
      toast.error('Please add at least one test result');
      return;
    }
    if (!technician.trim()) {
      toast.error('Please enter technician name');
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) {
      toast.error('Selected patient not found');
      return;
    }

    addLabResult({
      patientId: selectedPatientId,
      patientName: patient.name,
      patientAge: patient.age,
      testDate,
      reportDate: new Date().toISOString().split('T')[0],
      tests,
      notes: notes.trim(),
      technician: technician.trim(),
      status: 'Sample Collected',
    });

    toast.success('Lab result added successfully');

    // Reset form
    setSelectedPatientId('');
    setTestDate(new Date().toISOString().split('T')[0]);
    setTests([]);
    setNotes('');
    setTechnician('');
  };

  const handlePrint = (labId: string) => {
    const element = document.getElementById(`lab-${labId}`);
    if (element) {
      element.classList.add('print-content');
      window.print();
      element.classList.remove('print-content');
    }
  };

  const handleDownloadPDF = (lab: LabResult) => {
    const doc = new jsPDF();

    // Set document properties without URLs
    doc.setProperties({
      title: `Lab-Report-${lab.id}`,
      subject: 'Laboratory Report',
      author: settings.clinicName,
      creator: settings.clinicName
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Colors
    const primaryColorHex = settings.pdfSettings?.primaryColor || '#1a56db';
    const r = parseInt(primaryColorHex.slice(1, 3), 16);
    const g = parseInt(primaryColorHex.slice(3, 5), 16);
    const b = parseInt(primaryColorHex.slice(5, 7), 16);
    const primaryColor: [number, number, number] = [r, g, b];

    const textColor: [number, number, number] = [30, 30, 30];
    const mutedColor: [number, number, number] = [100, 100, 100];
    const lineColor: [number, number, number] = [200, 200, 200];
    const greenColor: [number, number, number] = [34, 197, 94];
    const redColor: [number, number, number] = [239, 68, 68];
    const yellowColor: [number, number, number] = [234, 179, 8];

    const patient = patients.find(p => p.id === lab.patientId);

    // ============ HEADER ============
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

    doc.setTextColor(...primaryColor);
    doc.setFontSize(18);
    // ... header text ...
    doc.setFont('helvetica', 'bold');
    doc.text(settings.clinicName, margin + 30, 18);

    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.address, margin + 30, 24);
    doc.text(settings.city, margin + 30, 29);
    doc.text(`Phone: ${settings.phone} | Email: ${settings.email}`, margin + 30, 34);

    // Right side - Lab Report title
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LABORATORY REPORT', pageWidth - margin, 18, { align: 'right' });
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report No: ${lab.id}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Report Date: ${safeFormatDate(lab.reportDate, 'dd MMM yyyy')}`, pageWidth - margin, 30, { align: 'right' });

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(margin, 40, pageWidth - margin, 40);

    // ============ PATIENT INFO ============
    let yPos = 48;

    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, 24, 2, 2, 'S');

    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);

    doc.text('Patient Name:', margin + 4, yPos + 7);
    doc.text('Age / Gender:', margin + 4, yPos + 14);
    doc.text('Patient ID:', margin + 4, yPos + 21);

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(lab.patientName, margin + 28, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${lab.patientAge} years / ${patient?.gender || 'N/A'}`, margin + 28, yPos + 14);
    doc.text(lab.patientId, margin + 28, yPos + 21);

    const rightCol = pageWidth / 2 + 10;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Sample Date:', rightCol, yPos + 7);
    doc.text('Report Date:', rightCol, yPos + 14);
    doc.text('Technician:', rightCol, yPos + 21);

    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(safeFormatDate(lab.testDate, 'dd MMM yyyy'), rightCol + 25, yPos + 7);
    doc.text(safeFormatDate(lab.reportDate, 'dd MMM yyyy'), rightCol + 25, yPos + 14);
    doc.text(lab.technician || 'N/A', rightCol + 25, yPos + 21);

    yPos += 32;

    // ============ TEST RESULTS TABLE ============
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    const colWidths = [55, 30, 25, 40, 30];
    let xPos = margin + 2;

    doc.text('Test Name', xPos, yPos + 5.5);
    xPos += colWidths[0];
    doc.text('Result', xPos, yPos + 5.5);
    xPos += colWidths[1];
    doc.text('Unit', xPos, yPos + 5.5);
    xPos += colWidths[2];
    doc.text('Normal Range', xPos, yPos + 5.5);
    xPos += colWidths[3];
    doc.text('Status', xPos, yPos + 5.5);

    yPos += 8;

    doc.setFont('helvetica', 'normal');

    lab.tests.forEach((test, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
      }

      xPos = margin + 2;
      doc.setTextColor(...textColor);
      doc.text(test.name, xPos, yPos + 5.5);
      xPos += colWidths[0];

      doc.setFont('helvetica', 'bold');
      doc.text(test.value, xPos, yPos + 5.5);
      doc.setFont('helvetica', 'normal');
      xPos += colWidths[1];

      doc.text(test.unit, xPos, yPos + 5.5);
      xPos += colWidths[2];

      doc.text(test.normalRange, xPos, yPos + 5.5);
      xPos += colWidths[3];

      // Status with color
      if (test.status === 'Normal') {
        doc.setTextColor(...greenColor);
      } else if (test.status === 'High' || test.status === 'Low') {
        doc.setTextColor(...yellowColor);
      } else {
        doc.setTextColor(...redColor);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(test.status, xPos, yPos + 5.5);
      doc.setFont('helvetica', 'normal');

      yPos += 8;
    });

    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos - (lab.tests.length * 8) - 8, contentWidth, (lab.tests.length + 1) * 8, 'S');

    yPos += 8;

    // ============ NOTES ============
    if (lab.notes) {
      doc.setDrawColor(...lineColor);
      doc.roundedRect(margin, yPos, contentWidth, 16, 2, 2, 'S');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES / INTERPRETATION:', margin + 4, yPos + 6);
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(lab.notes, contentWidth - 8);
      doc.text(splitNotes, margin + 4, yPos + 12);
      yPos += 22;
    }

    // ============ FOOTER ============
    const footerY = pageHeight - 50;

    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);

    // Technician signature
    doc.rect(margin, footerY, 60, 25, 'S');
    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.text('Lab Technician', margin + 30, footerY + 3, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(margin + 5, footerY + 18, margin + 55, footerY + 18);
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text(lab.technician, margin + 30, footerY + 22, { align: 'center' });

    // Pathologist signature
    doc.setLineWidth(0.3);
    doc.rect(pageWidth - margin - 60, footerY, 60, 25, 'S');
    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.text('Pathologist', pageWidth - margin - 30, footerY + 3, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 55, footerY + 18, pageWidth - margin - 5, footerY + 18);
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text('Dr. Pathologist Name', pageWidth - margin - 30, footerY + 22, { align: 'center' });

    // Disclaimer
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    const disclaimer = settings.pdfSettings?.footerText || 'Note: This report is for clinical correlation only. Please consult your physician for interpretation. Results may vary based on methodology used.';
    const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth);
    doc.text(splitDisclaimer, pageWidth / 2, pageHeight - 14, { align: 'center' });

    // Page border
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');

    doc.save(`lab-report-${lab.id}.pdf`);
    toast.success('Lab report PDF downloaded');
  };

  // Filter lab results
  const filteredLabResults = labResults.filter(lab =>
    lab.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lab.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'bg-green-100 text-green-800';
      case 'High': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      case 'Critical': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getLabStatusColor = (status: LabResultStatus) => {
    switch (status) {
      case 'Sample Collected': return 'bg-blue-100 text-blue-800';
      case 'Processing': return 'bg-yellow-100 text-yellow-800';
      case 'Ready': return 'bg-green-100 text-green-800';
      case 'Notified': return 'bg-purple-100 text-purple-800';
      case 'Collected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getLabStatusIcon = (status: LabResultStatus) => {
    switch (status) {
      case 'Sample Collected': return <Package className="h-3 w-3" />;
      case 'Processing': return <Clock className="h-3 w-3" />;
      case 'Ready': return <CheckCircle className="h-3 w-3" />;
      case 'Notified': return <Bell className="h-3 w-3" />;
      case 'Collected': return <CheckCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const { addNotification, updateStatus } = useSmsNotificationStore();

  const handleNotifyPatient = useCallback(async (lab: LabResult) => {
    const patient = patients.find(p => p.id === lab.patientId);
    if (!patient) {
      toast.error('Patient not found');
      return;
    }

    if (!patient.phone) {
      toast.error('Patient phone number not available');
      return;
    }

    setIsSendingNotification(true);

    const message = `Lab Report Ready: Dear ${patient.name}, your lab report (ID: ${lab.id}) is ready for collection at ${settings.clinicName || 'our clinic'}.`;

    // Add notification to store with 'queued' status
    const smsId = addNotification({
      to: patient.phone,
      patientName: patient.name,
      message,
      status: 'queued',
      labResultId: lab.id,
    });

    // Simulate real-time status updates
    try {
      // Step 1: Queued → Sending (after 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStatus(smsId, 'sending');

      // Step 2: Sending → Delivered (after 1500ms)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate 90% success rate
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        updateStatus(smsId, 'delivered');

        // Log the mock message for debugging
        console.log('📱 Mock SMS delivered:', {
          id: smsId,
          to: patient.phone,
          message,
          timestamp: new Date().toISOString(),
        });

        // Update lab result status
        notifyPatient(lab.id);
        toast.success(`SMS delivered to ${patient.name}`);
      } else {
        updateStatus(smsId, 'failed');
        toast.error('SMS delivery failed. Please try again.');
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      updateStatus(smsId, 'failed');
      toast.error('Failed to send notification. Please try again.');
    } finally {
      setIsSendingNotification(false);
    }
  }, [patients, settings.clinicName, notifyPatient, addNotification, updateStatus]);

  const handleMarkCollected = (labId: string) => {
    markAsCollected(labId);
    toast.success('Lab report marked as collected');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Lab Results"
          description="Record and manage laboratory test results"
        />
        <SmsNotificationPanel />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lab Result Form */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Add Lab Result</h2>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sample Date *</Label>
                <Input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Technician Name *</Label>
                <Input
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="Lab technician name"
                />
              </div>
            </div>

            {/* Add Test */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Add Test Result</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedTest} onValueChange={setSelectedTest}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonLabTests.map((test) => (
                      <SelectItem key={test.name} value={test.name}>
                        {test.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                />
                <Select value={testStatus} onValueChange={(v: 'Normal' | 'High' | 'Low' | 'Critical') => setTestStatus(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" onClick={handleAddTest}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
              {selectedTest && (
                <p className="text-xs text-muted-foreground">
                  Normal Range: {commonLabTests.find(t => t.name === selectedTest)?.normalRange} {commonLabTests.find(t => t.name === selectedTest)?.unit}
                </p>
              )}
            </div>

            {/* Test List */}
            {tests.length > 0 && (
              <div className="space-y-2">
                {tests.map((test, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded bg-muted"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{test.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {test.value} {test.unit} (Normal: {test.normalRange})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(test.status)}>{test.status}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveTest(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Notes / Interpretation</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations or recommendations..."
                rows={2}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit}>
              <FlaskConical className="mr-2 h-4 w-4" />
              Save Lab Result
            </Button>
          </div>
        </div>

        {/* Lab Results History */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lab results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-4 max-h-[600px] overflow-auto">
            {filteredLabResults.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No lab results found
                </CardContent>
              </Card>
            ) : (
              [...filteredLabResults].reverse().map((lab) => {
                const patient = patients.find(p => p.id === lab.patientId);

                return (
                  <Card key={lab.id} id={`lab-${lab.id}`}>
                    {/* ===== PRINT LAYOUT ===== */}
                    <div className="hidden print:block p-8">
                      {/* Header */}
                      <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
                        <div className="flex items-start gap-4">
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
                            <p className="text-sm text-muted-foreground">Phone: {settings.phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <h2 className="text-xl font-bold text-primary">LABORATORY REPORT</h2>
                          <p className="text-sm text-muted-foreground">Report No: {lab.id}</p>
                          <p className="text-sm text-muted-foreground">Date: {safeFormatDate(lab.reportDate, 'MMMM dd, yyyy')}</p>
                        </div>
                      </div>

                      {/* Patient Details */}
                      <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
                        <h2 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h2>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <p><span className="font-medium">Patient Name:</span> {lab.patientName}</p>
                          <p><span className="font-medium">Sample Date:</span> {safeFormatDate(lab.testDate, 'dd MMM yyyy')}</p>
                          <p><span className="font-medium">Age / Gender:</span> {lab.patientAge} years / {patient?.gender || 'N/A'}</p>
                          <p><span className="font-medium">Report Date:</span> {safeFormatDate(lab.reportDate, 'dd MMM yyyy')}</p>
                          <p><span className="font-medium">Patient ID:</span> {lab.patientId}</p>
                          <p><span className="font-medium">Technician:</span> {lab.technician}</p>
                        </div>
                      </div>

                      {/* Test Results Table */}
                      <div className="mb-4">
                        <h2 className="font-bold text-sm mb-2 text-primary">TEST RESULTS</h2>
                        <table className="w-full border-collapse border text-sm">
                          <thead>
                            <tr className="bg-primary/10">
                              <th className="border p-2 text-left font-semibold">Test Name</th>
                              <th className="border p-2 text-center font-semibold">Result</th>
                              <th className="border p-2 text-center font-semibold">Unit</th>
                              <th className="border p-2 text-center font-semibold">Normal Range</th>
                              <th className="border p-2 text-center font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lab.tests.map((test, i) => (
                              <tr key={i}>
                                <td className="border p-2">{test.name}</td>
                                <td className="border p-2 text-center font-bold">{test.value}</td>
                                <td className="border p-2 text-center">{test.unit}</td>
                                <td className="border p-2 text-center">{test.normalRange}</td>
                                <td className={`border p-2 text-center font-medium ${test.status === 'Normal' ? 'text-green-600' :
                                  test.status === 'Critical' ? 'text-red-600' : 'text-yellow-600'
                                  }`}>{test.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Notes */}
                      {lab.notes && (
                        <div className="mb-4 p-3 border rounded">
                          <h2 className="font-bold text-sm mb-1 text-primary">NOTES / INTERPRETATION</h2>
                          <p className="text-sm">{lab.notes}</p>
                        </div>
                      )}

                      {/* Signatures */}
                      <div className="flex justify-between items-end mt-8 pt-4 border-t">
                        <div className="text-center">
                          <div className="w-40 border-b border-black mb-1 h-12"></div>
                          <p className="text-sm font-medium">Lab Technician</p>
                          <p className="text-xs text-muted-foreground">{lab.technician}</p>
                        </div>
                        <div className="text-center">
                          <div className="w-40 border-b border-black mb-1 h-12"></div>
                          <p className="text-sm font-medium">Pathologist</p>
                          <p className="text-xs text-muted-foreground">Dr. Pathologist Name</p>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="mt-6 pt-4 border-t text-center">
                        <p className="text-xs text-muted-foreground italic">
                          This report is for clinical correlation only. Please consult your physician for interpretation.
                        </p>
                      </div>
                    </div>

                    {/* ===== SCREEN LAYOUT ===== */}
                    <CardHeader className="pb-2 print:hidden">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{lab.patientName}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {safeFormatDate(lab.testDate, 'MMM dd, yyyy')} • {lab.tests.length} tests
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge variant="outline" className="font-mono text-xs">
                            {lab.id}
                          </Badge>
                          <Badge className={`text-xs flex items-center gap-1 ${getLabStatusColor(lab.status || 'Sample Collected')}`}>
                            {getLabStatusIcon(lab.status || 'Sample Collected')}
                            {lab.status || 'Sample Collected'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 print:hidden">
                      {/* Status workflow buttons */}
                      <div className="flex flex-wrap gap-2 pb-2 border-b">
                        <Select
                          value={lab.status || 'Sample Collected'}
                          onValueChange={(v: LabResultStatus) => updateLabResultStatus(lab.id, v)}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Update Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sample Collected">Sample Collected</SelectItem>
                            <SelectItem value="Processing">Processing</SelectItem>
                            <SelectItem value="Ready">Ready</SelectItem>
                          </SelectContent>
                        </Select>

                        {lab.status === 'Ready' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="default" className="h-8 text-xs bg-green-600 hover:bg-green-700">
                                <Bell className="mr-1 h-3 w-3" />
                                Notify Patient
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Notify Patient</DialogTitle>
                                <DialogDescription>
                                  Send notification to patient that their lab report is ready for collection.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <p className="text-sm"><strong>Patient:</strong> {lab.patientName}</p>
                                  <p className="text-sm"><strong>Phone:</strong> {patients.find(p => p.id === lab.patientId)?.phone}</p>
                                  <p className="text-sm"><strong>Report ID:</strong> {lab.id}</p>
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium text-blue-800">SMS Message Preview:</p>
                                      <p className="text-sm text-blue-700 mt-1">
                                        Lab Report Ready: Dear {lab.patientName}, your lab report (ID: {lab.id}) is ready for collection at {settings.clinicName || 'our clinic'}.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="default"
                                  onClick={() => handleNotifyPatient(lab)}
                                  disabled={isSendingNotification}
                                >
                                  {isSendingNotification ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Bell className="mr-2 h-4 w-4" />
                                      Send SMS
                                    </>
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}

                        {lab.status === 'Notified' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => handleMarkCollected(lab.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Mark Collected
                          </Button>
                        )}

                        {lab.notifiedAt && (
                          <span className="text-xs text-muted-foreground flex items-center">
                            Notified: {safeFormatDate(lab.notifiedAt, 'MMM dd, HH:mm')}
                          </span>
                        )}
                        {lab.collectedAt && (
                          <span className="text-xs text-muted-foreground flex items-center">
                            Collected: {safeFormatDate(lab.collectedAt, 'MMM dd, HH:mm')}
                          </span>
                        )}
                      </div>

                      {/* Test summary */}
                      <div className="space-y-1">
                        {lab.tests.slice(0, 3).map((test, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{test.name}</span>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{test.value} {test.unit}</span>
                              <Badge className={`text-xs ${getStatusColor(test.status)}`}>{test.status}</Badge>
                            </span>
                          </div>
                        ))}
                        {lab.tests.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{lab.tests.length - 3} more tests</p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(lab.id)}
                        >
                          <Printer className="mr-1 h-3 w-3" />
                          Print
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(lab)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
