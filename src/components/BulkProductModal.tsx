import { useState, useRef, useMemo, useCallback } from "react";
import { type Product, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

interface BulkProductModalProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onClose: () => void;
}

interface BulkRow {
  name: string;
  category: string;
  brand: string;
  size: string;
  buyRate: string;
  pricePerBox: string;
  stock: string;
  barcode: string;
  unit: string;
  matchedProduct?: Product;
  action: 'add' | 'update' | 'skip';
}

const UNIT_OPTIONS = ['SQFT', 'Piece', 'Set', 'KG', 'Litre', 'Yard', 'Feet', 'Roll', 'Box'];

const emptyRow = (): BulkRow => ({
  name: '', category: '', brand: '', size: '', buyRate: '', pricePerBox: '', stock: '', barcode: '', unit: 'Piece', action: 'add',
});

export default function BulkProductModal({ products, onAddProduct, onUpdateProduct, onClose }: BulkProductModalProps) {
  const [tab, setTab] = useState<'csv' | 'grid'>('grid');
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: 5 }, emptyRow));
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV state
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [mapName, setMapName] = useState(0);
  const [mapCategory, setMapCategory] = useState(1);
  const [mapBrand, setMapBrand] = useState(2);
  const [mapSize, setMapSize] = useState(3);
  const [mapBuyRate, setMapBuyRate] = useState(4);
  const [mapPrice, setMapPrice] = useState(5);
  const [mapStock, setMapStock] = useState(6);
  const [mapBarcode, setMapBarcode] = useState(7);

  // Match a row against existing products
  const matchProduct = useCallback((row: BulkRow): Product | undefined => {
    if (!row.name.trim()) return undefined;
    // 1. Match by barcode
    if (row.barcode.trim()) {
      const byBarcode = products.find(p => p.barcode && p.barcode.toLowerCase() === row.barcode.trim().toLowerCase());
      if (byBarcode) return byBarcode;
    }
    // 2. Match by name + brand
    if (row.brand.trim()) {
      const byNameBrand = products.find(p =>
        p.name.toLowerCase() === row.name.trim().toLowerCase() &&
        (p.brand || '').toLowerCase() === row.brand.trim().toLowerCase()
      );
      if (byNameBrand) return byNameBrand;
    }
    // 3. Match by name only
    const byName = products.find(p => p.name.toLowerCase() === row.name.trim().toLowerCase());
    return byName;
  }, [products]);

  // Auto-detect actions when rows change
  const processedRows = useMemo(() => {
    return rows.map(row => {
      if (!row.name.trim()) return { ...row, action: 'skip' as const, matchedProduct: undefined };
      const matched = matchProduct(row);
      return { ...row, matchedProduct: matched, action: matched ? 'update' as const : 'add' as const };
    });
  }, [rows, matchProduct]);

  const summary = useMemo(() => {
    const adds = processedRows.filter(r => r.action === 'add').length;
    const updates = processedRows.filter(r => r.action === 'update').length;
    const skips = processedRows.filter(r => r.action === 'skip').length;
    return { adds, updates, skips };
  }, [processedRows]);

  // Grid handlers
  const updateRow = (idx: number, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addMoreRows = () => setRows(prev => [...prev, ...Array.from({ length: 5 }, emptyRow)]);

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  // CSV upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map(l => l.split(',').map(c => c.trim().replace(/"/g, '')));
      setCsvRows(parsed);
      setCsvFileName(file.name);
      toast.success(`${file.name} — ${parsed.length - 1} rows পাওয়া গেছে`);
    };
    reader.readAsText(file);
  };

  const loadCsvToGrid = () => {
    if (csvRows.length <= 1) { toast.error('CSV ফাইল আপলোড করুন'); return; }
    const newRows: BulkRow[] = csvRows.slice(1).map(row => ({
      name: row[mapName] || '',
      category: row[mapCategory] || '',
      brand: row[mapBrand] || '',
      size: row[mapSize] || '',
      buyRate: row[mapBuyRate] || '',
      pricePerBox: row[mapPrice] || '',
      stock: row[mapStock] || '',
      barcode: row[mapBarcode] || '',
      unit: 'Piece',
      action: 'add' as const,
    }));
    setRows(newRows);
    setTab('grid');
    toast.success(`${newRows.length} rows গ্রিডে লোড করা হয়েছে`);
  };

  // Execute bulk operations
  const executeBulk = async () => {
    const actionableRows = processedRows.filter(r => r.action !== 'skip');
    if (!actionableRows.length) { toast.error('কোনো প্রডাক্ট পাওয়া যায়নি'); return; }

    setProcessing(true);
    let addCount = 0, updateCount = 0;

    for (const row of actionableRows) {
      try {
        if (row.action === 'add') {
          onAddProduct({
            name: row.name.trim(),
            category: row.category,
            brand: row.brand,
            size: row.size,
            finish: '',
            unit: row.unit,
            height: '',
            width: '',
            piecesPerBox: 4,
            buyRate: parseFloat(row.buyRate) || 0,
            pricePerBox: parseFloat(row.pricePerBox) || 0,
            sqftPerBox: 0,
            stock: parseInt(row.stock) || 0,
            reorderLimit: 0,
            batch: row.barcode || '',
            barcode: row.barcode,
          });
          addCount++;
        } else if (row.action === 'update' && row.matchedProduct) {
          const updates: Partial<Product> = {};
          if (row.category.trim()) updates.category = row.category;
          if (row.brand.trim()) updates.brand = row.brand;
          if (row.size.trim()) updates.size = row.size;
          if (row.buyRate.trim()) updates.buyRate = parseFloat(row.buyRate);
          if (row.pricePerBox.trim()) updates.pricePerBox = parseFloat(row.pricePerBox);
          if (row.stock.trim()) updates.stock = parseInt(row.stock);
          if (row.barcode.trim()) updates.barcode = row.barcode;
          if (row.unit.trim()) updates.unit = row.unit;
          onUpdateProduct(row.matchedProduct.id, updates);
          updateCount++;
        }
        // Small delay to avoid overwhelming
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error('Bulk row error:', err);
      }
    }

    setProcessing(false);
    toast.success(`✓ ${addCount} প্রডাক্ট যোগ হয়েছে, ${updateCount} আপডেট হয়েছে`);
    setTimeout(onClose, 500);
  };

  const downloadTemplate = () => {
    const csv = 'Product Name,Category,Brand,Size,Buy Rate,Sales Rate,Stock,Barcode\nRoyal Marble,Floor Tiles,RAK,60x60,1200,1500,80,BT-001\nOcean Blue,Wall Tiles,Akij,30x60,900,1200,50,BT-002';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bulk_product_template.csv';
    a.click();
    toast.success('টেমপ্লেট ডাউনলোড হয়েছে');
  };

  const inputCls = "w-full bg-[hsl(220,60%,97%)] dark:bg-[hsl(220,20%,15%)] border border-[hsl(220,30%,85%)] dark:border-[hsl(220,20%,25%)] rounded text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition-all";

  const colHeaders = ['Product Name *', 'Category', 'Brand', 'Size', 'Buy Rate', 'Sales Rate', 'Stock', 'Barcode', 'Unit', 'Status', ''];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={onClose}>
      <div className="bg-pos-surface-lowest rounded-2xl w-full max-w-[1200px] shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-pos-surface-container flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[hsl(var(--primary))]">playlist_add</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-pos-on-surface">বাল্ক প্রডাক্ট যোগ / আপডেট</h3>
              <p className="text-xs text-muted-foreground">একসাথে অনেক প্রডাক্ট যোগ বা আপডেট করুন</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-pos-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-pos-on-surface-variant">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-2 flex-shrink-0">
          <button onClick={() => setTab('grid')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'grid' ? 'bg-[hsl(var(--primary))] text-primary-foreground' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">grid_on</span>
            স্প্রেডশীট গ্রিড
          </button>
          <button onClick={() => setTab('csv')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'csv' ? 'bg-[hsl(var(--primary))] text-primary-foreground' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">upload_file</span>
            CSV ইম্পোর্ট
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col px-5 pb-2">
          {tab === 'csv' ? (
            <div className="space-y-4 py-3 overflow-y-auto">
              {/* CSV Upload Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-pos-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-all">
                    <span className="material-symbols-outlined text-4xl text-pos-on-surface-variant mb-2 block">cloud_upload</span>
                    <div className="font-semibold text-sm text-pos-on-surface">CSV ফাইল আপলোড করুন</div>
                    <div className="text-xs text-pos-on-surface-variant mt-1">শুধুমাত্র .csv ফাইল সাপোর্ট করে</div>
                    {csvFileName && <div className="mt-2 text-xs text-[hsl(var(--primary))] font-bold">✓ {csvFileName} — {csvRows.length - 1} rows</div>}
                  </div>
                  <input ref={fileRef} type="file" className="hidden" accept=".csv" onChange={handleCsvUpload} />

                  <button onClick={downloadTemplate}
                    className="w-full px-4 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-pos-surface-high transition-colors">
                    <span className="material-symbols-outlined text-base">download</span>
                    স্যাম্পল টেমপ্লেট ডাউনলোড
                  </button>
                </div>

                {/* Column mapping */}
                <div className="bg-pos-surface-low rounded-xl p-4 border border-pos-surface-container">
                  <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase tracking-widest mb-3">কলাম ম্যাপিং</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Product Name', val: mapName, set: setMapName },
                      { label: 'Category', val: mapCategory, set: setMapCategory },
                      { label: 'Brand', val: mapBrand, set: setMapBrand },
                      { label: 'Size', val: mapSize, set: setMapSize },
                      { label: 'Buy Rate', val: mapBuyRate, set: setMapBuyRate },
                      { label: 'Sales Rate', val: mapPrice, set: setMapPrice },
                      { label: 'Stock', val: mapStock, set: setMapStock },
                      { label: 'Barcode', val: mapBarcode, set: setMapBarcode },
                    ].map(({ label, val, set }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-pos-on-surface w-24 flex-shrink-0">{label}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <select value={val} onChange={e => set(Number(e.target.value))} className={`${inputCls} flex-1`}>
                          {['Col A', 'Col B', 'Col C', 'Col D', 'Col E', 'Col F', 'Col G', 'Col H', 'Col I', 'Col J'].map((c, i) => (
                            <option key={i} value={i}>{c}{csvRows[0]?.[i] ? ` (${csvRows[0][i]})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={loadCsvToGrid} disabled={csvRows.length <= 1}
                    className="mt-4 w-full py-2.5 bg-[hsl(var(--primary))] text-primary-foreground rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                    গ্রিডে লোড করুন
                  </button>
                </div>
              </div>

              {/* CSV Preview */}
              {csvRows.length > 1 && (
                <div className="bg-pos-surface-low rounded-xl border border-pos-surface-container overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-pos-surface-container text-xs font-semibold">
                    প্রিভিউ — {csvFileName} ({csvRows.length - 1} rows)
                  </div>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                          {csvRows[0]?.slice(0, 8).map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pos-surface-container">
                        {csvRows.slice(1, 6).map((row, i) => (
                          <tr key={i} className="hover:bg-pos-surface-low/50">
                            {row.slice(0, 8).map((cell, j) => <td key={j} className="px-3 py-1.5 text-[11px]">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Spreadsheet Grid Tab */
            <div className="flex-1 overflow-auto py-3">
              <div className="bg-pos-surface-low rounded-xl border border-pos-surface-container overflow-hidden">
                <div className="overflow-auto max-h-[calc(92vh-320px)]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-container">
                        <th className="px-2 py-2.5 w-8 text-center">#</th>
                        {colHeaders.map((h, i) => (
                          <th key={i} className="px-2 py-2.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pos-surface-container">
                      {processedRows.map((row, idx) => (
                        <tr key={idx} className={`transition-colors ${row.action === 'update' ? 'bg-amber-50 dark:bg-amber-950/20' : row.action === 'add' && row.name.trim() ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                          <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="px-1 py-1"><input value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} className={`${inputCls} min-w-[140px]`} placeholder="নাম *" /></td>
                          <td className="px-1 py-1"><input value={row.category} onChange={e => updateRow(idx, 'category', e.target.value)} className={`${inputCls} min-w-[100px]`} placeholder="Category" /></td>
                          <td className="px-1 py-1"><input value={row.brand} onChange={e => updateRow(idx, 'brand', e.target.value)} className={`${inputCls} min-w-[90px]`} placeholder="Brand" /></td>
                          <td className="px-1 py-1"><input value={row.size} onChange={e => updateRow(idx, 'size', e.target.value)} className={`${inputCls} min-w-[70px]`} placeholder="Size" /></td>
                          <td className="px-1 py-1"><input type="number" value={row.buyRate} onChange={e => updateRow(idx, 'buyRate', e.target.value)} className={`${inputCls} min-w-[75px]`} placeholder="৳ 0" /></td>
                          <td className="px-1 py-1"><input type="number" value={row.pricePerBox} onChange={e => updateRow(idx, 'pricePerBox', e.target.value)} className={`${inputCls} min-w-[75px]`} placeholder="৳ 0" /></td>
                          <td className="px-1 py-1"><input type="number" value={row.stock} onChange={e => updateRow(idx, 'stock', e.target.value)} className={`${inputCls} min-w-[60px]`} placeholder="0" /></td>
                          <td className="px-1 py-1"><input value={row.barcode} onChange={e => updateRow(idx, 'barcode', e.target.value)} className={`${inputCls} min-w-[80px]`} placeholder="Barcode" /></td>
                          <td className="px-1 py-1">
                            <select value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)} className={`${inputCls} min-w-[70px]`}>
                              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {row.action === 'add' && row.name.trim() ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[10px]">add</span>নতুন
                              </span>
                            ) : row.action === 'update' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[10px]">sync</span>আপডেট
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => removeRow(idx)} className="w-5 h-5 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button onClick={addMoreRows}
                className="mt-3 px-4 py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-pos-surface-high transition-colors">
                <span className="material-symbols-outlined text-sm">add</span>আরও ৫টি রো যোগ করুন
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-pos-surface-container flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              নতুন যোগ: <strong>{summary.adds}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              আপডেট: <strong>{summary.updates}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-300"></span>
              স্কিপ: <strong>{summary.skips}</strong>
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors">
              বাতিল
            </button>
            <button onClick={executeBulk} disabled={processing || (summary.adds + summary.updates === 0)}
              className="px-6 py-2.5 bg-[hsl(var(--primary))] text-primary-foreground rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-base">{processing ? 'hourglass_empty' : 'check_circle'}</span>
              {processing ? 'প্রসেসিং...' : `${summary.adds + summary.updates} প্রডাক্ট সেভ করুন`}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="px-5 pb-4 flex-shrink-0">
          <div className="bg-[hsl(var(--primary))]/5 rounded-lg p-3 flex gap-3 text-xs">
            <span className="material-symbols-outlined text-[hsl(var(--primary))] mt-0.5 text-sm">info</span>
            <div className="text-muted-foreground space-y-0.5">
              <div>• <strong>নতুন প্রডাক্ট:</strong> নাম না মিললে নতুন হিসেবে যোগ হবে</div>
              <div>• <strong>আপডেট:</strong> Barcode, Name, বা Name+Brand মিললে আপডেট হবে</div>
              <div>• ফাঁকা রো স্বয়ংক্রিয়ভাবে স্কিপ হবে</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
