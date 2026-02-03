import { jsPDF } from 'jspdf';
import { PatientDTO } from '@/services/accessApi';
import { useSettingsStore } from '@/store/settingsStore';

interface InvoiceItem {
    description: string;
    amount: number;
    date: string;
}

// Helper function to convert number to words
const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (isNaN(num)) return 'Zero'; // Prevent infinite recursion on NaN

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

export const generatePatientInvoice = (patient: PatientDTO, items: InvoiceItem[]) => {
    const { settings } = useSettingsStore.getState();
    const doc = new jsPDF();

    doc.setProperties({
        title: `Invoice-${patient.MRN || patient.ID}`,
        subject: 'Patient Invoice',
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

    // ================= HEADER =================
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

    // Title Right Aligned
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE / BILL', pageWidth - margin, 18, { align: 'right' });
    doc.setTextColor(...mutedColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice ID: INV-${Date.now().toString().slice(-6)}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 30, { align: 'right' });

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(margin, 40, pageWidth - margin, 40);

    // ================= PATIENT INFO =================
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
    doc.text(patient.Name, margin + 28, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${patient.Age} years / ${patient.Gender}`, margin + 28, yPos + 14);

    const rightCol = pageWidth / 2 + 10;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Patient ID/MRN:', rightCol, yPos + 7);
    doc.text('Contact:', rightCol, yPos + 14);

    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(patient.MRN || patient.ID, rightCol + 28, yPos + 7);
    doc.text(patient.Phone || 'N/A', rightCol + 28, yPos + 14);

    // ================= TABLE =================
    yPos = 78;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL DETAILS', margin, yPos);
    yPos += 8;

    // Header
    doc.setFillColor(240, 247, 255);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setDrawColor(...lineColor);
    doc.rect(margin, yPos, contentWidth, 8, 'S');

    doc.setTextColor(...textColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', margin + 3, yPos + 5.5);
    doc.text('Description', margin + 12, yPos + 5.5);
    doc.text('Date', margin + 120, yPos + 5.5);
    doc.text('Amount (PKR)', pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

    yPos += 8;
    let rowNum = 1;
    let grandTotal = 0;

    doc.setFont('helvetica', 'normal');

    items.forEach((item) => {
        grandTotal += item.amount;

        // Page Break Check
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setDrawColor(...lineColor);
        doc.rect(margin, yPos, contentWidth, 8, 'S');

        doc.setTextColor(...textColor);
        doc.setFontSize(8);
        doc.text(String(rowNum), margin + 3, yPos + 5.5);
        doc.text(item.description.substring(0, 60), margin + 12, yPos + 5.5);
        doc.text(item.date, margin + 120, yPos + 5.5);
        doc.text(item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

        yPos += 8;
        rowNum++;
    });

    // ================= TOTAL =================
    yPos += 5;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('GRAND TOTAL:', pageWidth - margin - 55, yPos);
    doc.text(`PKR ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos, { align: 'right' });

    // Amount in words
    yPos += 12;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Amount in Words: Rupees ${numberToWords(Math.floor(grandTotal))} Only`, margin + 4, yPos + 8);

    // ================= SIGNATURES =================
    yPos += 30;
    doc.setDrawColor(...lineColor);

    doc.line(margin, yPos + 15, margin + 50, yPos + 15);
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Patient Signature', margin + 10, yPos + 22);

    doc.line(pageWidth - margin - 50, yPos + 15, pageWidth - margin, yPos + 15);
    doc.text('Authorized Signature', pageWidth - margin - 40, yPos + 22);

    // ================= FOOTER =================
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

    // Open PDF
    window.open(doc.output('bloburl'), '_blank');
};
