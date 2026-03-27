import { useRef } from "react";
import { formatCurrency, type CartItem } from "@/lib/data";
import { toast } from "sonner";

interface InvoiceModalProps {
  invoiceNumber: string;
  customerName: string;
  cart: CartItem[];
  total: number;
  onClose: () => void;
}

export default function InvoiceModal({ invoiceNumber, customerName, cart, total, onClose }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) { toast('Pop-up blocked! Please allow pop-ups.'); return; }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', Arial, sans-serif; padding: 24px; color: #2d3435; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
          .title { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
          .inv-info { font-size: 11px; color: #5a6061; margin-top: 2px; }
          .badge { display: inline-block; background: #86ff90; color: #006120; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
          .customer { font-size: 12px; color: #5a6061; border-top: 1px solid #dde4e5; padding-top: 12px; margin-top: 16px; margin-bottom: 12px; }
          .customer strong { color: #2d3435; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          thead tr { border-bottom: 1px solid #dde4e5; }
          th { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #5a6061; padding: 8px 0; text-align: left; letter-spacing: 0.5px; }
          th:last-child { text-align: right; }
          td { padding: 8px 0; font-size: 12px; border-bottom: 1px solid #f2f4f4; }
          td:last-child { text-align: right; font-weight: 600; }
          .detail { font-size: 10px; color: #5a6061; }
          .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; border-top: 1px solid #dde4e5; padding-top: 12px; margin-top: 8px; }
          .total-amount { color: #005cc1; }
          .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #5a6061; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">TilePOS Lite</div>
            <div class="inv-info">Invoice #${invoiceNumber} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <span class="badge">PAID</span>
        </div>
        <div class="customer">Customer: <strong>${customerName}</strong></div>
        <table>
          <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${cart.map(c => `
              <tr>
                <td>${c.product.name}<div class="detail">${c.product.size} ${c.product.finish}</div></td>
                <td style="text-align:center">${c.qty}</td>
                <td>${formatCurrency(c.product.pricePerBox * c.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total-row">
          <span>Total</span>
          <span class="total-amount">${formatCurrency(total)}</span>
        </div>
        <div class="footer">Thank you for your business! · TilePOS Lite</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handlePDF = () => {
    // Use print dialog's "Save as PDF" option
    handlePrint();
    toast('Use "Save as PDF" in the print dialog');
  };

  return (
    <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-pos-surface-lowest rounded-xl w-96 shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div ref={invoiceRef}>
          <div className="flex justify-between items-start mb-1">
            <div>
              <div className="text-xl font-black tracking-tighter">TilePOS Lite</div>
              <div className="text-xs text-pos-on-surface-variant">Invoice #{invoiceNumber} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <span className="px-3 py-1 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-full text-[10px] font-bold">PAID</span>
          </div>
          <div className="mt-4 mb-3 text-xs text-pos-on-surface-variant border-t border-pos-surface-container pt-3">
            Customer: <strong className="text-pos-on-surface">{customerName}</strong>
          </div>
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase border-b border-pos-surface-container">
                <th className="py-2">Product</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container text-sm">
              {cart.map((c) => (
                <tr key={c.product.id}>
                  <td className="py-2">
                    {c.product.name}
                    <div className="text-[10px] text-pos-on-surface-variant">{c.product.size} {c.product.finish}</div>
                  </td>
                  <td className="py-2 text-center">{c.qty}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(c.product.pricePerBox * c.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between font-black text-lg border-t border-pos-surface-container pt-3 mb-5">
            <span>Total</span><span className="text-pos-secondary">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">print</span>Print
          </button>
          <button
            onClick={handlePDF}
            className="flex-1 py-2.5 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF
          </button>
        </div>
      </div>
    </div>
  );
}
