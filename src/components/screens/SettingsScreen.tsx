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

  const initials = (form.userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <section className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Configuration</span>
        <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Settings</h2>
      </div>

      {/* Business Info */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Business Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Business Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Your Tile Shop" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="shop@email.com" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Shop address" />
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">User Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-pos-secondary-container flex items-center justify-center">
            <span className="text-lg font-bold text-pos-on-secondary-container">{initials}</span>
          </div>
          <div>
            <div className="font-semibold text-pos-on-surface">{form.userName || 'User'}</div>
            <div className="text-xs text-pos-on-surface-variant">{form.userRole}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Full Name</label>
            <input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Role</label>
            <input value={form.userRole} onChange={e => setForm(f => ({ ...f, userRole: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">System Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Invoice Prefix</label>
            <input value={form.invPrefix} onChange={e => setForm(f => ({ ...f, invPrefix: e.target.value }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="INV" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Low Stock Threshold</label>
            <input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 20 }))}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
        <span className="material-symbols-outlined">save</span>Save All Settings
      </button>

      {/* Data Management */}
      <div className="bg-pos-surface-lowest rounded-xl p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Data Management</h3>
        <p className="text-xs text-pos-on-surface-variant mb-4">All data is stored locally in your browser. Export regularly for backup.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportAllData} className="px-5 py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">file_download</span>Export Backup
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
    </section>
  );
}
