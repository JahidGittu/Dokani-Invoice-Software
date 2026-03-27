import { useState, useRef } from "react";
import { type CompanySettings, exportAllData, importAllData } from "@/lib/store";
import { toast } from "sonner";

interface SettingsScreenProps {
  settings: CompanySettings;
  onUpdateSettings: (s: CompanySettings) => void;
}

export default function SettingsScreen({ settings, onUpdateSettings }: SettingsScreenProps) {
  const [form, setForm] = useState(settings);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateSettings(form);
    toast.success('Settings saved!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = importAllData(ev.target?.result as string);
      if (ok) {
        toast.success('Data imported! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error('Invalid backup file!');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (confirm('Are you sure? This will delete ALL data!')) {
      localStorage.clear();
      toast.success('All data cleared! Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <section className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Configuration</span>
        <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Settings</h2>
      </div>

      {/* Company Info */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-pos-secondary">business</span>Company Information
        </h3>
        <p className="text-xs text-pos-on-surface-variant">This info appears on your invoices and receipts.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Company Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
        <button onClick={handleSave} className="px-6 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">
          Save Settings
        </button>
      </div>

      {/* Data Management */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-pos-secondary">storage</span>Data Management
        </h3>
        <p className="text-xs text-pos-on-surface-variant">All data is stored locally in your browser. Export regularly for backup.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportAllData} className="px-5 py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">file_download</span>Export JSON Backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-pos-secondary-container text-pos-on-secondary-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">file_upload</span>Import Backup
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={handleClearData} className="px-5 py-2.5 bg-pos-error-container text-pos-on-error-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">delete_forever</span>Clear All Data
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-pos-secondary">info</span>About
        </h3>
        <div className="text-sm space-y-1 text-pos-on-surface-variant">
          <div>TilePOS Lite · v2.0</div>
          <div>Offline POS for Tile & Hardware Shops</div>
          <div>Data stored in localStorage</div>
        </div>
      </div>
    </section>
  );
}
