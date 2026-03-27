import { useRef } from "react";
import { formatCurrency, numberToWords, type SaleRecord } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface InvoiceModalProps {
  sale: SaleRecord;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  onClose: () => void;
}

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Simple QR-like pattern SVG (visual placeholder - real QR would need a library)
function generateQRSVG(data: string, size = 80): string {
  // Create a deterministic pattern from the data
  const hash = data.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  const grid = 11;
  const cellSize = size / grid;
  let rects = '';
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Position patterns (top-left, top-right, bottom-left corners)
      const isCornerPattern = (i < 3 && j < 3) || (i < 3 && j >= grid - 3) || (i >= grid - 3 && j < 3);
      const isCornerBorder = (i < 3 && j < 3) ? (i === 0 || i === 2 || j === 0 || j === 2 || (i === 1 && j === 1)) :
        (i < 3 && j >= grid - 3) ? (i === 0 || i === 2 || j === grid - 1 || j === grid - 3 || (i === 1 && j === grid - 2)) :
        (i >= grid - 3 && j < 3) ? (i === grid - 1 || i === grid - 3 || j === 0 || j === 2 || (i === grid - 2 && j === 1)) : false;

      const bit = isCornerPattern ? isCornerBorder :
        ((hash * (i * grid + j + 1) * 7919) % 100) > 45;
      if (bit) {
        rects += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="#2d3435"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`;
}

export default function InvoiceModal({ sale, companyName, companyPhone, companyAddress, onClose }: InvoiceModalProps) {
  const { t } = useI18n();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const dateStr = (() => {
    try { return new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return sale.date; }
  })();

  const bizInfoLine = [companyPhone, companyAddress].filter(Boolean).join(' · ');

  const statusBadgeClass = sale.status === 'paid'
    ? 'bg-[#86ff90] text-[#006120]' : sale.status === 'pending'
    ? 'bg-[#fef08a] text-[#854f0b]' : 'bg-[#d8e2ff] text-[#003d85]';

  const qrSVG = generateQRSVG(`${sale.invoice}-${sale.total}-${sale.date}`);

  const generatePrintHTML = () => `<!DOCTYPE html><html><head><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;color:#2d3435;font-size:12px;background:#fff}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:15mm 18mm 12mm;position:relative}
.header{text-align:center;padding-bottom:10px;border-bottom:2px solid #333;margin-bottom:12px;position:relative}
.header .qr{position:absolute;right:0;top:0}
.header .logo-box{width:48px;height:48px;background:#005cc1;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:18px;margin-bottom:4px}
.header .company{font-size:24px;font-weight:900;letter-spacing:-.5px}
.header .subtitle{font-size:11px;color:#5a6061}
.bill-title{text-align:center;font-size:18px;font-weight:900;margin:10px 0;letter-spacing:1px}
.info-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px}
.info-row .left div,.info-row .right div{margin-bottom:2px}
.info-row .label{font-weight:400;min-width:80px;display:inline-block}
.info-row .val{font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
thead tr{background:#c0392b;color:#fff}
th{font-size:10px;font-weight:700;text-transform:uppercase;padding:8px 6px;text-align:left}
th:last-child{text-align:right}
td{padding:7px 6px;font-size:11px;border-bottom:1px solid #e0e0e0}
td:last-child{text-align:right;font-weight:600}
.bottom-section{display:flex;justify-content:space-between;margin-top:8px}
.due-box{border:1px solid #333;border-radius:4px;padding:8px 12px;font-size:11px;width:200px}
.due-box div{display:flex;justify-content:space-between;margin-bottom:3px}
.due-box .val{font-weight:800}
.summary-right{width:220px;text-align:right}
.summary-right .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
.summary-right .payable{font-size:18px;font-weight:900;border-top:2px solid #333;padding-top:6px;margin-top:4px}
.remark-section{font-size:11px;margin-top:10px}
.remark-section .inword{color:#005cc1;font-weight:700}
.sig-row{display:flex;justify-content:space-between;margin-top:50px;padding-top:6px;border-top:1px solid #999;font-size:12px;color:#005cc1;font-weight:700}
.disclaimer{text-align:center;margin-top:16px;font-size:11px;color:#c0392b;font-weight:700}
.footer-print{text-align:center;font-size:9px;color:#888;margin-top:8px}
@media print{@page{size:A4;margin:0} .page{padding:12mm 15mm}}
</style></head><body>
<div class="page">
<div class="header">
  <div class="qr">${qrSVG}</div>
  <div class="logo-box">${companyName.slice(0, 2).toUpperCase()}</div>
  <div class="company">${companyName}</div>
  ${bizInfoLine ? `<div class="subtitle">${bizInfoLine}</div>` : ''}
</div>
<div class="bill-title">BILL-INVOICE</div>
<div class="info-row">
  <div class="left">
    <div><span class="label">Name</span>: <span class="val">${sale.customer}</span></div>
    ${sale.address ? `<div><span class="label">Address</span>: <span class="val">${sale.address}</span></div>` : ''}
    ${sale.phone ? `<div><span class="label">Mobile</span>: <span class="val">${sale.phone}</span></div>` : ''}
  </div>
  <div class="right">
    <div><span class="label">Invoice#</span>: <span class="val">${sale.invoice}</span></div>
    <div><span class="label">Date</span>: <span class="val">${dateStr}</span></div>
  </div>
</div>
<table>
  <thead><tr><th>SN</th><th>Type</th><th>Carton/Piece</th><th>Category</th><th>Product Name</th><th>Sqft./Qty.</th><th>Price</th><th>Sub Total</th></tr></thead>
  <tbody>${sale.items.map((item, idx) => `
    <tr><td>${idx + 1}</td><td>Sale</td><td>${item.carton ?? item.qty} Carton ${item.piece ?? 0} Piece</td><td>${item.category || '-'}</td><td>${item.name}</td><td>${item.sqftQty ?? item.qty}</td><td>${sale.items[idx] ? String(item.price) : '0'}</td><td>${String(item.price * item.qty)}</td></tr>
  `).join('')}</tbody>
</table>
<div class="bottom-section">
  <div class="due-box">
    <div><span>Due In This Bill:</span><span class="val">${sale.due ?? 0}/-</span></div>
    <div><span>Previous Dues:</span><span class="val">${sale.previousDues ?? 0}/-</span></div>
    <div><span>Balance:</span><span class="val">${sale.balance ?? (sale.due ?? 0)}/-</span></div>
  </div>
  <div class="summary-right">
    <div class="row"><span>Total:</span><span>${sale.subtotal}</span></div>
    ${sale.discount > 0 ? `<div class="row"><span>Discount:</span><span>-${sale.discount}</span></div>` : ''}
    ${(sale.labour ?? 0) > 0 ? `<div class="row"><span>Labour:</span><span>${sale.labour}</span></div>` : ''}
    <div class="row payable"><span>PAYABLE:</span><span>${sale.total}</span></div>
    <div class="row" style="color:#006120;font-weight:700"><span>Paid:</span><span>${sale.paid ?? sale.total}</span></div>
  </div>
</div>
<div class="remark-section">
  <div><strong>Remark:</strong> ${sale.notes || ''}</div>
  <div><strong>Total Quantity:</strong> ${sale.items.reduce((s: number, i: any) => s + i.qty, 0)}</div>
  <div>In Word: <span class="inword">${typeof numberToWords === 'function' ? numberToWords(sale.total) : sale.total}</span></div>
</div>
<div class="sig-row"><span>Customer Signature</span><span>Authorized Signature</span></div>
<div class="disclaimer">বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়।চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।</div>
<div class="footer-print">SOFTWARE: ${companyName} | Printing @: ${new Date().toLocaleString()}</div>
</div>
</body></html>`;

  // Thermal receipt HTML (80mm width)
  const generateThermalHTML = () => `<!DOCTYPE html><html><head><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:280px;padding:12px;color:#000;font-size:11px}
.center{text-align:center}
.bold{font-weight:700}
.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between}
.item-name{font-weight:600}
h2{font-size:14px;margin-bottom:2px}
.total-line{font-size:14px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:4px 0}
</style></head><body>
<div class="center"><h2>${companyName}</h2>
${bizInfoLine ? `<div style="font-size:9px">${bizInfoLine}</div>` : ''}
</div>
<div class="line"></div>
<div class="row"><span>${sale.invoice}</span><span>${dateStr}</span></div>
<div style="font-size:10px">Customer: ${sale.customer}</div>
${sale.phone ? `<div style="font-size:10px">Phone: ${sale.phone}</div>` : ''}
<div class="line"></div>
${sale.items.map(item => `
<div class="item-name">${item.name}</div>
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
<div class="row" style="font-size:10px"><span>Payment: ${sale.paymentMethod.toUpperCase()}</span><span>${sale.status.toUpperCase()}</span></div>
<div class="line"></div>
<div class="center" style="font-size:9px;margin-top:4px">Thank you! Visit again.</div>
</body></html>`;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=750,height=900');
    if (!w) { toast.error('Pop-up blocked!'); return; }
    w.document.write(generatePrintHTML());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handleThermalPrint = () => {
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) { toast.error('Pop-up blocked!'); return; }
    w.document.write(generateThermalHTML());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    let y = 20;

    // Header with logo box
    doc.setFillColor(0, 92, 193);
    doc.roundedRect(15, y - 4, 12, 12, 2, 2, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName.slice(0, 2).toUpperCase(), 21, y + 3, { align: 'center' });
    doc.setTextColor(45, 52, 53);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 30, y + 1);
    if (bizInfoLine) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(bizInfoLine, 30, y + 6);
    }

    // Invoice info right
    doc.setFontSize(8);
    doc.setTextColor(90, 96, 97);
    doc.text('INVOICE / CHALLAN', pw - 15, y - 2, { align: 'right' });
    doc.setFontSize(12);
    doc.setTextColor(0, 92, 193);
    doc.setFont('helvetica', 'bold');
    doc.text(sale.invoice, pw - 15, y + 4, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(90, 96, 97);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dateStr} · ${sale.time}`, pw - 15, y + 9, { align: 'right' });

    // Blue line
    y += 16;
    doc.setDrawColor(0, 92, 193);
    doc.setLineWidth(0.8);
    doc.line(15, y, pw - 15, y);
    y += 8;

    // Customer block
    doc.setFillColor(245, 247, 248);
    doc.roundedRect(15, y - 3, pw - 30, 14, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 97);
    doc.text('CUSTOMER', 18, y + 1);
    doc.setFontSize(9);
    doc.setTextColor(45, 52, 53);
    doc.setFont('helvetica', 'bold');
    doc.text(sale.customer, 18, y + 6);
    if (sale.phone) {
      doc.setFontSize(7);
      doc.setTextColor(90, 96, 97);
      doc.text('PHONE', 80, y + 1);
      doc.setFontSize(9);
      doc.setTextColor(45, 52, 53);
      doc.text(sale.phone, 80, y + 6);
    }
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 97);
    doc.text('PAYMENT', 140, y + 1);
    doc.setFontSize(9);
    doc.setTextColor(45, 52, 53);
    doc.text(sale.paymentMethod.toUpperCase(), 140, y + 6);
    doc.setFont('helvetica', 'normal');
    y += 16;

    if (sale.notes) {
      doc.setFontSize(8);
      doc.setTextColor(90, 96, 97);
      doc.text(`Notes: ${sale.notes}`, 15, y);
      y += 6;
    }

    // Table
    const tableData = sale.items.map(item => [
      `${item.name}\n${item.detail}`,
      String(item.qty),
      formatCurrency(item.price),
      formatCurrency(item.price * item.qty),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Product', 'Qty', 'Rate', 'Total']],
      body: tableData,
      theme: 'striped',
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fontStyle: 'bold', fontSize: 8, textColor: [90, 96, 97], fillColor: [245, 247, 248] },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    y = doc.lastAutoTable.finalY + 8;

    // Totals (right aligned)
    const totalsX = 140;
    doc.setFontSize(9);
    doc.setTextColor(90, 96, 97);
    doc.text('Subtotal', totalsX, y);
    doc.setTextColor(45, 52, 53);
    doc.text(formatCurrency(sale.subtotal), pw - 15, y, { align: 'right' });
    y += 5;

    if (sale.discount > 0) {
      doc.setTextColor(159, 64, 61);
      doc.text('Discount', totalsX, y);
      doc.text(`-${formatCurrency(sale.discount)}`, pw - 15, y, { align: 'right' });
      doc.setTextColor(45, 52, 53);
      y += 5;
    }
    if ((sale.delivery ?? 0) > 0) {
      doc.setTextColor(90, 96, 97); doc.text('Delivery', totalsX, y);
      doc.setTextColor(45, 52, 53); doc.text(`+${formatCurrency(sale.delivery!)}`, pw - 15, y, { align: 'right' }); y += 5;
    }
    if ((sale.labour ?? 0) > 0) {
      doc.setTextColor(90, 96, 97); doc.text('Labour', totalsX, y);
      doc.setTextColor(45, 52, 53); doc.text(`+${formatCurrency(sale.labour!)}`, pw - 15, y, { align: 'right' }); y += 5;
    }

    doc.setDrawColor(45, 52, 53);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pw - 15, y);
    y += 6;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', totalsX, y);
    doc.setTextColor(0, 92, 193);
    doc.text(formatCurrency(sale.total), pw - 15, y, { align: 'right' });
    y += 6;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 97, 32); doc.text('Paid', totalsX, y);
    doc.text(formatCurrency(sale.paid ?? sale.total), pw - 15, y, { align: 'right' }); y += 5;
    if ((sale.due ?? 0) > 0) {
      doc.setTextColor(159, 64, 61); doc.text('Due', totalsX, y);
      doc.text(formatCurrency(sale.due!), pw - 15, y, { align: 'right' }); y += 5;
    }

    doc.setFontSize(8);
    doc.setTextColor(45, 52, 53);
    doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${sale.status.toUpperCase()}`, totalsX, y);
    y += 12;

    // Terms
    doc.setDrawColor(240, 242, 243);
    doc.line(15, y, pw - 15, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 97);
    y += 4;
    doc.text('• Goods once delivered cannot be returned or exchanged.', 15, y);
    y += 3.5;
    doc.text('• Prices are subject to change without prior notice.', 15, y);
    y += 3.5;
    doc.text('• Credit payment due within 30 days.', 15, y);
    y += 8;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(90, 96, 97);
    doc.text(companyName ? `Thank you for shopping at ${companyName}!` : 'Thank you for your business!', pw / 2, y, { align: 'center' });

    doc.save(`${sale.invoice}.pdf`);
    toast.success('PDF downloaded!');
  };

  const handleWhatsApp = () => {
    let msg = `*${companyName}*\n`;
    if (bizInfoLine) msg += `${bizInfoLine}\n`;
    msg += `📋 Invoice: ${sale.invoice}\n📅 Date: ${dateStr}\n`;
    msg += `👤 Customer: ${sale.customer}\n`;
    if (sale.phone) msg += `📱 Phone: ${sale.phone}\n`;
    msg += `\n*Items:*\n`;
    sale.items.forEach(item => {
      msg += `• ${item.name} (${item.detail}) x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
    });
    if (sale.discount > 0) msg += `\n💰 Discount: -${formatCurrency(sale.discount)}`;
    msg += `\n*💵 Total: ${formatCurrency(sale.total)}*`;
    msg += `\n✅ Payment: ${sale.paymentMethod.toUpperCase()} · Status: ${sale.status.toUpperCase()}`;
    const url = `https://wa.me/${sale.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[500px] shadow-2xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div ref={invoiceRef}>
          {/* Professional Invoice Header */}
          <div className="flex justify-between items-start mb-3 pb-3 border-b-[3px] border-pos-secondary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pos-secondary rounded-lg flex items-center justify-center text-white font-black text-sm">
                {companyName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-black tracking-tighter">{companyName}</div>
                {bizInfoLine && <div className="text-[10px] text-pos-on-surface-variant">{bizInfoLine}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold text-pos-on-surface-variant uppercase tracking-wider">Invoice / Challan</div>
              <div className="text-sm font-black text-pos-secondary">{sale.invoice}</div>
              <div className="text-[10px] text-pos-on-surface-variant">{dateStr} · {sale.time}</div>
            </div>
          </div>

          {/* Customer Block */}
          <div className="bg-pos-surface-high rounded-lg p-3 mb-3 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9px] font-bold text-pos-on-surface-variant uppercase">{t('customer')}</div>
              <div className="text-xs font-semibold">{sale.customer}</div>
            </div>
            {sale.phone && (
              <div>
                <div className="text-[9px] font-bold text-pos-on-surface-variant uppercase">{t('phone').replace(' (optional)', '')}</div>
                <div className="text-xs font-semibold">{sale.phone}</div>
              </div>
            )}
            <div>
              <div className="text-[9px] font-bold text-pos-on-surface-variant uppercase">{t('payment')}</div>
              <div className="text-xs font-semibold capitalize">{sale.paymentMethod}</div>
            </div>
          </div>
          {sale.notes && <div className="text-[10px] text-pos-on-surface-variant italic mb-3">Notes: {sale.notes}</div>}

          {/* Items Table */}
          <table className="w-full text-left mb-3">
            <thead>
              <tr className="text-[9px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high">
                <th className="py-2 px-2 rounded-l">Product</th><th className="py-2 px-2 text-center">Qty</th><th className="py-2 px-2 text-right">Rate</th><th className="py-2 px-2 text-right rounded-r">{t('total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container text-xs">
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 px-2">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-[10px] text-pos-on-surface-variant">{item.detail}</div>
                  </td>
                  <td className="py-2 px-2 text-center">{item.qty}</td>
                  <td className="py-2 px-2 text-right text-pos-on-surface-variant">{formatCurrency(item.price)}</td>
                  <td className="py-2 px-2 text-right font-semibold">{formatCurrency(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-3">
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-xs text-pos-on-surface-variant">
                <span>{t('subtotal')}</span><span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-xs text-pos-error">
                  <span>{t('discount')}</span><span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              {(sale.delivery ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-pos-on-surface-variant">
                  <span>{t('delivery')}</span><span>+{formatCurrency(sale.delivery!)}</span>
                </div>
              )}
              {(sale.labour ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-pos-on-surface-variant">
                  <span>{t('labour')}</span><span>+{formatCurrency(sale.labour!)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base pt-1 border-t-2 border-pos-on-surface">
                <span>{t('total')}</span><span className="text-pos-secondary">{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[hsl(125,60%,35%)]">
                <span>{t('paid')}</span><span>{formatCurrency(sale.paid ?? sale.total)}</span>
              </div>
              {(sale.due ?? 0) > 0 && (
                <div className="flex justify-between text-xs font-bold text-pos-error">
                  <span>{t('due')}</span><span>{formatCurrency(sale.due!)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-pos-on-surface-variant">
                <span>{t('status')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusBadgeClass}`}>{sale.status}</span>
              </div>
            </div>
          </div>

          {/* QR + Terms */}
          <div className="flex justify-between items-end border-t border-pos-surface-container pt-3 mb-3">
            <div className="flex items-center gap-2">
              <div dangerouslySetInnerHTML={{ __html: generateQRSVG(`${sale.invoice}-${sale.total}`, 50) }} />
              <div className="text-[8px] text-pos-on-surface-variant">Scan to<br/>verify</div>
            </div>
            <div className="text-right max-w-[240px]">
              <div className="text-[9px] font-bold text-pos-on-surface mb-1">{t('termsAndConditions')}</div>
              <div className="text-[8px] text-pos-on-surface-variant leading-relaxed">
                • {t('goodsOnceDelivered')}<br/>
                • {t('priceSubjectToChange')}<br/>
                • {t('paymentDueWithin')}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-center text-pos-on-surface-variant border-t border-pos-surface-container pt-2 mb-3">
            {companyName ? `${t('thankYou').replace('!', '')} ${companyName}!` : t('thankYou')}
          </div>
        </div>

        {/* Action Buttons - 5 buttons */}
        <div className="grid grid-cols-5 gap-2">
          <button onClick={handlePrint}
            className="py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-[11px] flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-base">print</span>{t('print')}
          </button>
          <button onClick={handleThermalPrint}
            className="py-2.5 bg-pos-surface-container text-pos-on-surface rounded-lg font-semibold text-[11px] flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-base">receipt</span>{t('thermal')}
          </button>
          <button onClick={handlePDF}
            className="py-2.5 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-semibold text-[11px] flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>{t('pdf')}
          </button>
          <button onClick={handleWhatsApp}
            className="py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-[11px] flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-base">share</span>{t('whatsapp')}
          </button>
          <button onClick={onClose}
            className="py-2.5 bg-pos-error-container text-pos-on-error-container rounded-lg font-semibold text-[11px] flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-base">close</span>{t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
