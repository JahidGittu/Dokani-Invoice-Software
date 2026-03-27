import { useRef } from "react";
import { formatCurrency, type SaleRecord } from "@/lib/store";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface InvoiceModalProps {
  sale: SaleRecord;
  companyName: string;
  onClose: () => void;
}

// Extend jsPDF type for autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export default function InvoiceModal({ sale, companyName, onClose }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const dateStr = sale.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const generatePrintHTML = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${sale.invoice}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 28px; color: #2d3435; font-size: 12px; max-width: 400px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
        .inv-info { font-size: 11px; color: #5a6061; margin-top: 2px; }
        .badge { display: inline-block; background: #86ff90; color: #006120; padding: 3px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        .customer-info { font-size: 12px; color: #5a6061; border-top: 1px solid #dde4e5; padding-top: 12px; margin-top: 16px; margin-bottom: 12px; }
        .customer-info strong { color: #2d3435; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        thead tr { border-bottom: 2px solid #dde4e5; }
        th { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #5a6061; padding: 8px 0; text-align: left; letter-spacing: 0.5px; }
        th:nth-child(2) { text-align: center; }
        th:last-child { text-align: right; }
        td { padding: 8px 0; font-size: 12px; border-bottom: 1px solid #f2f4f4; }
        td:nth-child(2) { text-align: center; }
        td:last-child { text-align: right; font-weight: 600; }
        .detail { font-size: 10px; color: #5a6061; }
        .summary { border-top: 2px solid #dde4e5; padding-top: 8px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .summary-row.total { font-size: 18px; font-weight: 900; padding-top: 8px; border-top: 1px solid #dde4e5; margin-top: 4px; }
        .total-amount { color: #005cc1; }
        .payment-badge { display: inline-block; background: #d8e2ff; color: #003d85; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: capitalize; }
        .footer { text-align: center; margin-top: 28px; font-size: 10px; color: #5a6061; border-top: 1px solid #f2f4f4; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">${companyName}</div>
          <div class="inv-info">Invoice #${sale.invoice} · ${dateStr}</div>
        </div>
        <span class="badge">${sale.status.toUpperCase()}</span>
      </div>
      <div class="customer-info">
        Customer: <strong>${sale.customer}</strong>
        ${sale.phone ? `<br/>Phone: <strong>${sale.phone}</strong>` : ''}
      </div>
      <table>
        <thead><tr><th>Product</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td>${item.name}<div class="detail">${item.detail}</div></td>
              <td>${item.qty}</td>
              <td>${formatCurrency(item.price * item.qty)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
        ${sale.discount > 0 ? `<div class="summary-row" style="color:#9f403d"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span class="total-amount">${formatCurrency(sale.total)}</span></div>
        <div class="summary-row" style="margin-top:8px"><span>Payment</span><span class="payment-badge">${sale.paymentMethod}</span></div>
        ${sale.notes ? `<div class="summary-row"><span>Note</span><span style="font-style:italic">${sale.notes}</span></div>` : ''}
      </div>
      <div class="footer">Thank you for your business! · ${companyName}</div>
    </body>
    </html>
  `;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=650');
    if (!printWindow) { toast.error('Pop-up blocked! Please allow pop-ups.'); return; }
    printWindow.document.write(generatePrintHTML());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] }); // receipt size
    const w = 80;
    let y = 10;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, w / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #${sale.invoice} • ${dateStr}`, w / 2, y, { align: 'center' });
    y += 6;

    // Customer
    doc.setDrawColor(200);
    doc.line(5, y, w - 5, y);
    y += 4;
    doc.setFontSize(8);
    doc.text(`Customer: ${sale.customer}`, 5, y);
    y += 3.5;
    if (sale.phone) { doc.text(`Phone: ${sale.phone}`, 5, y); y += 3.5; }
    y += 2;

    // Table
    const tableData = sale.items.map(item => [
      `${item.name}\n${item.detail}`,
      String(item.qty),
      formatCurrency(item.price * item.qty),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Product', 'Qty', 'Total']],
      body: tableData,
      theme: 'plain',
      margin: { left: 5, right: 5 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fontStyle: 'bold', fontSize: 7, textColor: [90, 96, 97] },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 22, halign: 'right' },
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    // Totals
    doc.setDrawColor(200);
    doc.line(5, y, w - 5, y);
    y += 4;
    doc.setFontSize(8);
    doc.text('Subtotal', 5, y);
    doc.text(formatCurrency(sale.subtotal), w - 5, y, { align: 'right' });
    y += 4;

    if (sale.discount > 0) {
      doc.setTextColor(159, 64, 61);
      doc.text('Discount', 5, y);
      doc.text(`-${formatCurrency(sale.discount)}`, w - 5, y, { align: 'right' });
      doc.setTextColor(0);
      y += 4;
    }

    doc.setDrawColor(200);
    doc.line(5, y, w - 5, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 5, y);
    doc.text(formatCurrency(sale.total), w - 5, y, { align: 'right' });
    y += 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment: ${sale.paymentMethod.toUpperCase()}`, 5, y);
    y += 5;

    if (sale.notes) {
      doc.text(`Note: ${sale.notes}`, 5, y);
      y += 5;
    }

    // Footer
    doc.setDrawColor(230);
    doc.line(5, y, w - 5, y);
    y += 4;
    doc.setFontSize(7);
    doc.text(`Thank you! • ${companyName}`, w / 2, y, { align: 'center' });

    // Resize page to content
    const pageHeight = y + 10;
    doc.internal.pageSize.height = pageHeight;

    doc.save(`${sale.invoice}.pdf`);
    toast.success('PDF downloaded!');
  };

  const handleWhatsApp = () => {
    let msg = `*${companyName}*\n`;
    msg += `Invoice: ${sale.invoice}\nDate: ${dateStr}\n`;
    msg += `Customer: ${sale.customer}\n`;
    if (sale.phone) msg += `Phone: ${sale.phone}\n`;
    msg += `\n*Items:*\n`;
    sale.items.forEach(item => {
      msg += `• ${item.name} (${item.detail}) x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
    });
    if (sale.discount > 0) msg += `\nDiscount: -${formatCurrency(sale.discount)}`;
    msg += `\n*Total: ${formatCurrency(sale.total)}*`;
    msg += `\nPayment: ${sale.paymentMethod.toUpperCase()}`;
    
    const url = `https://wa.me/${sale.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-pos-surface-lowest rounded-xl w-[420px] shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div ref={invoiceRef}>
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-1">
            <div>
              <div className="text-xl font-black tracking-tighter">{companyName}</div>
              <div className="text-xs text-pos-on-surface-variant">Invoice #{sale.invoice} · {dateStr}</div>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${sale.status === 'Paid' ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : 'bg-pos-surface-container text-pos-on-surface-variant'}`}>
              {sale.status.toUpperCase()}
            </span>
          </div>

          {/* Customer */}
          <div className="mt-4 mb-3 text-xs text-pos-on-surface-variant border-t border-pos-surface-container pt-3">
            <div>Customer: <strong className="text-pos-on-surface">{sale.customer}</strong></div>
            {sale.phone && <div>Phone: <strong className="text-pos-on-surface">{sale.phone}</strong></div>}
          </div>

          {/* Items Table */}
          <table className="w-full text-left mb-3">
            <thead>
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase border-b border-pos-surface-container">
                <th className="py-2">Product</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Total</th>
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
                  <td className="py-2 text-right font-semibold">{formatCurrency(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-pos-surface-container pt-2 space-y-1">
            <div className="flex justify-between text-xs text-pos-on-surface-variant">
              <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-xs text-pos-error">
                <span>Discount</span><span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg pt-2 border-t border-pos-surface-container">
              <span>Total</span><span className="text-pos-secondary">{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-pos-on-surface-variant">Payment</span>
              <span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-[10px] font-bold capitalize">{sale.paymentMethod}</span>
            </div>
            {sale.notes && (
              <div className="text-xs text-pos-on-surface-variant italic pt-1">Note: {sale.notes}</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">print</span>Print
          </button>
          <button
            onClick={handlePDF}
            className="flex-1 py-2.5 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">share</span>WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
