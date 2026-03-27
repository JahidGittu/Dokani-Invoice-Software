import { useRef } from "react";
import { formatCurrency, type SaleRecord } from "@/lib/store";
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
body{font-family:'Inter','Segoe UI',Arial,sans-serif;padding:40px;color:#2d3435;font-size:13px;max-width:700px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #005cc1;margin-bottom:16px}
.logo-area{display:flex;align-items:center;gap:12px}
.logo-box{width:44px;height:44px;background:#005cc1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px}
.title{font-size:22px;font-weight:900;letter-spacing:-.5px;color:#2d3435}
.subtitle{font-size:10px;color:#5a6061;margin-top:2px}
.inv-info{text-align:right}
.inv-num{font-size:14px;font-weight:800;color:#005cc1;letter-spacing:.5px}
.inv-date{font-size:11px;color:#5a6061;margin-top:2px}
.inv-label{font-size:9px;font-weight:700;color:#5a6061;text-transform:uppercase;letter-spacing:1px}
.customer-block{display:flex;justify-content:space-between;background:#f5f7f8;border-radius:8px;padding:14px 16px;margin-bottom:16px}
.customer-block .label{font-size:9px;font-weight:700;text-transform:uppercase;color:#5a6061;letter-spacing:.5px;margin-bottom:4px}
.customer-block .value{font-size:12px;font-weight:600;color:#2d3435}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#f5f7f8}
th{font-size:10px;font-weight:700;text-transform:uppercase;color:#5a6061;padding:10px 12px;text-align:left;letter-spacing:.5px}
th:nth-child(2),th:nth-child(3){text-align:center}
th:last-child{text-align:right}
td{padding:10px 12px;font-size:12px;border-bottom:1px solid #f0f2f3}
td:nth-child(2),td:nth-child(3){text-align:center}
td:last-child{text-align:right;font-weight:600}
.detail{font-size:10px;color:#5a6061}
.summary{display:flex;justify-content:flex-end}
.summary-table{width:220px}
.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px}
.summary-row.total{font-size:18px;font-weight:900;padding:10px 0;border-top:2px solid #2d3435;margin-top:6px}
.total-amount{color:#005cc1}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase}
.badge-paid{background:#86ff90;color:#006120}
.badge-pending{background:#fef08a;color:#854f0b}
.badge-credit{background:#d8e2ff;color:#003d85}
.footer-area{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;border-top:1px solid #f0f2f3;padding-top:16px}
.qr-area{display:flex;align-items:center;gap:8px}
.qr-label{font-size:8px;color:#5a6061;text-align:center}
.terms{font-size:9px;color:#5a6061;max-width:320px;line-height:1.5}
.terms strong{font-size:10px;color:#2d3435}
.thank-you{text-align:center;font-size:10px;color:#5a6061;margin-top:16px;padding-top:12px;border-top:1px solid #f0f2f3}
@media print{body{padding:24px}}
</style></head><body>
<div class="header">
  <div class="logo-area">
    <div class="logo-box">${companyName.slice(0, 2).toUpperCase()}</div>
    <div><div class="title">${companyName}</div>${bizInfoLine ? `<div class="subtitle">${bizInfoLine}</div>` : ''}</div>
  </div>
  <div class="inv-info">
    <div class="inv-label">INVOICE / CHALLAN</div>
    <div class="inv-num">${sale.invoice}</div>
    <div class="inv-date">${dateStr} · ${sale.time}</div>
  </div>
</div>
<div class="customer-block">
  <div><div class="label">Customer</div><div class="value">${sale.customer}</div></div>
  ${sale.phone ? `<div><div class="label">Phone</div><div class="value">${sale.phone}</div></div>` : ''}
  ${sale.address ? `<div><div class="label">Address</div><div class="value">${sale.address}</div></div>` : ''}
  <div><div class="label">Payment</div><div class="value" style="text-transform:capitalize">${sale.paymentMethod}</div></div>
</div>
${sale.notes ? `<div style="font-size:11px;color:#5a6061;margin-bottom:12px;font-style:italic">Notes: ${sale.notes}</div>` : ''}
<table>
  <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
  <tbody>${sale.items.map((item, i) => `
    <tr><td>${item.name}<div class="detail">${item.detail}</div></td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.price * item.qty)}</td></tr>
  `).join('')}</tbody>
</table>
<div class="summary"><div class="summary-table">
  <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
  ${sale.discount > 0 ? `<div class="summary-row" style="color:#9f403d"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
  ${(sale.delivery ?? 0) > 0 ? `<div class="summary-row"><span>Delivery</span><span>+${formatCurrency(sale.delivery!)}</span></div>` : ''}
  ${(sale.labour ?? 0) > 0 ? `<div class="summary-row"><span>Labour</span><span>+${formatCurrency(sale.labour!)}</span></div>` : ''}
  <div class="summary-row total"><span>TOTAL</span><span class="total-amount">${formatCurrency(sale.total)}</span></div>
  <div class="summary-row" style="font-weight:700;color:#006120"><span>Paid</span><span>${formatCurrency(sale.paid ?? sale.total)}</span></div>
  ${(sale.due ?? 0) > 0 ? `<div class="summary-row" style="font-weight:700;color:#9f403d"><span>Due</span><span>${formatCurrency(sale.due!)}</span></div>` : ''}
  <div class="summary-row"><span>Status</span><span class="badge badge-${sale.status}">${sale.status.toUpperCase()}</span></div>
</div></div>
<div class="footer-area">
  <div class="qr-area">${qrSVG}<div class="qr-label">Scan to verify</div></div>
  <div class="terms"><strong>Terms & Conditions</strong><br>• Goods once delivered cannot be returned.<br>• Prices subject to change without notice.<br>• Credit payment due within 30 days.</div>
</div>
<div class="thank-you">${companyName ? `Thank you for shopping at ${companyName}!` : 'Thank you for your business!'}</div>
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
