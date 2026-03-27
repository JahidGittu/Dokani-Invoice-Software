import { useRef, useState, useEffect } from "react";
import { formatCurrency, numberToWords, type SaleRecord } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";
import QRCode from "qrcode";

interface InvoiceModalProps {
  sale: SaleRecord;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  companyEmail?: string;
  soldBy?: string;
  onClose: () => void;
}

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Generate real QR code data URL
async function generateQRDataURL(data: string, size = 80): Promise<string> {
  try {
    return await QRCode.toDataURL(data || 'N/A', { width: size, margin: 1, errorCorrectionLevel: 'M' });
  } catch { return ''; }
}

export default function InvoiceModal({ sale, companyName, companyPhone, companyAddress, companyEmail, soldBy, onClose }: InvoiceModalProps) {
  const { t } = useI18n();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    generateQRDataURL(`${sale.invoice}-${sale.total}-${sale.date}`, 80).then(url => setQrDataUrl(url));
  }, [sale.invoice, sale.total, sale.date]);

  const dateStr = (() => {
    try {
      const d = new Date(sale.date);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    } catch { return sale.date; }
  })();

  const qrImgTag = qrDataUrl ? `<img src="${qrDataUrl}" width="80" height="80" style="image-rendering:pixelated"/>` : '';

  const totalQty = sale.items.reduce((s, i) => s + (i.sqftQty ?? i.qty), 0);
  const dueInBill = sale.due ?? 0;
  const prevDues = sale.previousDues ?? 0;
  const balance = sale.balance ?? dueInBill;

  const generatePrintHTML = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Noto Sans Bengali',Arial,sans-serif;color:#222;font-size:12px;background:#fff}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 16mm 10mm;position:relative}

/* Header */
.header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid #222;margin-bottom:6px}
.header-left{width:90px;display:flex;align-items:center;justify-content:center}
.header-left .logo-box{width:70px;height:70px;background:#005cc1;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px;letter-spacing:1px}
.header-center{flex:1;text-align:center}
.header-center .company-name{font-size:28px;font-weight:900;letter-spacing:0.5px;line-height:1.1}
.header-center .company-bn{font-size:14px;font-weight:600;color:#444;margin-top:1px}
.header-center .company-addr{font-size:11px;color:#555;margin-top:3px;line-height:1.4}
.header-center .company-phone{font-size:11px;color:#555}
.header-center .company-email{font-size:10px;color:#555}
.header-right{width:90px;display:flex;align-items:flex-start;justify-content:flex-end}

/* Bill Title */
.bill-title{text-align:center;font-size:20px;font-weight:900;margin:8px 0;letter-spacing:2px;text-decoration:underline;text-underline-offset:4px}

/* Info Row */
.info-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;line-height:1.6}
.info-row .col{display:flex;flex-direction:column}
.info-row .col.right{align-items:flex-end}
.info-row .field{display:flex;gap:4px}
.info-row .lbl{min-width:70px;font-weight:400}
.info-row .colon{min-width:10px}
.info-row .val{font-weight:700}

/* Table */
table{width:100%;border-collapse:collapse;margin-bottom:8px}
thead tr{background:#c0392b;color:#fff}
th{font-size:10.5px;font-weight:700;text-transform:uppercase;padding:8px 6px;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{padding:6px;font-size:11px;border-bottom:1px solid #ddd}
td.r{text-align:right}
td.bold{font-weight:700}
tbody tr:nth-child(even){background:#fafafa}

/* Bottom Section */
.bottom{display:flex;justify-content:space-between;margin-top:6px;gap:20px}
.due-box{border:2px solid #333;border-radius:4px;padding:8px 14px;font-size:11.5px;min-width:210px}
.due-box .due-row{display:flex;justify-content:space-between;margin-bottom:3px}
.due-box .due-val{font-weight:900;text-align:right;min-width:80px}

.summary-box{min-width:220px}
.summary-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
.summary-row.payable{font-size:20px;font-weight:900;border-top:2px solid #222;border-bottom:2px solid #222;padding:6px 0;margin-top:4px}
.summary-row .s-val{font-weight:700;text-align:right;min-width:80px}
.summary-row.paid .s-val{font-weight:800}

/* Remark */
.remark{font-size:11px;margin-top:8px;line-height:1.5}
.remark .inword{color:#005cc1;font-weight:700}

/* Signatures */
.sig-row{display:flex;justify-content:space-between;margin-top:55px;padding-top:8px;font-size:13px;font-weight:700}
.sig-row .sig{border-top:1px solid #999;padding-top:6px;text-align:center;min-width:180px;color:#005cc1}

/* Disclaimer */
.disclaimer{text-align:center;margin-top:18px;font-size:12px;color:#c0392b;font-weight:700;padding:6px 0;border-top:1px solid #eee}
.footer-line{text-align:center;font-size:9px;color:#999;margin-top:6px}

@media print{
  @page{size:A4;margin:0}
  .page{padding:10mm 14mm}
}
</style></head><body>
<div class="page">

<!-- Header -->
<div class="header">
  <div class="header-left">
    <div class="logo-box">${companyName.slice(0, 3).toUpperCase()}</div>
  </div>
  <div class="header-center">
    <div class="company-name">${companyName.toUpperCase()}</div>
    <div class="company-addr">${companyAddress || ''}</div>
    ${companyPhone ? `<div class="company-phone">Phone# ${companyPhone}</div>` : ''}
    ${companyEmail ? `<div class="company-email">${companyEmail}</div>` : ''}
  </div>
  <div class="header-right">${qrImgTag}</div>
</div>

<!-- Bill Title -->
<div class="bill-title">BILL-INVOICE</div>

<!-- Customer & Invoice Info -->
<div class="info-row">
  <div class="col">
    <div class="field"><span class="lbl">Name</span><span class="colon">:</span><span class="val">${sale.customer}</span></div>
    ${sale.address ? `<div class="field"><span class="lbl">Address</span><span class="colon">:</span><span class="val">${sale.address}</span></div>` : ''}
    ${sale.phone ? `<div class="field"><span class="lbl">Mobile</span><span class="colon">:</span><span class="val">${sale.phone}</span></div>` : ''}
  </div>
  <div class="col right">
    <div class="field"><span class="lbl">Invoice#</span><span class="colon">:</span><span class="val">${sale.invoice}</span></div>
    <div class="field"><span class="lbl">Date</span><span class="colon">:</span><span class="val">${dateStr}</span></div>
    ${soldBy ? `<div class="field"><span class="lbl">Sold By</span><span class="colon">:</span><span class="val">${soldBy}</span></div>` : ''}
  </div>
</div>

<!-- Items Table -->
<table>
  <thead><tr>
    <th>SN</th><th>TYPE</th><th>CARTON/PIECE</th><th>CATEGORY</th><th>PRODUCT NAME</th><th class="r">SQFT./QTY.</th><th class="r">PRICE</th><th class="r">SUB TOTAL</th>
  </tr></thead>
  <tbody>${sale.items.map((item, idx) => {
    const carton = item.carton ?? item.qty;
    const piece = item.piece ?? 0;
    const sqftQty = item.sqftQty ?? item.qty;
    const subTotal = item.price * item.qty;
    return `<tr>
      <td>${idx + 1}</td>
      <td>Sale</td>
      <td>${carton} Carton ${piece} Piece</td>
      <td>${item.category || '-'}</td>
      <td class="bold">${item.name}${item.detail ? ` (${item.detail})` : ''}</td>
      <td class="r">${Number(sqftQty).toFixed(2)}</td>
      <td class="r">${item.price}</td>
      <td class="r bold">${subTotal}</td>
    </tr>`;
  }).join('')}</tbody>
</table>

<!-- Bottom: Due Box + Summary -->
<div class="bottom">
  <div>
    <div class="due-box">
      <div class="due-row"><span>Due In This Bill:</span><span class="due-val">${dueInBill}/-</span></div>
      <div class="due-row"><span>Previous Dues:</span><span class="due-val">${prevDues}/-</span></div>
      <div class="due-row"><span>Balance:</span><span class="due-val">${balance}/-</span></div>
    </div>
    <div class="remark">
      <div><strong>Remark:</strong> ${sale.notes || ''}</div>
      <div><strong>Total Quantity:</strong> ${totalQty}</div>
      <div>In Word: <span class="inword">${numberToWords(sale.total)}</span></div>
    </div>
  </div>
  <div class="summary-box">
    <div class="summary-row"><span>Total:</span><span class="s-val">${sale.subtotal}</span></div>
    ${(sale.labour ?? 0) > 0 ? `<div class="summary-row"><span>Labour:</span><span class="s-val">${sale.labour}</span></div>` : ''}
    ${sale.discount > 0 ? `<div class="summary-row"><span>Discount:</span><span class="s-val">-${sale.discount}</span></div>` : ''}
    <div class="summary-row payable"><span>PAYABLE:</span><span class="s-val">${sale.total}</span></div>
    <div class="summary-row paid"><span>Paid:</span><span class="s-val">${sale.paid ?? sale.total}</span></div>
  </div>
</div>

<!-- Signatures -->
<div class="sig-row">
  <div class="sig">Customer Signature</div>
  <div class="sig">Authorized Signature</div>
</div>

<!-- Disclaimer -->
<div class="disclaimer">বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়।চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।</div>
<div class="footer-line">SOFTWARE: ${companyName} | Printing @: ${new Date().toLocaleString()}</div>

</div>
</body></html>`;

  // Thermal receipt
  const generateThermalHTML = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:280px;padding:12px;color:#000;font-size:11px}
.center{text-align:center}.bold{font-weight:700}
.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between}
h2{font-size:14px;margin-bottom:2px}
.total-line{font-size:14px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:4px 0}
</style></head><body>
<div class="center"><h2>${companyName}</h2>
${companyPhone ? `<div style="font-size:9px">${companyPhone}</div>` : ''}
</div>
<div class="line"></div>
<div class="row"><span>${sale.invoice}</span><span>${dateStr}</span></div>
<div style="font-size:10px">Customer: ${sale.customer}</div>
${sale.phone ? `<div style="font-size:10px">Phone: ${sale.phone}</div>` : ''}
<div class="line"></div>
${sale.items.map(item => `
<div class="bold">${item.name}</div>
<div class="row"><span>${item.qty} x ${formatCurrency(item.price)}</span><span>${formatCurrency(item.price * item.qty)}</span></div>
`).join('')}
<div class="line"></div>
<div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
${(sale.delivery ?? 0) > 0 ? `<div class="row"><span>Delivery</span><span>+${formatCurrency(sale.delivery!)}</span></div>` : ''}
${(sale.labour ?? 0) > 0 ? `<div class="row"><span>Labour</span><span>+${formatCurrency(sale.labour!)}</span></div>` : ''}
<div class="row total-line"><span>TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
<div class="row"><span>Paid</span><span>${formatCurrency(sale.paid ?? sale.total)}</span></div>
${(sale.due ?? 0) > 0 ? `<div class="row" style="color:red"><span>Due</span><span>${formatCurrency(sale.due!)}</span></div>` : ''}
<div class="line"></div>
<div class="center" style="font-size:9px;margin-top:4px">Thank you! Visit again.</div>
</body></html>`;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) { toast.error('Pop-up blocked!'); return; }
    w.document.write(generatePrintHTML());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const handleThermalPrint = () => {
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) { toast.error('Pop-up blocked!'); return; }
    w.document.write(generateThermalHTML());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handlePDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    let y = 18;

    // Logo box
    doc.setFillColor(0, 92, 193);
    doc.roundedRect(15, y - 2, 16, 16, 2, 2, 'F');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName.slice(0, 3).toUpperCase(), 23, y + 8, { align: 'center' });

    // Company name center
    doc.setTextColor(34, 34, 34);
    doc.setFontSize(18);
    doc.text(companyName.toUpperCase(), pw / 2, y + 4, { align: 'center' });
    if (companyAddress) {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(companyAddress, pw / 2, y + 10, { align: 'center' });
    }
    if (companyPhone) {
      doc.setFontSize(8);
      doc.text(`Phone# ${companyPhone}`, pw / 2, y + 14, { align: 'center' });
    }

    // QR Code right - real QR
    try {
      const QRCodeLib = await import('qrcode');
      const qrDataUrl = await QRCodeLib.default.toDataURL(`${sale.invoice}-${sale.total}`, { width: 80, margin: 1 });
      doc.addImage(qrDataUrl, 'PNG', pw - 33, y - 2, 18, 18);
    } catch {
      doc.setDrawColor(200);
      doc.rect(pw - 33, y - 2, 18, 18);
      doc.setFontSize(6); doc.setTextColor(150);
      doc.text('QR', pw - 24, y + 8, { align: 'center' });
    }

    y += 20;
    doc.setDrawColor(34); doc.setLineWidth(0.6);
    doc.line(15, y, pw - 15, y);
    y += 8;

    // BILL-INVOICE
    doc.setTextColor(34); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('BILL-INVOICE', pw / 2, y, { align: 'center' });
    y += 8;

    // Customer info
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Name      :  ${sale.customer}`, 15, y);
    doc.text(`Invoice#  :  ${sale.invoice}`, pw - 15, y, { align: 'right' });
    y += 5;
    if (sale.address) { doc.text(`Address   :  ${sale.address}`, 15, y); }
    doc.text(`Date      :  ${dateStr}`, pw - 15, y, { align: 'right' });
    y += 5;
    if (sale.phone) { doc.text(`Mobile    :  ${sale.phone}`, 15, y); }
    if (soldBy) { doc.text(`Sold By   :  ${soldBy}`, pw - 15, y, { align: 'right' }); }
    y += 7;

    // Items table
    const tableData = sale.items.map((item, idx) => [
      String(idx + 1), 'Sale',
      `${item.carton ?? item.qty} Carton ${item.piece ?? 0} Piece`,
      item.category || '-',
      `${item.name}${item.detail ? ` (${item.detail})` : ''}`,
      String(Number(item.sqftQty ?? item.qty).toFixed(2)),
      String(item.price),
      String(item.price * item.qty),
    ]);

    doc.autoTable({
      startY: y,
      head: [['SN', 'TYPE', 'CARTON/PIECE', 'CATEGORY', 'PRODUCT NAME', 'SQFT./QTY.', 'PRICE', 'SUB TOTAL']],
      body: tableData,
      theme: 'grid',
      margin: { left: 15, right: 15 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [34, 34, 34] },
      headStyles: { fillColor: [192, 57, 43], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 14 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 42 },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
    });

    y = doc.lastAutoTable.finalY + 6;

    // Due box left
    doc.setDrawColor(51); doc.setLineWidth(0.5);
    doc.rect(15, y, 60, 22);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(34);
    doc.text('Due In This Bill:', 17, y + 5);
    doc.setFont('helvetica', 'bold'); doc.text(`${dueInBill}/-`, 73, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Previous Dues:', 17, y + 11);
    doc.setFont('helvetica', 'bold'); doc.text(`${prevDues}/-`, 73, y + 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Balance:', 17, y + 17);
    doc.setFont('helvetica', 'bold'); doc.text(`${balance}/-`, 73, y + 17, { align: 'right' });

    // Summary right
    const sx = 140;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Total:', sx, y + 5);
    doc.setFont('helvetica', 'bold'); doc.text(String(sale.subtotal), pw - 15, y + 5, { align: 'right' });
    let sy = y + 11;
    if ((sale.labour ?? 0) > 0) {
      doc.setFont('helvetica', 'normal'); doc.text('Labour:', sx, sy);
      doc.setFont('helvetica', 'bold'); doc.text(String(sale.labour), pw - 15, sy, { align: 'right' });
      sy += 6;
    }
    doc.setDrawColor(34); doc.setLineWidth(0.8);
    doc.line(sx - 2, sy, pw - 15, sy); sy += 2;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('PAYABLE:', sx, sy + 5);
    doc.text(String(sale.total), pw - 15, sy + 5, { align: 'right' });
    sy += 10;
    doc.setFontSize(10);
    doc.text('Paid:', sx, sy);
    doc.text(String(sale.paid ?? sale.total), pw - 15, sy, { align: 'right' });

    // Remark
    const ry = y + 26;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Remark:', 15, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(sale.notes || '', 35, ry);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Quantity: ${totalQty}`, 15, ry + 5);
    doc.text('In Word: ', 15, ry + 10);
    doc.setTextColor(0, 92, 193);
    doc.text(numberToWords(sale.total), 33, ry + 10);
    doc.setTextColor(34);

    // Signatures
    const sigY = ry + 30;
    doc.setDrawColor(150); doc.setLineWidth(0.3);
    doc.line(20, sigY, 75, sigY);
    doc.line(pw - 75, sigY, pw - 20, sigY);
    doc.setFontSize(10); doc.setTextColor(0, 92, 193); doc.setFont('helvetica', 'bold');
    doc.text('Customer Signature', 47, sigY + 5, { align: 'center' });
    doc.text('Authorized Signature', pw - 47, sigY + 5, { align: 'center' });

    // Disclaimer
    doc.setTextColor(192, 57, 43); doc.setFontSize(9);
    doc.text('Goods once sold are not returnable. Chinese/Indian products are non-refundable.', pw / 2, sigY + 16, { align: 'center' });

    doc.setTextColor(150); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`SOFTWARE: ${companyName} | Printing @: ${new Date().toLocaleString()}`, pw / 2, sigY + 22, { align: 'center' });

    doc.save(`${sale.invoice}.pdf`);
    toast.success('PDF downloaded!');
  };

  const handleWhatsApp = () => {
    let msg = `*${companyName}*\n`;
    if (companyPhone) msg += `📞 ${companyPhone}\n`;
    msg += `📋 Invoice: ${sale.invoice}\n📅 Date: ${dateStr}\n`;
    msg += `👤 Customer: ${sale.customer}\n`;
    if (sale.phone) msg += `📱 Phone: ${sale.phone}\n`;
    msg += `\n*Items:*\n`;
    sale.items.forEach((item, i) => {
      msg += `${i + 1}. ${item.name} x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
    });
    if (sale.discount > 0) msg += `\n💰 Discount: -${formatCurrency(sale.discount)}`;
    msg += `\n*💵 PAYABLE: ${formatCurrency(sale.total)}*`;
    msg += `\n✅ Paid: ${formatCurrency(sale.paid ?? sale.total)}`;
    if (dueInBill > 0) msg += `\n⚠️ Due: ${formatCurrency(dueInBill)}`;
    const url = `https://wa.me/${sale.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-white rounded-xl w-[95vw] max-w-[520px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Invoice Preview */}
        <div ref={invoiceRef} className="p-5 sm:p-6 text-[#222]">
          
          {/* Header: Logo | Company | QR */}
          <div className="flex items-start justify-between pb-2 mb-2 border-b-2 border-[#222]">
            <div className="w-14 h-14 bg-[#005cc1] rounded-lg flex items-center justify-center text-white font-black text-lg shrink-0">
              {companyName.slice(0, 3).toUpperCase()}
            </div>
            <div className="flex-1 text-center px-2">
              <div className="text-xl font-black tracking-wide leading-tight">{companyName.toUpperCase()}</div>
              {companyAddress && <div className="text-[10px] text-gray-600 mt-0.5">{companyAddress}</div>}
              {companyPhone && <div className="text-[10px] text-gray-600">Phone# {companyPhone}</div>}
              {companyEmail && <div className="text-[9px] text-gray-500">{companyEmail}</div>}
            </div>
            {qrDataUrl ? <img src={qrDataUrl} alt="QR" width={60} height={60} style={{ imageRendering: 'pixelated' }} /> : <div className="w-[60px] h-[60px] bg-gray-100 rounded" />}
          </div>

          {/* BILL-INVOICE */}
          <div className="text-center font-black text-lg tracking-widest mb-3 underline underline-offset-4">BILL-INVOICE</div>

          {/* Customer & Invoice Info */}
          <div className="flex justify-between text-[11px] mb-3 leading-relaxed">
            <div className="space-y-0.5">
              <div className="flex gap-1"><span className="w-14">Name</span><span>:</span><strong>{sale.customer}</strong></div>
              {sale.address && <div className="flex gap-1"><span className="w-14">Address</span><span>:</span><strong>{sale.address}</strong></div>}
              {sale.phone && <div className="flex gap-1"><span className="w-14">Mobile</span><span>:</span><strong>{sale.phone}</strong></div>}
            </div>
            <div className="text-right space-y-0.5">
              <div className="flex gap-1 justify-end"><span>Invoice#</span><span>:</span><strong>{sale.invoice}</strong></div>
              <div className="flex gap-1 justify-end"><span>Date</span><span>:</span><strong>{dateStr}</strong></div>
              {soldBy && <div className="flex gap-1 justify-end"><span>Sold By</span><span>:</span><strong>{soldBy}</strong></div>}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left mb-3 min-w-[460px]">
              <thead>
                <tr className="text-[8px] font-bold uppercase bg-[#c0392b] text-white">
                  <th className="py-2 px-1.5 w-7">SN</th>
                  <th className="py-2 px-1.5 w-10">TYPE</th>
                  <th className="py-2 px-1.5">CARTON/PIECE</th>
                  <th className="py-2 px-1.5">CATEGORY</th>
                  <th className="py-2 px-1.5">PRODUCT NAME</th>
                  <th className="py-2 px-1.5 text-right">SQFT./QTY.</th>
                  <th className="py-2 px-1.5 text-right">PRICE</th>
                  <th className="py-2 px-1.5 text-right">SUB TOTAL</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {sale.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="py-1.5 px-1.5 border-b border-gray-200">{i + 1}</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200">Sale</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200">{item.carton ?? item.qty} Carton {item.piece ?? 0} Piece</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200">{item.category || '-'}</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200 font-semibold">{item.name}{item.detail ? ` (${item.detail})` : ''}</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200 text-right">{Number(item.sqftQty ?? item.qty).toFixed(2)}</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200 text-right">{item.price}</td>
                    <td className="py-1.5 px-1.5 border-b border-gray-200 text-right font-bold">{Math.round((item.carton ?? item.qty) * item.price + (item.piece ?? 0) * (item.price / (4)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Due Box + Summary - matching reference layout */}
          <div className="flex justify-between gap-4 mt-2">
            {/* Left: Due Box + Remark */}
            <div className="flex-1">
              <div className="border-2 border-[#333] rounded p-2.5 text-[11px] space-y-1 inline-block min-w-[180px]">
                <div className="flex justify-between gap-6"><span>Due In This Bill:</span><strong className="text-right min-w-[70px]">{dueInBill}/-</strong></div>
                <div className="flex justify-between gap-6"><span>Previous Dues:</span><strong className="text-right min-w-[70px]">{prevDues}/-</strong></div>
                <div className="flex justify-between gap-6"><span>Balance:</span><strong className="text-right min-w-[70px]">{balance}/-</strong></div>
              </div>
              <div className="text-[10px] mt-2 space-y-0.5">
                {sale.notes && <div><strong>Remark:</strong> {sale.notes}</div>}
                <div><strong>Total Quantity: {totalQty}</strong></div>
                <div>In Word: <strong className="text-[#005cc1]">{numberToWords(sale.total)}</strong></div>
              </div>
            </div>
            {/* Right: Summary */}
            <div className="min-w-[170px] text-[11px]">
              <div className="flex justify-between py-0.5"><span>Total:</span><span className="font-bold text-right min-w-[70px]">{sale.subtotal}</span></div>
              {(sale.labour ?? 0) > 0 && <div className="flex justify-between py-0.5"><span>Labour:</span><span className="font-bold text-right min-w-[70px]">{sale.labour}</span></div>}
              {sale.discount > 0 && <div className="flex justify-between py-0.5"><span>Discount:</span><span className="font-bold text-right min-w-[70px]">-{sale.discount}</span></div>}
              <div className="flex justify-between font-black text-lg py-1.5 mt-1 border-t-2 border-b-2 border-[#222]">
                <span>PAYABLE:</span><span className="text-right">{sale.total}</span>
              </div>
              <div className="flex justify-between font-bold text-[12px] py-0.5 mt-1"><span>Paid:</span><span className="text-right min-w-[70px]">{sale.paid ?? sale.total}</span></div>
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between mt-14 px-4">
            <div className="text-center">
              <div className="border-t border-gray-400 w-[160px] mb-1"></div>
              <span className="text-[12px] font-bold italic text-[#005cc1]">Customer Signature</span>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 w-[160px] mb-1"></div>
              <span className="text-[12px] font-bold italic text-[#005cc1]">Authorized Signature</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center mt-5 text-[11px] text-[#c0392b] font-bold py-2 border-t border-gray-200">
            বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়।চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।
          </div>
          <div className="text-[8px] text-center text-gray-400 mt-0.5">
            SOFTWARE: {companyName} | {companyPhone || ''} | Printing @: {new Date().toLocaleString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-5 gap-2 p-3 pt-0">
          <button onClick={handlePrint}
            className="py-2.5 bg-gradient-to-b from-[#005cc1] to-[#004a9e] text-white rounded-lg font-semibold text-[11px] flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-base">print</span>{t('print')}
          </button>
          <button onClick={handleThermalPrint}
            className="py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold text-[11px] flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-base">receipt</span>{t('thermal')}
          </button>
          <button onClick={handlePDF}
            className="py-2.5 bg-blue-50 text-blue-700 rounded-lg font-semibold text-[11px] flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>{t('pdf')}
          </button>
          <button onClick={handleWhatsApp}
            className="py-2.5 bg-green-50 text-green-700 rounded-lg font-semibold text-[11px] flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-base">share</span>{t('whatsapp')}
          </button>
          <button onClick={onClose}
            className="py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold text-[11px] flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-base">close</span>{t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
