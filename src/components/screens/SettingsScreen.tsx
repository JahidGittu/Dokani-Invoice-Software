import { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { type CompanySettings, exportAllData, importAllData } from "@/lib/store";
import { toast } from "sonner";

interface SettingsScreenProps {
  settings: CompanySettings;
  onUpdateSettings: (s: CompanySettings) => void;
}

export default function SettingsScreen({ settings, onUpdateSettings }: SettingsScreenProps) {
  const { t } = useI18n();
  const [form, setForm] = useState(settings);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => { onUpdateSettings(form); toast.success(t('settingsSaved')); };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = importAllData(ev.target?.result as string);
      if (ok) { toast.success(t('dataImported')); setTimeout(() => window.location.reload(), 1000); }
      else { toast.error(t('invalidBackup')); }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    localStorage.clear();
    toast.success(t('allDataCleared'));
    setShowClearConfirm(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const initials = (form.userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <section className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('configuration')}</span>
        <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('settings')}</h2>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('businessInfo')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('businessName')}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('phoneLabel')}</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('email')}</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('addressLabel')}</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('userProfile')}</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-pos-secondary-container flex items-center justify-center">
            <span className="text-lg font-bold text-pos-on-secondary-container">{initials}</span>
          </div>
          <div>
            <div className="font-semibold text-pos-on-surface">{form.userName || 'User'}</div>
            <div className="text-xs text-pos-on-surface-variant">{form.userRole}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('fullName')}</label>
            <input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('role')}</label>
            <input value={form.userRole} onChange={e => setForm(f => ({ ...f, userRole: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('systemSettings')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('invoicePrefix')}</label>
            <input value={form.invPrefix} onChange={e => setForm(f => ({ ...f, invPrefix: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="INV" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('lowStockThreshold')}</label>
            <input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 20 }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
        <span className="material-symbols-outlined">save</span>{t('saveAllSettings')}
      </button>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('dataManagement')}</h3>
        <p className="text-xs text-pos-on-surface-variant mb-4">{t('dataStoredLocally')}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportAllData} className="px-5 py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">file_download</span>{t('exportBackup')}
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-pos-secondary-container text-pos-on-secondary-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">file_upload</span>{t('importBackup')}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={() => setShowClearConfirm(true)} className="px-5 py-2.5 bg-pos-error-container text-pos-on-error-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">delete_forever</span>{t('clearAllData')}
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete_forever</span>
              </div>
              <h3 className="text-lg font-bold">{t('clearAllDataQ')}</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">{t('clearAllDataMsg')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={handleClearData} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">{t('deleteEverything')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
