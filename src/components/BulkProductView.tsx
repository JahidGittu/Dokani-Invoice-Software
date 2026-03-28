import { useState, useRef, useMemo, useCallback } from "react";
import { type Product } from "@/lib/store";
import { useProductOptions } from "@/hooks/useProductOptions";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";
import { getAutoPackaging } from "@/lib/tile-packaging";

interface BulkProductViewProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
}

interface BulkRow {
  barcode: string; category: string; name: string; brand: string;
  unit: string; height: string; width: string; piecesPerBox: string;
  buyRate: string; pricePerBox: string; stock: string; reorderLimit: string;
  matchedProduct?: Product;
  action: 'add' | 'update' | 'skip';
}

const UNIT_OPTIONS = ['SQFT', 'Piece', 'Set', 'KG', 'Litre', 'Yard', 'Feet', 'Roll', 'Box'];

const emptyRow = (): BulkRow => ({
  barcode: '', category: '', name: '', brand: '',
  unit: 'SQFT', height: '', width: '', piecesPerBox: '4',
  buyRate: '', pricePerBox: '', stock: '', reorderLimit: '',
  action: 'add',
});

export default function BulkProductView({ products, onAddProduct, onUpdateProduct }: BulkProductViewProps) {
  const { getOptions, addOption } = useProductOptions();
  const [tab, setTab] = useState<'csv' | 'grid'>('grid');
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: 3 }, emptyRow));
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV state
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [colMap, setColMap] = useState({
    name: 0, category: 1, brand: 2, unit: 3, height: 4, width: 5,
    piecesPerBox: 6, buyRate: 7, pricePerBox: 8, stock: 9, reorderLimit: 10, barcode: 11,
  });

  const matchProduct = useCallback((row: BulkRow): Product | undefined => {
    if (!row.name.trim()) return undefined;
    if (row.barcode.trim()) {
      const m = products.find(p => p.barcode && p.barcode.toLowerCase() === row.barcode.trim().toLowerCase());
      if (m) return m;
    }
    if (row.brand.trim()) {
      const m = products.find(p => p.name.toLowerCase() === row.name.trim().toLowerCase() && (p.brand || '').toLowerCase() === row.brand.trim().toLowerCase());
      if (m) return m;
    }
    return products.find(p => p.name.toLowerCase() === row.name.trim().toLowerCase());
  }, [products]);

  const processedRows = useMemo(() => {
    return rows.map(row => {
      if (!row.name.trim()) return { ...row, action: 'skip' as const, matchedProduct: undefined };
      const matched = matchProduct(row);
      return { ...row, matchedProduct: matched, action: matched ? 'update' as const : 'add' as const };
    });
  }, [rows, matchProduct]);

  const summary = useMemo(() => ({
    adds: processedRows.filter(r => r.action === 'add').length,
    updates: processedRows.filter(r => r.action === 'update').length,
    skips: processedRows.filter(r => r.action === 'skip').length,
  }), [processedRows]);

  const updateRow = (idx: number, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addOneRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  // CSV
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
      name: row[colMap.name] || '', category: row[colMap.category] || '',
      brand: row[colMap.brand] || '', unit: row[colMap.unit] || 'Piece',
      height: row[colMap.height] || '', width: row[colMap.width] || '',
      piecesPerBox: row[colMap.piecesPerBox] || '4',
      buyRate: row[colMap.buyRate] || '', pricePerBox: row[colMap.pricePerBox] || '',
      stock: row[colMap.stock] || '', reorderLimit: row[colMap.reorderLimit] || '',
      barcode: row[colMap.barcode] || '', action: 'add' as const,
    }));
    setRows(newRows);
    setTab('grid');
    toast.success(`${newRows.length} rows গ্রিডে লোড করা হয়েছে`);
  };

  const executeBulk = async () => {
    const actionable = processedRows.filter(r => r.action !== 'skip');
    if (!actionable.length) { toast.error('কোনো প্রডাক্ট পাওয়া যায়নি'); return; }

    // Validate SQFT rows
    for (const row of actionable) {
      if (row.unit === 'SQFT') {
        if (!row.height.trim() || !row.width.trim()) {
          toast.error(`"${row.name}" — SQFT ইউনিটের জন্য Height ও Width দিন`);
          return;
        }
        if (!row.piecesPerBox.trim() || parseInt(row.piecesPerBox) <= 0) {
          toast.error(`"${row.name}" — SQFT ইউনিটের জন্য Unit Per Carton দিন`);
          return;
        }
      }
    }

    setProcessing(true);
    let addCount = 0, updateCount = 0;

    for (const row of actionable) {
      try {
        if (row.action === 'add') {
          onAddProduct({
            name: row.name.trim(), category: row.category, brand: row.brand,
            size: row.height && row.width ? `${row.height}×${row.width}` : '',
            finish: '', unit: row.unit, height: row.height, width: row.width,
            piecesPerBox: parseInt(row.piecesPerBox) || 4,
            buyRate: parseFloat(row.buyRate) || 0,
            pricePerBox: parseFloat(row.pricePerBox) || 0,
            sqftPerBox: 0, stock: parseInt(row.stock) || 0,
            reorderLimit: parseInt(row.reorderLimit) || 0,
            batch: row.barcode || '', barcode: row.barcode,
          });
          addCount++;
        } else if (row.action === 'update' && row.matchedProduct) {
          const updates: Partial<Product> = {};
          if (row.category.trim()) updates.category = row.category;
          if (row.brand.trim()) updates.brand = row.brand;
          if (row.height.trim()) updates.height = row.height;
          if (row.width.trim()) updates.width = row.width;
          if (row.height.trim() && row.width.trim()) updates.size = `${row.height}×${row.width}`;
          if (row.piecesPerBox.trim()) updates.piecesPerBox = parseInt(row.piecesPerBox);
          if (row.buyRate.trim()) updates.buyRate = parseFloat(row.buyRate);
          if (row.pricePerBox.trim()) updates.pricePerBox = parseFloat(row.pricePerBox);
          if (row.stock.trim()) updates.stock = parseInt(row.stock);
          if (row.reorderLimit.trim()) updates.reorderLimit = parseInt(row.reorderLimit);
          if (row.barcode.trim()) updates.barcode = row.barcode;
          if (row.unit.trim()) updates.unit = row.unit;
          onUpdateProduct(row.matchedProduct.id, updates);
          updateCount++;
        }
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error('Bulk row error:', err);
      }
    }

    setProcessing(false);
    toast.success(`✓ ${addCount} প্রডাক্ট যোগ হয়েছে, ${updateCount} আপডেট হয়েছে`);
    setRows(Array.from({ length: 3 }, emptyRow));
  };

  const downloadTemplate = () => {
    const csv = 'Product Name,Category,Brand,Unit,Height,Width,Unit Per Carton,Buy Rate,Sales Rate,Stock,Re-Order Limit,Barcode\nRoyal Marble,Floor Tiles,RAK,SQFT,24,24,10,1200,1500,80,15,BT-001\nOcean Blue,Wall Tiles,Akij,Piece,,,4,900,1200,50,10,BT-002';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bulk_product_template.csv';
    a.click();
    toast.success('টেমপ্লেট ডাউনলোড হয়েছে');
  };

  const inputCls = "w-full bg-[hsl(220,60%,97%)] dark:bg-[hsl(220,20%,15%)] border border-[hsl(220,30%,85%)] dark:border-[hsl(220,20%,25%)] rounded text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition-all";

  const mapFields = [
    { key: 'name', label: 'Product Name' }, { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' }, { key: 'unit', label: 'Unit' },
    { key: 'height', label: 'Height' }, { key: 'width', label: 'Width' },
    { key: 'piecesPerBox', label: 'Unit Per Carton' }, { key: 'buyRate', label: 'Buy Rate' },
    { key: 'pricePerBox', label: 'Sales Rate' }, { key: 'stock', label: 'Stock' },
    { key: 'reorderLimit', label: 'Re-Order Limit' }, { key: 'barcode', label: 'Barcode' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Grid / CSV */}
      <div className="flex items-center gap-2">
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
        <button onClick={downloadTemplate}
          className="ml-auto px-3 py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-pos-surface-high transition-colors">
          <span className="material-symbols-outlined text-sm">download</span>
          টেমপ্লেট
        </button>
      </div>

      {tab === 'csv' ? (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-5 space-y-4">
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
            </div>

            <div className="bg-pos-surface-low rounded-xl p-4 border border-pos-surface-container">
              <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase tracking-widest mb-3">কলাম ম্যাপিং</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {mapFields.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-pos-on-surface w-28 flex-shrink-0">{label}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <select value={(colMap as any)[key]} onChange={e => setColMap(prev => ({ ...prev, [key]: Number(e.target.value) }))} className={`${inputCls} flex-1`}>
                      {Array.from({ length: 15 }, (_, i) => (
                        <option key={i} value={i}>Col {String.fromCharCode(65 + i)}{csvRows[0]?.[i] ? ` (${csvRows[0][i]})` : ''}</option>
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

          {csvRows.length > 1 && (
            <div className="bg-pos-surface-low rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-4 py-2.5 border-b border-pos-surface-container text-xs font-semibold">
                প্রিভিউ — {csvFileName} ({csvRows.length - 1} rows)
              </div>
              <div className="overflow-auto max-h-48">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                      {csvRows[0]?.slice(0, 12).map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {csvRows.slice(1, 6).map((row, i) => (
                      <tr key={i} className="hover:bg-pos-surface-low/50">
                        {row.slice(0, 12).map((cell, j) => <td key={j} className="px-3 py-1.5 text-[11px]">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Spreadsheet Grid */
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-container">
                  <th className="px-2 py-2.5 w-8 text-center">#</th>
                  <th className="px-2 py-2.5">Barcode</th>
                  <th className="px-2 py-2.5">Category</th>
                  <th className="px-2 py-2.5">Name *</th>
                  <th className="px-2 py-2.5">Brand</th>
                  <th className="px-2 py-2.5">Unit</th>
                  <th className="px-2 py-2.5">Height</th>
                  <th className="px-2 py-2.5">Width</th>
                  <th className="px-2 py-2.5">Per Carton</th>
                  <th className="px-2 py-2.5">Buy Rate *</th>
                  <th className="px-2 py-2.5">Sales Rate</th>
                  <th className="px-2 py-2.5">Stock</th>
                  <th className="px-2 py-2.5">Re-Order</th>
                  <th className="px-2 py-2.5 text-center">Status</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-surface-container">
                {processedRows.map((row, idx) => {
                  const isSqft = row.unit === 'SQFT';
                  return (
                    <tr key={idx} className={`transition-colors ${row.action === 'update' ? 'bg-amber-50 dark:bg-amber-950/20' : row.action === 'add' && row.name.trim() ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                      <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-1 py-1"><input value={row.barcode} onChange={e => updateRow(idx, 'barcode', e.target.value)} className={`${inputCls} min-w-[80px]`} placeholder="Barcode" /></td>
                      <td className="px-1 py-1">
                        <ComboInput value={row.category} onChange={v => updateRow(idx, 'category', v)} options={getOptions('category')} onAddNew={v => addOption('category', v)} placeholder="Category" className={`${inputCls} min-w-[100px]`} />
                      </td>
                      <td className="px-1 py-1"><input value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} className={`${inputCls} min-w-[130px]`} placeholder="নাম *" /></td>
                      <td className="px-1 py-1">
                        <ComboInput value={row.brand} onChange={v => updateRow(idx, 'brand', v)} options={getOptions('brand')} onAddNew={v => addOption('brand', v)} placeholder="Brand" className={`${inputCls} min-w-[90px]`} />
                      </td>
                      <td className="px-1 py-1">
                        <select value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)} className={`${inputCls} min-w-[70px]`}>
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.height} onChange={e => updateRow(idx, 'height', e.target.value)}
                          className={`${inputCls} min-w-[55px] ${isSqft && !row.height.trim() ? 'ring-1 ring-destructive/50' : ''}`} placeholder={isSqft ? 'Required' : '—'} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.width} onChange={e => updateRow(idx, 'width', e.target.value)}
                          className={`${inputCls} min-w-[55px] ${isSqft && !row.width.trim() ? 'ring-1 ring-destructive/50' : ''}`} placeholder={isSqft ? 'Required' : '—'} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={row.piecesPerBox} onChange={e => updateRow(idx, 'piecesPerBox', e.target.value)}
                          className={`${inputCls} min-w-[55px] ${isSqft && (!row.piecesPerBox.trim() || parseInt(row.piecesPerBox) <= 0) ? 'ring-1 ring-destructive/50' : ''}`} placeholder="4" />
                      </td>
                      <td className="px-1 py-1"><input type="number" value={row.buyRate} onChange={e => updateRow(idx, 'buyRate', e.target.value)} className={`${inputCls} min-w-[70px]`} placeholder="৳ 0" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.pricePerBox} onChange={e => updateRow(idx, 'pricePerBox', e.target.value)} className={`${inputCls} min-w-[70px]`} placeholder="৳ 0" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.stock} onChange={e => updateRow(idx, 'stock', e.target.value)} className={`${inputCls} min-w-[55px]`} placeholder="0" /></td>
                      <td className="px-1 py-1"><input type="number" value={row.reorderLimit} onChange={e => updateRow(idx, 'reorderLimit', e.target.value)} className={`${inputCls} min-w-[55px]`} placeholder="0" /></td>
                      <td className="px-2 py-1.5 text-center">
                        {row.action === 'add' && row.name.trim() ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-bold whitespace-nowrap">
                            <span className="material-symbols-outlined text-[10px]">add</span>নতুন
                          </span>
                        ) : row.action === 'update' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold whitespace-nowrap">
                            <span className="material-symbols-outlined text-[10px]">sync</span>আপডেট
                          </span>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => removeRow(idx)} className="w-5 h-5 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grid footer */}
          <div className="px-4 py-3 bg-pos-surface-low border-t border-pos-surface-container flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={addOneRow}
                className="px-3 py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-pos-surface-high transition-colors">
                <span className="material-symbols-outlined text-sm">add</span>+ ১ রো
              </button>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  নতুন: <strong>{summary.adds}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  আপডেট: <strong>{summary.updates}</strong>
                </span>
              </div>
            </div>
            <button onClick={executeBulk} disabled={processing || (summary.adds + summary.updates === 0)}
              className="px-6 py-2.5 bg-[hsl(125,60%,38%)] text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-[hsl(125,60%,32%)] transition-colors shadow-sm">
              <span className="material-symbols-outlined text-base">{processing ? 'hourglass_empty' : 'check_circle'}</span>
              {processing ? 'প্রসেসিং...' : `${summary.adds + summary.updates} প্রডাক্ট সেভ করুন`}
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-[hsl(var(--primary))]/5 rounded-lg p-3 flex gap-3 text-xs">
        <span className="material-symbols-outlined text-[hsl(var(--primary))] mt-0.5 text-sm">info</span>
        <div className="text-muted-foreground space-y-0.5">
          <div>• <strong>SQFT ইউনিট:</strong> Height, Width এবং Unit Per Carton বাধ্যতামূলক</div>
          <div>• <strong>আপডেট:</strong> Barcode, Name, বা Name+Brand মিললে আপডেট হবে</div>
          <div>• ফাঁকা রো স্বয়ংক্রিয়ভাবে স্কিপ হবে</div>
        </div>
      </div>
    </div>
  );
}
