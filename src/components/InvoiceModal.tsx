import { useRef } from "react";
import { formatCurrency, type SaleRecord } from "@/lib/store";
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

// Extend jsPDF type for autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export default function InvoiceModal({ sale, companyName, companyPhone, companyAddress, onClose }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const dateStr = (() => {
    try {
      return new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return sale.date;
    }
  })();

  const bizInfoLine = [companyPhone, companyAddress].filter(Boolean).join(' · ');

  const statusBadgeClass = sale.status === 'paid'
    ? 'bg-[#86ff90] text-[#006120]'
    : sale.status === 'pending'
    ? 'bg-[#fef08a] text-[#854f0b]'
    : 'bg-[#d8e2ff] text-[#003d85]';

  const generatePrintHTML = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${sale.invoice}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 40px; color: #2d3435; font-size: 13px; max-width: 700px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .title { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
        .biz-info { font-size: 11px; color: #5a6061; margin-top: 2px; }
        .inv-info { text-align: right; }
        .inv-num { font-size: 12px; font-weight: 700; }
        .inv-date { font-size: 11px; color: #5a6061; }
        .customer-info { font-size: 12px; color: #5a6061; border-top: 1px solid #dde4e5; padding-top: 14px; margin-top: 18px; margin-bottom: 8px; }
        .customer-info strong { color: #2d3435; }
        .notes { font-size: 11px; color: #5a6061; margin-bottom: 12px; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead tr { border-bottom: 2px solid #dde4e5; }
        th { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #5a6061; padding: 10px 0; text-align: left; letter-spacing: 0.5px; }
        th:nth-child(2) { text-align: center; }
        th:nth-child(3) { text-align: right; }
        th:last-child { text-align: right; }
        td { padding: 10px 0; font-size: 13px; border-bottom: 1px solid #f2f4f4; }
        td:nth-child(2) { text-align: center; }
        td:nth-child(3) { text-align: right; }
        td:last-child { text-align: right; font-weight: 600; }
        .detail { font-size: 10px; color: #5a6061; }
        .summary { border-top: 2px solid #dde4e5; padding-top: 10px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .summary-row.total { font-size: 20px; font-weight: 900; padding-top: 10px; border-top: 1px solid #dde4e5; margin-top: 6px; }
        .total-amount { color: #005cc1; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-paid { background: #86ff90; color: #006120; }
        .badge-pending { background: #fef08a; color: #854f0b; }
        .badge-credit { background: #d8e2ff; color: #003d85; }
        .footer { text-align: center; margin-top: 32px; font-size: 10px; color: #5a6061; border-top: 1px solid #f2f4f4; padding-top: 14px; }
        @media print { body { padding: 24px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">${companyName}</div>
          ${bizInfoLine ? `<div class="biz-info">${bizInfoLine}</div>` : ''}
        </div>
        <div class="inv-info">
          <div class="inv-num">${sale.invoice}</div>
          <div class="inv-date">${dateStr}</div>
        </div>
      </div>
      <div class="customer-info">
        Customer: <strong>${sale.customer}</strong>
        ${sale.phone ? `<span> · Phone: <strong>${sale.phone}</strong></span>` : ''}
      </div>
      ${sale.notes ? `<div class="notes">Notes: ${sale.notes}</div>` : ''}
      <table>
        <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td>${item.name}<div class="detail">${item.detail}</div></td>
              <td>${item.qty}</td>
              <td>${formatCurrency(item.price)}</td>
              <td>${formatCurrency(item.price * item.qty)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
        ${sale.discount > 0 ? `<div class="summary-row" style="color:#9f403d"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span class="total-amount">${formatCurrency(sale.total)}</span></div>
        <div class="summary-row" style="margin-top:8px"><span>Payment</span><span style="font-weight:600;text-transform:capitalize">${sale.paymentMethod}</span></div>
        <div class="summary-row"><span>Status</span><span class="badge badge-${sale.status}">${sale.status.toUpperCase()}</span></div>
      </div>
      <div class="footer">${companyName ? `Thank you for shopping at ${companyName}!` : 'Thank you for your business!'}</div>
    </body>
    </html>
  `;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) { toast.error('Pop-up blocked! Please allow pop-ups.'); return; }
    printWindow.document.write(generatePrintHTML());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const w = 148;
    let y = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 15, y);
    if (bizInfoLine) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(bizInfoLine, 15, y);
    }

    // Invoice info (right aligned)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(sale.invoice, w - 15, 20, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, w - 15, 26, { align: 'right' });

    y = Math.max(y, 26) + 10;

    // Customer
    doc.setFontSize(9);
    doc.text(`Customer: ${sale.customer}`, 15, y);
    if (sale.phone) {
      y += 5;
      doc.text(`Phone: ${sale.phone}`, 15, y);
    }
    if (sale.notes) {
      y += 5;
      doc.setFontSize(8);
      doc.text(`Notes: ${sale.notes}`, 15, y);
    }
    y += 4;

    // Line
    doc.setDrawColor(200);
    doc.line(15, y, w - 15, y);
    y += 2;

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
      theme: 'plain',
      margin: { left: 15, right: 15 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fontStyle: 'bold', fontSize: 8, textColor: [90, 96, 97] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
      },
    });

    y = doc.lastAutoTable.finalY + 6;

    // Totals
    doc.setDrawColor(200);
    doc.line(15, y, w - 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.text('Subtotal', 80, y, { align: 'right' });
    doc.text(formatCurrency(sale.subtotal), w - 15, y, { align: 'right' });
    y += 5;

    if (sale.discount > 0) {
      doc.setTextColor(159, 64, 61);
      doc.text('Discount', 80, y, { align: 'right' });
      doc.text(`-${formatCurrency(sale.discount)}`, w - 15, y, { align: 'right' });
      doc.setTextColor(0);
      y += 5;
    }

    doc.setDrawColor(200);
    doc.line(15, y, w - 15, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 80, y, { align: 'right' });
    doc.text(formatCurrency(sale.total), w - 15, y, { align: 'right' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment: ${sale.paymentMethod.toUpperCase()} · Status: ${sale.status.toUpperCase()}`, 15, y);
    y += 10;

    // Footer
    doc.setFontSize(7);
    doc.text(companyName ? `Thank you for shopping at ${companyName}!` : 'Thank you for your business!', w / 2, y, { align: 'center' });

    doc.save(`${sale.invoice}.pdf`);
    toast.success('PDF downloaded!');
  };

  const handleWhatsApp = () => {
    let msg = `*${companyName}*\n`;
    if (bizInfoLine) msg += `${bizInfoLine}\n`;
    msg += `Invoice: ${sale.invoice}\nDate: ${dateStr}\n`;
    msg += `Customer: ${sale.customer}\n`;
    if (sale.phone) msg += `Phone: ${sale.phone}\n`;
    msg += `\n*Items:*\n`;
    sale.items.forEach(item => {
      msg += `• ${item.name} (${item.detail}) x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
    });
    if (sale.discount > 0) msg += `\nDiscount: -${formatCurrency(sale.discount)}`;
    msg += `\n*Total: ${formatCurrency(sale.total)}*`;
    msg += `\nPayment: ${sale.paymentMethod.toUpperCase()} · Status: ${sale.status.toUpperCase()}`;

    const url = `https://wa.me/${sale.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-pos-surface-lowest rounded-xl w-[460px] shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div ref={invoiceRef}>
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-1">
            <div>
              <div className="text-xl font-black tracking-tighter">{companyName}</div>
              {bizInfoLine && <div className="text-xs text-pos-on-surface-variant">{bizInfoLine}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-pos-on-surface">{sale.invoice}</div>
              <div className="text-xs text-pos-on-surface-variant">{dateStr}</div>
            </div>
          </div>

          {/* Customer */}
          <div className="mt-4 mb-1 text-xs text-pos-on-surface-variant border-t border-pos-surface-container pt-3">
            <div>Customer: <strong className="text-pos-on-surface">{sale.customer}</strong>
              {sale.phone && <span> · Phone: <strong className="text-pos-on-surface">{sale.phone}</strong></span>}
            </div>
          </div>
          {sale.notes && <div className="text-xs text-pos-on-surface-variant italic mb-3">Notes: {sale.notes}</div>}

          {/* Items Table with Rate column */}
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase border-b border-pos-surface-container">
                <th className="py-2">Product</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Rate</th><th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container text-sm">
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2">
                    {item.name}
                    <div className="text-[10px] text-pos-on-surface-variant">{item.detail}</div>
                  </td>
                  <td className="py-2 text-center">{item.qty}</td>
                  <td className="py-2 text-right text-pos-on-surface-variant">{formatCurrency(item.price)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="space-y-1 border-t border-pos-surface-container pt-3 mb-5">
            <div className="flex justify-between text-sm text-pos-on-surface-variant">
              <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm text-pos-error">
                <span>Discount</span><span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Total</span><span className="text-pos-secondary">{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-pos-on-surface-variant">
              <span>Payment</span><span className="capitalize font-semibold">{sale.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-xs text-pos-on-surface-variant">
              <span>Status</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass}`}>
                {sale.status}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-center text-pos-on-surface-variant border-t border-pos-surface-container pt-3 mb-4">
            {companyName ? `Thank you for shopping at ${companyName}!` : 'Thank you for your business!'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button onClick={handlePrint}
            className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">print</span>Print
          </button>
          <button onClick={handlePDF}
            className="flex-1 py-2.5 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF
          </button>
          <button onClick={handleWhatsApp}
            className="flex-1 py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">share</span>WhatsApp
          </button>
          <button onClick={onClose}
            className="py-2.5 px-4 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
