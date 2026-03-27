import { useState, useRef } from "react";
import { type Product } from "@/lib/store";
import { toast } from "sonner";

interface ExcelImportScreenProps {
  products: Product[];
  onImportProducts: (newProducts: Omit<Product, 'id'>[]) => void;
}

export default function ExcelImportScreen({ products, onImportProducts }: ExcelImportScreenProps) {
  const [importedRows, setImportedRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Column mapping
  const [mapName, setMapName] = useState('0');
  const [mapPrice, setMapPrice] = useState('1');
  const [mapQty, setMapQty] = useState('2');
  const [mapSize, setMapSize] = useState('3');
  const [mapFinish, setMapFinish] = useState('4');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map(l => l.split(',').map(c => c.trim().replace(/"/g, '')));
      setImportedRows(parsed);
      setFileName(file.name);
      toast.success(`${file.name} loaded — ${parsed.length - 1} rows found!`);
    };
    reader.readAsText(file);
  };

  const runImport = () => {
    if (!importedRows.length) { toast.error('Upload a file first!'); return; }
    setImporting(true);
    setProgress(0);

    const ni = parseInt(mapName);
    const pi = parseInt(mapPrice);
    const qi = parseInt(mapQty);
    const si = parseInt(mapSize);
    const fi = parseInt(mapFinish);

    let w = 0;
    const iv = setInterval(() => {
      w += 15;
      setProgress(Math.min(w, 100));
      if (w >= 100) {
        clearInterval(iv);
        const newProducts: Omit<Product, 'id'>[] = [];
        importedRows.slice(1).forEach(row => {
          const name = row[ni];
          const price = parseFloat(row[pi]);
          const qty = parseInt(row[qi]);
          if (!name || isNaN(price) || isNaN(qty)) return;
          // Check existing
          const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase());
          if (!existing) {
            newProducts.push({
              name,
              size: row[si] || '—',
              finish: row[fi] || 'Glossy',
              pricePerBox: price,
              sqftPerBox: 0,
              stock: qty,
              batch: 'Imported',
            });
          }
        });
        onImportProducts(newProducts);
        toast.success(`✓ ${newProducts.length} products imported!`);
        setTimeout(() => setImporting(false), 1500);
      }
    }, 160);
  };

  const downloadTemplate = () => {
    const csv = 'Product Name,Price per Box,Stock (Boxes),Size,Finish\nRoyal Marble,1500,80,60x60,Glossy\nOcean Blue,1200,50,30x60,Matte';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tilepos_template.csv';
    a.click();
    toast.success('Template downloaded!');
  };

  const colOptions = ['Column A', 'Column B', 'Column C', 'Column D', 'Column E', 'Column F'];

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Data Management</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Excel Import</h2>
        </div>
        <button onClick={downloadTemplate} className="px-6 py-3 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-medium flex items-center gap-2 hover:brightness-95 transition-all">
          <span className="material-symbols-outlined text-lg">download</span>Sample Template
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-5">
          {/* Upload zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-pos-outline-variant rounded-xl p-10 text-center cursor-pointer hover:border-pos-secondary hover:bg-pos-secondary-container/30 transition-all"
          >
            <span className="material-symbols-outlined text-5xl text-pos-on-surface-variant mb-3 block">cloud_upload</span>
            <div className="font-semibold text-pos-on-surface mb-1">Click to upload Excel / CSV file</div>
            <div className="text-sm text-pos-on-surface-variant">Supports .xlsx, .xls, .csv</div>
            {fileName && (
              <div className="mt-3 text-xs text-pos-secondary font-bold">✓ {fileName} loaded — {importedRows.length - 1} rows</div>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />

          {/* Column Mapping */}
          <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Column Mapping</h3>
            <div className="space-y-3">
              {[
                { label: 'Tile Name →', value: mapName, set: setMapName },
                { label: 'Rate →', value: mapPrice, set: setMapPrice },
                { label: 'Qty →', value: mapQty, set: setMapQty },
                { label: 'Size →', value: mapSize, set: setMapSize },
                { label: 'Finish →', value: mapFinish, set: setMapFinish },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-pos-on-surface w-32 flex-shrink-0">{label}</span>
                  <select value={value} onChange={e => set(e.target.value)}
                    className="flex-1 bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 outline-none">
                    {colOptions.map((c, i) => <option key={i} value={String(i)}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {importing && (
              <div className="mt-4">
                <div className="text-xs text-pos-on-surface-variant mb-2">Importing data...</div>
                <div className="h-2 bg-pos-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-pos-secondary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button onClick={runImport}
              className="mt-5 w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform">
              <span className="material-symbols-outlined">upload</span>Import Data
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
          <div className="px-6 py-4 bg-pos-surface-low border-b border-pos-surface-container">
            <h3 className="text-sm font-semibold">{fileName ? `Preview — ${fileName}` : 'Preview (upload a file to see data)'}</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Qty</th><th className="px-5 py-3">Size</th><th className="px-5 py-3">Finish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-surface-container">
                {importedRows.length > 1 ? importedRows.slice(1, 6).map((row, i) => (
                  <tr key={i} className="hover:bg-pos-surface-low">
                    {row.slice(0, 5).map((cell, j) => (
                      <td key={j} className="px-5 py-3 text-xs">{cell}</td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-pos-on-surface-variant">Upload a file to see preview</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-pos-secondary-container/40 rounded-xl p-5 border border-pos-secondary-container flex gap-4">
        <span className="material-symbols-outlined text-pos-secondary mt-0.5">info</span>
        <div>
          <div className="text-sm font-semibold text-pos-on-secondary-container mb-1">Import Rules</div>
          <div className="text-xs text-pos-on-surface-variant space-y-1">
            <div>• Duplicate products (same name) → Stock will be updated</div>
            <div>• Invalid / empty rows are automatically skipped</div>
            <div>• All prices must be numeric (no ৳ symbol in file)</div>
          </div>
        </div>
      </div>
    </section>
  );
}
