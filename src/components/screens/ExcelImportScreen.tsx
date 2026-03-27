import { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { type Product } from "@/lib/store";
import { toast } from "sonner";

interface ExcelImportScreenProps {
  products: Product[];
  onImportProducts: (newProducts: Omit<Product, 'id'>[]) => void;
}

export default function ExcelImportScreen({ products, onImportProducts }: ExcelImportScreenProps) {
  const { t } = useI18n();
  const [importedRows, setImportedRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mapName, setMapName] = useState('0');
  const [mapCategory, setMapCategory] = useState('1');
  const [mapBrand, setMapBrand] = useState('2');
  const [mapSize, setMapSize] = useState('3');
  const [mapFinish, setMapFinish] = useState('4');
  const [mapSqft, setMapSqft] = useState('5');
  const [mapBuyRate, setMapBuyRate] = useState('6');
  const [mapPrice, setMapPrice] = useState('7');
  const [mapQty, setMapQty] = useState('8');
  const [mapBatch, setMapBatch] = useState('9');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map(l => l.split(',').map(c => c.trim().replace(/"/g, '')));
      setImportedRows(parsed);
      setFileName(file.name);
      toast.success(`${file.name} — ${parsed.length - 1} ${t('rowsFound')}`);
    };
    reader.readAsText(file);
  };

  const runImport = () => {
    if (!importedRows.length) { toast.error(t('uploadFirst')); return; }
    setImporting(true); setProgress(0);
    const ni = parseInt(mapName), ci = parseInt(mapCategory), bi = parseInt(mapBrand);
    const si = parseInt(mapSize), fi = parseInt(mapFinish), sqi = parseInt(mapSqft);
    const bri = parseInt(mapBuyRate), pi = parseInt(mapPrice), qi = parseInt(mapQty), bai = parseInt(mapBatch);
    let w = 0;
    const iv = setInterval(() => {
      w += 15; setProgress(Math.min(w, 100));
      if (w >= 100) {
        clearInterval(iv);
        const newProducts: Omit<Product, 'id'>[] = [];
        importedRows.slice(1).forEach(row => {
          const name = row[ni]; const price = parseFloat(row[pi]) || 0; const qty = parseInt(row[qi]) || 0;
          if (!name) return;
          if (!products.find(p => p.name.toLowerCase() === name.toLowerCase())) {
            newProducts.push({
              name,
              category: row[ci] || '',
              brand: row[bi] || '',
              size: row[si] || '',
              finish: row[fi] || '',
              sqftPerBox: parseFloat(row[sqi]) || 0,
              buyRate: parseFloat(row[bri]) || 0,
              pricePerBox: price,
              stock: qty,
              batch: row[bai] || 'Imported',
            });
          }
        });
        onImportProducts(newProducts);
        toast.success(`✓ ${newProducts.length} ${t('productsImported')}`);
        setTimeout(() => setImporting(false), 1500);
      }
    }, 160);
  };

  const downloadTemplate = () => {
    const csv = 'Product Name,Category,Brand,Size,Finish,Sqft/Box,Buy Rate,Price/Box,Stock (Boxes),Batch\nRoyal Marble,Floor Tile,Royal,60x60,Glossy,16,1200,1500,80,Batch-A\nOcean Blue,Wall Tile,Ocean,30x60,Matte,12,900,1200,50,Batch-B';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tilepos_template.csv'; a.click();
    toast.success(t('templateDownloaded'));
  };

  const colOptions = ['Col A', 'Col B', 'Col C', 'Col D', 'Col E', 'Col F', 'Col G', 'Col H', 'Col I', 'Col J'];

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('dataImport')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('excelImport')}</h2>
        </div>
        <button onClick={downloadTemplate} className="px-6 py-3 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-medium flex items-center gap-2 hover:brightness-95 transition-all">
          <span className="material-symbols-outlined text-lg">download</span>{t('sampleTemplate')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-pos-outline-variant rounded-xl p-10 text-center cursor-pointer hover:border-pos-secondary hover:bg-pos-secondary-container/30 transition-all">
            <span className="material-symbols-outlined text-5xl text-pos-on-surface-variant mb-3 block">cloud_upload</span>
            <div className="font-semibold text-pos-on-surface mb-1">{t('uploadFile')}</div>
            <div className="text-sm text-pos-on-surface-variant">{t('supportsFormats')}</div>
            {fileName && <div className="mt-3 text-xs text-pos-secondary font-bold">✓ {fileName} — {importedRows.length - 1} rows</div>}
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />

          <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('columnMapping')}</h3>
            <div className="space-y-3">
              {[
                { label: t('tileName'), value: mapName, set: setMapName },
                { label: t('categoryLabel'), value: mapCategory, set: setMapCategory },
                { label: t('brandLabel'), value: mapBrand, set: setMapBrand },
                { label: t('sizeArrow'), value: mapSize, set: setMapSize },
                { label: t('finishArrow'), value: mapFinish, set: setMapFinish },
                { label: 'Sqft/Box →', value: mapSqft, set: setMapSqft },
                { label: t('buyRateLabel') + ' →', value: mapBuyRate, set: setMapBuyRate },
                { label: t('rateArrow'), value: mapPrice, set: setMapPrice },
                { label: t('qtyArrow'), value: mapQty, set: setMapQty },
                { label: 'Batch →', value: mapBatch, set: setMapBatch },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-pos-on-surface w-28 flex-shrink-0">{label}</span>
                  <select value={value} onChange={e => set(e.target.value)} className="flex-1 bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 outline-none">
                    {colOptions.map((c, i) => <option key={i} value={String(i)}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {importing && (
              <div className="mt-4">
                <div className="text-xs text-pos-on-surface-variant mb-2">{t('importingData')}</div>
                <div className="h-2 bg-pos-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-pos-secondary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <button onClick={runImport} className="mt-5 w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform">
              <span className="material-symbols-outlined">upload</span>{t('importData')}
            </button>
          </div>
        </div>

        <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
          <div className="px-6 py-4 bg-pos-surface-low border-b border-pos-surface-container">
            <h3 className="text-sm font-semibold">{fileName ? `${t('previewLabel')} — ${fileName}` : t('uploadToPreview')}</h3>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low">
                  <th className="px-3 py-2">{t('name')}</th><th className="px-3 py-2">{t('categoryLabel')}</th><th className="px-3 py-2">{t('brandLabel')}</th><th className="px-3 py-2">{t('size')}</th><th className="px-3 py-2">{t('finish')}</th><th className="px-3 py-2">Sqft</th><th className="px-3 py-2">{t('buyRateLabel')}</th><th className="px-3 py-2">{t('rate')}</th><th className="px-3 py-2">{t('qty')}</th><th className="px-3 py-2">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-surface-container">
                {importedRows.length > 1 ? importedRows.slice(1, 8).map((row, i) => (
                  <tr key={i} className="hover:bg-pos-surface-low">
                    {row.slice(0, 10).map((cell, j) => <td key={j} className="px-3 py-2 text-[11px]">{cell}</td>)}
                  </tr>
                )) : (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-xs text-pos-on-surface-variant">{t('uploadToPreview')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-pos-secondary-container/40 rounded-xl p-5 border border-pos-secondary-container flex gap-4">
        <span className="material-symbols-outlined text-pos-secondary mt-0.5">info</span>
        <div>
          <div className="text-sm font-semibold text-pos-on-secondary-container mb-1">{t('importRules')}</div>
          <div className="text-xs text-pos-on-surface-variant space-y-1">
            <div>• {t('importRule1')}</div>
            <div>• {t('importRule2')}</div>
            <div>• {t('importRule3')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
