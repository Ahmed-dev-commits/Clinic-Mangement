import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useSettingsStore } from '@/store/settingsStore';
import { Payment, Patient } from '@/types/hospital';
import jsPDF from 'jspdf';

interface PaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
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

export function PaymentReceiptDialog({ open, onOpenChange, payment, patient }: PaymentReceiptDialogProps) {
  const { settings } = useSettingsStore();

  if (!payment) return null;

  const handlePrint = () => {
    const element = document.getElementById('payment-receipt-print');
    if (element) {
      element.classList.add('print-content');
      window.print();
      element.classList.remove('print-content');
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    doc.setProperties({
      title: `Payment-Receipt-${payment.id}`,
      subject: 'Payment Receipt',
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
    doc.text('PAYMENT RECEIPT', pageWidth - margin, 18, { align: 'right' });
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${payment.id}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Date: ${format(new Date(payment.createdAt), 'dd MMM yyyy')}`, pageWidth - margin, 30, { align: 'right' });

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
    doc.text('Patient ID:', margin + 4, yPos + 14);

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(payment.patientName, margin + 28, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(payment.patientId, margin + 28, yPos + 14);

    if (patient) {
      const rightCol = pageWidth / 2 + 10;
      doc.setTextColor(...mutedColor);
      doc.setFontSize(8);
      doc.text('Age / Gender:', rightCol, yPos + 7);
      doc.text('Contact:', rightCol, yPos + 14);

      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.text(`${patient.age} years / ${patient.gender}`, rightCol + 25, yPos + 7);
      doc.text(patient.phone || 'N/A', rightCol + 25, yPos + 14);
    }

    // Charges Table
    yPos = 78;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CHARGES BREAKDOWN', margin, yPos);
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
    doc.text('Description', margin + 12, yPos + 5.5);
    doc.text('Qty', margin + 100, yPos + 5.5);
    doc.text('Rate (Rs.)', margin + 120, yPos + 5.5);
    doc.text('Amount (Rs.)', pageWidth - margin - 25, yPos + 5.5);

    yPos += 8;
    let rowNum = 1;

    doc.setFont('helvetica', 'normal');

    // Consultation Fee
    if (payment.consultationFee > 0) {
      doc.setDrawColor(...lineColor);
      doc.rect(margin, yPos, contentWidth, 8, 'S');
      doc.setTextColor(...textColor);
      doc.setFontSize(8);
      doc.text(String(rowNum), margin + 3, yPos + 5.5);
      doc.text('Consultation Fee', margin + 12, yPos + 5.5);
      doc.text('1', margin + 100, yPos + 5.5);
      doc.text(Number(payment.consultationFee).toFixed(2), margin + 120, yPos + 5.5);
      doc.text(Number(payment.consultationFee).toFixed(2), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });
      yPos += 8;
      rowNum++;
    }

    // Lab Fee
    if (payment.labFee > 0) {
      doc.setDrawColor(...lineColor);
      doc.rect(margin, yPos, contentWidth, 8, 'S');
      doc.setTextColor(...textColor);
      doc.setFontSize(8);
      doc.text(String(rowNum), margin + 3, yPos + 5.5);
      doc.text('Laboratory Fee', margin + 12, yPos + 5.5);
      doc.text('1', margin + 100, yPos + 5.5);
      doc.text(Number(payment.labFee).toFixed(2), margin + 120, yPos + 5.5);
      doc.text(Number(payment.labFee).toFixed(2), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });
      yPos += 8;
      rowNum++;
    }

    // Medicines
    if (payment.medicines && payment.medicines.length > 0) {
      yPos += 5;
      doc.setTextColor(...primaryColor);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('MEDICINES DISPENSED', margin, yPos);
      yPos += 8;

      // Medicine table header
      doc.setFillColor(240, 247, 255);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.setDrawColor(...lineColor);
      doc.rect(margin, yPos, contentWidth, 8, 'S');

      doc.setTextColor(...textColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 3, yPos + 5.5);
      doc.text('Medicine Name', margin + 12, yPos + 5.5);
      doc.text('Qty', margin + 100, yPos + 5.5);
      doc.text('Rate (Rs.)', margin + 120, yPos + 5.5);
      doc.text('Amount (Rs.)', pageWidth - margin - 25, yPos + 5.5);

      yPos += 8;
      doc.setFont('helvetica', 'normal');

      payment.medicines.forEach((m: any, index: number) => {
        doc.setDrawColor(...lineColor);
        doc.rect(margin, yPos, contentWidth, 8, 'S');
        doc.setTextColor(...textColor);
        doc.setFontSize(8);
        doc.text(String(index + 1), margin + 3, yPos + 5.5);
        doc.text(m.name.substring(0, 35), margin + 12, yPos + 5.5);
        doc.text(String(m.quantity), margin + 100, yPos + 5.5);
        doc.text(Number(m.price).toFixed(2), margin + 120, yPos + 5.5);
        doc.text((Number(m.price) * Number(m.quantity)).toFixed(2), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });
        yPos += 8;
      });
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
    doc.text('TOTAL AMOUNT:', pageWidth - margin - 55, yPos);
    doc.text(`Rs. ${Number(payment.totalAmount).toFixed(2)}`, pageWidth - margin - 5, yPos, { align: 'right' });

    // Amount in Words
    yPos += 12;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Amount in Words: Rupees ${numberToWords(Number(payment.totalAmount))} Only`, margin + 4, yPos + 8);

    // Payment Mode
    yPos += 18;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.text(`Payment Mode: ${payment.paymentMode}`, margin, yPos);

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

    doc.save(`Payment-Receipt-${payment.id}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Payment Receipt</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
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
              <h2 className="text-lg font-bold text-primary">PAYMENT RECEIPT</h2>
              <p className="text-sm text-muted-foreground">Receipt No: {payment.id}</p>
              <p className="text-sm text-muted-foreground">Date: {format(new Date(payment.createdAt), 'MMMM dd, yyyy')}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
            <h3 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="font-medium">Name:</span> {payment.patientName}</p>
              <p><span className="font-medium">Patient ID:</span> {payment.patientId}</p>
              {patient && (
                <>
                  <p><span className="font-medium">Age / Gender:</span> {patient.age} years / {patient.gender}</p>
                  <p><span className="font-medium">Contact:</span> {patient.phone}</p>
                </>
              )}
            </div>
          </div>

          {/* Charges Table */}
          <div className="mb-4">
            <h3 className="font-bold text-sm mb-2 text-primary">CHARGES BREAKDOWN</h3>
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-primary/10">
                  <th className="border p-2 text-left font-semibold w-8">#</th>
                  <th className="border p-2 text-left font-semibold">Description</th>
                  <th className="border p-2 text-center font-semibold w-16">Qty</th>
                  <th className="border p-2 text-right font-semibold w-24">Rate</th>
                  <th className="border p-2 text-right font-semibold w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payment.consultationFee > 0 && (
                  <tr>
                    <td className="border p-2">1</td>
                    <td className="border p-2">Consultation Fee</td>
                    <td className="border p-2 text-center">1</td>
                    <td className="border p-2 text-right">{Number(payment.consultationFee).toFixed(2)}</td>
                    <td className="border p-2 text-right">{Number(payment.consultationFee).toFixed(2)}</td>
                  </tr>
                )}
                {payment.labFee > 0 && (
                  <tr>
                    <td className="border p-2">{payment.consultationFee > 0 ? 2 : 1}</td>
                    <td className="border p-2">Laboratory Fee</td>
                    <td className="border p-2 text-center">1</td>
                    <td className="border p-2 text-right">{Number(payment.labFee).toFixed(2)}</td>
                    <td className="border p-2 text-right">{Number(payment.labFee).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Medicines Table */}
          {payment.medicines && payment.medicines.length > 0 && (
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
                  {payment.medicines.map((m: any, index: number) => (
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
              {payment.consultationFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Consultation Fee:</span>
                  <span>Rs. {Number(payment.consultationFee).toFixed(2)}</span>
                </div>
              )}
              {payment.labFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Lab Fee:</span>
                  <span>Rs. {Number(payment.labFee).toFixed(2)}</span>
                </div>
              )}
              {payment.medicineFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Medicine Fee:</span>
                  <span>Rs. {Number(payment.medicineFee).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between p-3 bg-primary/10 font-bold text-lg">
                <span>TOTAL:</span>
                <span className="text-primary">Rs. {Number(payment.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 text-sm bg-muted/50">
                <span>Payment Mode:</span>
                <Badge variant="outline">{payment.paymentMode}</Badge>
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="mb-4 p-3 border rounded bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">Amount in Words:</span> Rupees {numberToWords(Number(payment.totalAmount))} Only
            </p>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p className="font-medium mb-1">Thank you for choosing {settings.clinicName}!</p>
            <p>This is a computer-generated receipt and is valid without signature.</p>
          </div>
        </div>

        {/* Print Layout */}
        <div id="payment-receipt-print" className="hidden print:block p-8">
          {/* Print-optimized content - same structure as screen */}
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
              <h2 className="text-xl font-bold text-primary">PAYMENT RECEIPT</h2>
              <p className="text-sm text-muted-foreground">Receipt No: {payment.id}</p>
              <p className="text-sm text-muted-foreground">Date: {format(new Date(payment.createdAt), 'MMMM dd, yyyy')}</p>
              <p className="text-sm text-muted-foreground">Time: {format(new Date(payment.createdAt), 'hh:mm a')}</p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg mb-4 border">
            <h2 className="font-bold text-sm mb-2 text-primary">PATIENT INFORMATION</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="font-medium">Patient Name:</span> {payment.patientName}</p>
              <p><span className="font-medium">Patient ID:</span> {payment.patientId}</p>
              {patient && (
                <>
                  <p><span className="font-medium">Age / Gender:</span> {patient.age} years / {patient.gender}</p>
                  <p><span className="font-medium">Contact:</span> {patient.phone}</p>
                </>
              )}
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-bold text-sm mb-2 text-primary">CHARGES BREAKDOWN</h2>
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-primary/10">
                  <th className="border p-2 text-left font-semibold">#</th>
                  <th className="border p-2 text-left font-semibold">Description</th>
                  <th className="border p-2 text-center font-semibold">Qty</th>
                  <th className="border p-2 text-right font-semibold">Rate (Rs.)</th>
                  <th className="border p-2 text-right font-semibold">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {payment.consultationFee > 0 && (
                  <tr>
                    <td className="border p-2">1</td>
                    <td className="border p-2">Consultation Fee</td>
                    <td className="border p-2 text-center">1</td>
                    <td className="border p-2 text-right">{Number(payment.consultationFee).toFixed(2)}</td>
                    <td className="border p-2 text-right">{Number(payment.consultationFee).toFixed(2)}</td>
                  </tr>
                )}
                {payment.labFee > 0 && (
                  <tr>
                    <td className="border p-2">{payment.consultationFee > 0 ? 2 : 1}</td>
                    <td className="border p-2">Laboratory Fee</td>
                    <td className="border p-2 text-center">1</td>
                    <td className="border p-2 text-right">{Number(payment.labFee).toFixed(2)}</td>
                    <td className="border p-2 text-right">{Number(payment.labFee).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {payment.medicines && payment.medicines.length > 0 && (
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
                  {payment.medicines.map((m: any, index: number) => (
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
              {payment.consultationFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Consultation Fee:</span>
                  <span>Rs. {Number(payment.consultationFee).toFixed(2)}</span>
                </div>
              )}
              {payment.labFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Lab Fee:</span>
                  <span>Rs. {Number(payment.labFee).toFixed(2)}</span>
                </div>
              )}
              {payment.medicineFee > 0 && (
                <div className="flex justify-between p-2 border-b text-sm">
                  <span>Medicine Fee:</span>
                  <span>Rs. {Number(payment.medicineFee).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between p-2 bg-primary/10 font-bold">
                <span>TOTAL AMOUNT:</span>
                <span>Rs. {Number(payment.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 text-sm bg-muted/50">
                <span>Payment Mode:</span>
                <span className="font-medium">{payment.paymentMode}</span>
              </div>
            </div>
          </div>

          <div className="mb-6 p-3 border rounded bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">Amount in Words:</span> Rupees {numberToWords(payment.totalAmount)} Only
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
