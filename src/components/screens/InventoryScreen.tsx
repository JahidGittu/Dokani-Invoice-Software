import { useState, useEffect, useCallback } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { type Product } from "@/lib/store";
import { formatStockDisplay, totalPiecesToCartonPiece } from "@/lib/calc-utils";

interface InventoryLog {
  id: string;
  product_id: string;
  product_name: string;
  log_type: string;
  qty: number;
  total_after: number;
  note: string;
  created_at: string;
}

interface InventoryScreenProps {
  products: Product[];
  onUpdateProduct?: (id: string, updates: Partial<Product>) => void;
}

export default function InventoryScreen({ products }: InventoryScreenProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) { console.error('Fetch inventory logs error:', error); return; }
    setLogs((data || []) as InventoryLog[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const lowStockCount = products.filter(p => p.stock <= 20).length;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('warehouse')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('inventory')}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalProducts')}</div>
          <div className="text-2xl font-black text-pos-on-surface">{products.length}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalStock')}</div>
          <div className="text-2xl font-black text-pos-on-surface">{products.reduce((s, p) => s + p.stock, 0).toLocaleString()} Pcs</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2 flex items-center gap-1">{t('lowStockItems')} <InfoTooltip text="স্টক কম আছে এমন পণ্য। Settings থেকে লিমিট বদলানো যায়।" /></div>
          <div className="text-2xl font-black text-pos-error">{lowStockCount}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('outOfStockLabel')}</div>
          <div className="text-2xl font-black text-pos-error">{products.filter(p => p.stock <= 0).length}</div>
        </div>
      </div>

      {/* Current Stock Levels */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">{t('currentStockLevels')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-4 sm:px-8 py-3">{t('product')}</th><th className="px-4 sm:px-8 py-3">{t('size')}</th><th className="px-4 sm:px-8 py-3">{t('stock')}</th><th className="px-4 sm:px-8 py-3">{t('status')}</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-4 sm:px-8 py-4 font-semibold">{p.name}</td>
                  <td className="px-4 sm:px-8 py-4"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                  <td className="px-4 sm:px-8 py-4 font-bold">{formatStockDisplay(p.stock, p.piecesPerBox || 4)}</td>
                  <td className="px-4 sm:px-8 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      p.stock <= 0 ? 'bg-pos-error text-white' :
                      p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' :
                      'bg-pos-tertiary-container text-pos-on-tertiary-container'
                    }`}>
                      {p.stock <= 0 ? t('outOfStockLabel') : p.stock <= 20 ? t('lowStockLabel') : t('inStock')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movements - Real Data */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 bg-pos-surface-low flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('stockMovements')}</h3>
          <button onClick={fetchLogs} className="text-xs text-pos-primary font-semibold hover:underline">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8"><span className="w-6 h-6 border-3 border-pos-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-pos-on-surface-variant text-sm">No stock movements recorded yet</div>
          ) : (
            <table className="w-full text-left">
              <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-4 sm:px-8 py-3">{t('date')}</th><th className="px-4 sm:px-8 py-3">{t('product')}</th><th className="px-4 sm:px-8 py-3">{t('type')}</th><th className="px-4 sm:px-8 py-3">{t('qty')}</th><th className="px-4 sm:px-8 py-3">{t('totalStock')}</th><th className="px-4 sm:px-8 py-3">{t('note')}</th>
              </tr></thead>
              <tbody className="divide-y divide-pos-surface-container">
                {logs.filter(l => filterType === 'ALL' || l.log_type === filterType).map(l => {
                  const isIn = l.log_type === 'IN';
                  const prod = products.find(p => p.id === l.product_id);
                  const piecesPerBox = prod?.piecesPerBox || 4;
                  const qtyDisplay = formatStockDisplay(l.qty, piecesPerBox);
                  const totalDisplay = formatStockDisplay(l.total_after, piecesPerBox);
                  return (
                    <tr key={l.id} className="hover:bg-pos-surface-low transition-colors">
                      <td className="px-4 sm:px-8 py-4 text-xs text-pos-on-surface-variant">{formatDate(l.created_at)}</td>
                      <td className="px-4 sm:px-8 py-4 font-semibold">{l.product_name}</td>
                      <td className="px-4 sm:px-8 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isIn ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : 'bg-pos-error-container text-pos-on-error-container'}`}>{l.log_type}</span>
                      </td>
                      <td className={`px-4 sm:px-8 py-4 font-bold ${isIn ? 'text-pos-tertiary' : 'text-pos-error'}`}>{isIn ? '+' : '−'}{qtyDisplay}</td>
                      <td className="px-4 sm:px-8 py-4 font-semibold">{totalDisplay}</td>
                      <td className="px-4 sm:px-8 py-4 text-xs text-pos-on-surface-variant">{l.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
