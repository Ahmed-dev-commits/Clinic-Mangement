import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { useSettingsStore } from '@/store/settingsStore';
import { ServicesState, PatientServices } from '@/types/services';
import { Patient } from '@/types/hospital';
import jsPDF from 'jspdf';

interface ServiceReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: PatientServices | null;
  patient: Patient | null;
}

// Helper function to convert number to words
const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  return convert(Math.floor(num));
};

export function ServiceReceiptDialog({ open, onOpenChange, service, patient }: ServiceReceiptDialogProps) {
  const { settings } = useSettingsStore();
  const [isPrinting, setIsPrinting] = useState(false);

  if (!service || !patient) return null;

  const servicesData: ServicesState = typeof service.services === 'string'
    ? JSON.parse(service.services)
    : service.services as ServicesState;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      const element = document.getElementById('service-receipt-print');
      if (element) {
        element.classList.add('print-content');
        window.print();
        element.classList.remove('print-content');
      }
      setIsPrinting(false);
    }, 100);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    doc.setProperties({
      title: `Service-Receipt-${service.id}`,
      subject: 'Service Receipt',
      author: settings.clinicName,
      creator: settings.clinicName
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    const primaryColor: [number, number, number] = [26, 86, 219];
    const textColor: [number, number, number] = [30, 30, 30];
    const mutedColor: [number, number, number] = [100, 100, 100];
    const lineColor: [number, number, number] = [200, 200, 200];

    // Header with Logo
    if (settings.logo) {
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
    } else {
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, 10, 25, 25, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('LOGO', margin + 12.5, 25, { align: 'center' });
    }

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

    // Title
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICE RECEIPT', pageWidth - margin, 18, { align: 'right' });
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${service.id}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Date: ${format(new Date(service.createdAt), 'dd MMM yyyy')}`, pageWidth - margin, 30, { align: 'right' });

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(margin, 40, pageWidth - margin, 40);

    // Patient Info Box
    let yPos = 48;
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'S');

    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Patient Name:', margin + 4, yPos + 7);
    doc.text('Age / Gender:', margin + 4, yPos + 14);

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(patient.name, margin + 28, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${patient.age} years / ${patient.gender}`, margin + 28, yPos + 14);

    const rightCol = pageWidth / 2 + 10;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Patient ID:', rightCol, yPos + 7);
    doc.text('Contact:', rightCol, yPos + 14);

    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(patient.id, rightCol + 22, yPos + 7);
    doc.text(patient.phone || 'N/A', rightCol + 22, yPos + 14);

    // Services Table
    yPos = 78;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES PROVIDED', margin, yPos);
    yPos += 8;

    // Table header
    doc.setFillColor(240, 247, 255);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setDrawColor(...lineColor);
    doc.rect(margin, yPos, contentWidth, 8, 'S');

    doc.setTextColor(...textColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', margin + 3, yPos + 5.5);
    doc.text('Service Description', margin + 12, yPos + 5.5);
    doc.text('Details', margin + 90, yPos + 5.5);
    doc.text('Amount (Rs.)', pageWidth - margin - 25, yPos + 5.5);

    yPos += 8;
    let rowNum = 1;

    doc.setFont('helvetica', 'normal');

    // Add each enabled service
    const addServiceRow = (description: string, details: string, amount: number) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setDrawColor(...lineColor);
      doc.rect(margin, yPos, contentWidth, 8, 'S');

      doc.setTextColor(...textColor);
      doc.setFontSize(8);
      doc.text(String(rowNum), margin + 3, yPos + 5.5);
      doc.text(description, margin + 12, yPos + 5.5);
      doc.text(details.substring(0, 40), margin + 90, yPos + 5.5);
      doc.text(amount.toFixed(2), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

      yPos += 8;
      rowNum++;
    };

    if (servicesData.consultation?.enabled) {
      addServiceRow(
        'Consultation Fee',
        `${servicesData.consultation.type} - Dr. ${servicesData.consultation.doctorName}`,
        servicesData.consultation.fee
      );
    }

    if (servicesData.ultrasound?.enabled) {
      addServiceRow('Ultrasound', servicesData.ultrasound.type, servicesData.ultrasound.charges);
    }

    if (servicesData.ecg?.enabled) {
      addServiceRow('ECG', servicesData.ecg.type, servicesData.ecg.charges);
    }

    if (servicesData.bpReading?.enabled) {
      addServiceRow('BP Reading', `${servicesData.bpReading.systolic}/${servicesData.bpReading.diastolic}`, 0);
    }

    if (servicesData.injection?.enabled) {
      addServiceRow(
        'Injection',
        `${servicesData.injection.type} - ${servicesData.injection.name} x${servicesData.injection.quantity}`,
        servicesData.injection.charges
      );
    }

    if (servicesData.retention?.enabled) {
      addServiceRow('Retention', servicesData.retention.duration, servicesData.retention.charges);
    }

    if (servicesData.surgery?.enabled) {
      const surgeryTotal = servicesData.surgery.operationCharges +
        servicesData.surgery.otCharges +
        servicesData.surgery.anesthesiaCharges;
      addServiceRow(
        'Surgery',
        `${servicesData.surgery.type} - Dr. ${servicesData.surgery.surgeonName}`,
        surgeryTotal
      );
    }

    if (servicesData.feeCollection?.labFee > 0) {
      addServiceRow('Laboratory Fee', 'Lab Tests', servicesData.feeCollection.labFee);
    }

    if (servicesData.feeCollection?.medicines?.length > 0) {
      const medicineFee = servicesData.feeCollection.medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);
      addServiceRow('Medicines', `${servicesData.feeCollection.medicines.length} items`, medicineFee);
    }

    // Total Section
    yPos += 5;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('GRAND TOTAL:', pageWidth - margin - 55, yPos);
    doc.text(`Rs. ${Number(service.grandTotal).toFixed(2)}`, pageWidth - margin - 5, yPos, { align: 'right' });

    // Amount in Words
    yPos += 12;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Amount in Words: Rupees ${numberToWords(Number(service.grandTotal))} Only`, margin + 4, yPos + 8);

    // Payment Mode
    yPos += 18;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.text(`Payment Mode: ${servicesData.feeCollection?.paymentMode || 'Cash'}`, margin, yPos);
    doc.text(`Status: ${service.status}`, pageWidth - margin - 30, yPos);

    // Signature Section
    yPos += 20;
    doc.setDrawColor(...lineColor);

    doc.line(margin, yPos + 15, margin + 50, yPos + 15);
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Patient Signature', margin + 10, yPos + 22);

    doc.line(pageWidth - margin - 50, yPos + 15, pageWidth - margin, yPos + 15);
    doc.text('Authorized Signature', pageWidth - margin - 40, yPos + 22);

    // Footer
    yPos += 35;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    yPos += 6;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text(`Thank you for choosing ${settings.clinicName}!`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text('This is a computer-generated receipt and is valid without signature.', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text(`For queries: ${settings.phone} | ${settings.email}`, pageWidth / 2, yPos, { align: 'center' });

    doc.save(`Service-Receipt-${service.id}.pdf`);
  };

  // Build service items for display
  const serviceItems: { description: string; details: string; amount: number }[] = [];

  if (servicesData.consultation?.enabled) {
    serviceItems.push({
      description: 'Consultation Fee',
      details: `${servicesData.consultation.type} - Dr. ${servicesData.consultation.doctorName}`,
      amount: servicesData.consultation.fee
    });
  }

  if (servicesData.ultrasound?.enabled) {
    serviceItems.push({
      description: 'Ultrasound',
      details: servicesData.ultrasound.type,
      amount: servicesData.ultrasound.charges
    });
  }

  if (servicesData.ecg?.enabled) {
    serviceItems.push({
      description: 'ECG',
      details: servicesData.ecg.type,
      amount: servicesData.ecg.charges
    });
  }

  if (servicesData.bpReading?.enabled) {
    serviceItems.push({
      description: 'BP Reading',
      details: `${servicesData.bpReading.systolic}/${servicesData.bpReading.diastolic} mmHg, Pulse: ${servicesData.bpReading.pulse}`,
      amount: 0
    });
  }

  if (servicesData.injection?.enabled) {
    serviceItems.push({
      description: 'Injection',
      details: `${servicesData.injection.type} - ${servicesData.injection.name} x${servicesData.injection.quantity}`,
      amount: servicesData.injection.charges
    });
  }

  if (servicesData.retention?.enabled) {
    serviceItems.push({
      description: 'Retention',
      details: servicesData.retention.duration,
      amount: servicesData.retention.charges
    });
  }

  if (servicesData.surgery?.enabled) {
    const surgeryTotal = servicesData.surgery.operationCharges +
      servicesData.surgery.otCharges +
      servicesData.surgery.anesthesiaCharges;
    serviceItems.push({
      description: 'Surgery',
      details: `${servicesData.surgery.type} - Dr. ${servicesData.surgery.surgeonName}`,
      amount: surgeryTotal
    });
  }

  if (servicesData.feeCollection?.labFee > 0) {
    serviceItems.push({
      description: 'Laboratory Fee',
      details: 'Lab Tests',
      amount: servicesData.feeCollection.labFee
    });
  }

  if (servicesData.feeCollection?.medicines?.length > 0) {
    const medicineFee = servicesData.feeCollection.medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);
    serviceItems.push({
      description: 'Medicines',
      details: `${servicesData.feeCollection.medicines.length} items dispensed`,
      amount: medicineFee
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Service Receipt</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="default" size="sm" onClick={handleDownloadPDF}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Screen Preview */}
        <div className="border rounded-lg p-6 bg-background">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
            <div className="flex items-start gap-4">
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg" />
              ) : (
                <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
                  LOGO
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-primary">{settings.clinicName}</h1>
                <p className="text-sm text-muted-foreground">{settings.address}</p>
                <p className="text-sm text-muted-foreground">{settings.city}</p>
                <p className="text-sm text-muted-foreground">Phone: {settings.phone}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-primary">SERVICE RECEIPT</h2>
              <p className="text-sm text-muted-foreground">Receipt No: {service.id}</p>
              <p className="text-sm text-muted-foreground">Date: {format(new Date(service.createdAt), 'MMMM dd, yyyy')}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
            <h3 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="font-medium">Name:</span> {patient.name}</p>
              <p><span className="font-medium">Patient ID:</span> {patient.id}</p>
              <p><span className="font-medium">Age / Gender:</span> {patient.age} years / {patient.gender}</p>
              <p><span className="font-medium">Contact:</span> {patient.phone}</p>
            </div>
          </div>

          {/* Services Table */}
          <div className="mb-4">
            <h3 className="font-bold text-sm mb-2 text-primary">SERVICES PROVIDED</h3>
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-primary/10">
                  <th className="border p-2 text-left font-semibold w-8">#</th>
                  <th className="border p-2 text-left font-semibold">Service</th>
                  <th className="border p-2 text-left font-semibold">Details</th>
                  <th className="border p-2 text-right font-semibold w-28">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {serviceItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2 font-medium">{item.description}</td>
                    <td className="border p-2 text-muted-foreground">{item.details}</td>
                    <td className="border p-2 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Medicines Detail */}
          {servicesData.feeCollection?.medicines?.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-sm mb-2 text-primary">MEDICINES DISPENSED</h3>
              <table className="w-full border-collapse border text-sm">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="border p-2 text-left font-semibold w-8">#</th>
                    <th className="border p-2 text-left font-semibold">Medicine</th>
                    <th className="border p-2 text-center font-semibold w-16">Qty</th>
                    <th className="border p-2 text-right font-semibold w-24">Rate</th>
                    <th className="border p-2 text-right font-semibold w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesData.feeCollection.medicines.map((m, index) => (
                    <tr key={index}>
                      <td className="border p-2">{index + 1}</td>
                      <td className="border p-2">{m.name}</td>
                      <td className="border p-2 text-center">{m.quantity}</td>
                      <td className="border p-2 text-right">{Number(m.price).toFixed(2)}</td>
                      <td className="border p-2 text-right">{(Number(m.price) * Number(m.quantity)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total Section */}
          <div className="flex justify-end mb-4">
            <div className="w-64 border rounded overflow-hidden">
              <div className="flex justify-between p-3 bg-primary/10 font-bold text-lg">
                <span>GRAND TOTAL:</span>
                <span className="text-primary">Rs. {Number(service.grandTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 text-sm bg-muted/50">
                <span>Payment Mode:</span>
                <Badge variant="outline">{servicesData.feeCollection?.paymentMode || 'Cash'}</Badge>
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="mb-4 p-3 border rounded bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">Amount in Words:</span> Rupees {numberToWords(Number(service.grandTotal))} Only
            </p>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p className="font-medium mb-1">Thank you for choosing {settings.clinicName}!</p>
            <p>This is a computer-generated receipt and is valid without signature.</p>
          </div>
        </div>

        {/* Print Layout */}
        <div id="service-receipt-print" className="hidden print:block p-8">
          {/* Same content as screen but optimized for print */}
          <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
            <div className="flex items-start gap-4">
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg" />
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
              <h2 className="text-xl font-bold text-primary">SERVICE RECEIPT</h2>
              <p className="text-sm text-muted-foreground">Receipt No: {service.id}</p>
              <p className="text-sm text-muted-foreground">Date: {format(new Date(service.createdAt), 'MMMM dd, yyyy')}</p>
              <p className="text-sm text-muted-foreground">Time: {format(new Date(service.createdAt), 'hh:mm a')}</p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
            <h2 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="font-medium">Patient Name:</span> {patient.name}</p>
              <p><span className="font-medium">Patient ID:</span> {patient.id}</p>
              <p><span className="font-medium">Age / Gender:</span> {patient.age} years / {patient.gender}</p>
              <p><span className="font-medium">Contact:</span> {patient.phone}</p>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-bold text-sm mb-2 text-primary">SERVICES PROVIDED</h2>
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-primary/10">
                  <th className="border p-2 text-left font-semibold">#</th>
                  <th className="border p-2 text-left font-semibold">Service Description</th>
                  <th className="border p-2 text-left font-semibold">Details</th>
                  <th className="border p-2 text-right font-semibold">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {serviceItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2">{item.description}</td>
                    <td className="border p-2">{item.details}</td>
                    <td className="border p-2 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {servicesData.feeCollection?.medicines?.length > 0 && (
            <div className="mb-4">
              <h2 className="font-bold text-sm mb-2 text-primary">MEDICINES DISPENSED</h2>
              <table className="w-full border-collapse border text-sm">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="border p-2 text-left font-semibold">#</th>
                    <th className="border p-2 text-left font-semibold">Medicine Name</th>
                    <th className="border p-2 text-center font-semibold">Quantity</th>
                    <th className="border p-2 text-right font-semibold">Unit Price (Rs.)</th>
                    <th className="border p-2 text-right font-semibold">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesData.feeCollection.medicines.map((m, index) => (
                    <tr key={index}>
                      <td className="border p-2">{index + 1}</td>
                      <td className="border p-2">{m.name}</td>
                      <td className="border p-2 text-center">{m.quantity}</td>
                      <td className="border p-2 text-right">{Number(m.price).toFixed(2)}</td>
                      <td className="border p-2 text-right">{(Number(m.price) * Number(m.quantity)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mb-6">
            <div className="w-64 border rounded">
              <div className="flex justify-between p-2 bg-primary/10 font-bold">
                <span>GRAND TOTAL:</span>
                <span>Rs. {Number(service.grandTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 text-sm bg-muted/50">
                <span>Payment Mode:</span>
                <span className="font-medium">{servicesData.feeCollection?.paymentMode || 'Cash'}</span>
              </div>
            </div>
          </div>

          <div className="mb-6 p-3 border rounded bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">Amount in Words:</span> Rupees {numberToWords(Number(service.grandTotal))} Only
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-8 mb-6">
            <div className="text-center">
              <div className="border-2 border-dashed border-muted-foreground/30 h-20 mb-2 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Patient Signature</span>
              </div>
              <p className="text-sm font-medium">Received By</p>
            </div>
            <div className="text-center">
              <div className="border-2 border-dashed border-muted-foreground/30 h-20 mb-2 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Authorized Signature & Stamp</span>
              </div>
              <p className="text-sm font-medium">For {settings.clinicName}</p>
            </div>
          </div>

          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p className="font-medium mb-1">Thank you for choosing {settings.clinicName}!</p>
            <p>This is a computer-generated receipt and is valid without signature.</p>
            <p className="mt-1">For any queries, please contact: {settings.phone} | {settings.email}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
