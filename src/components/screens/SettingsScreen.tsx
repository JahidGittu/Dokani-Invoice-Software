import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { type CompanySettings, exportAllData, importAllData } from "@/lib/store";
import { toast } from "sonner";

interface SettingsScreenProps {
  settings: CompanySettings;
  onUpdateSettings: (s: CompanySettings) => void;
  onSignOut?: () => Promise<void>;
}

type ClearOption = 'products' | 'customers' | 'sales' | 'settings' | 'counter';

export default function SettingsScreen({ settings, onUpdateSettings, onSignOut }: SettingsScreenProps) {
  const { t } = useI18n();
  const [form, setForm] = useState(settings);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearChecks, setClearChecks] = useState<Record<ClearOption, boolean>>({
    products: false, customers: false, sales: false, settings: false, counter: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  // Dark mode sync
  useEffect(() => {
    if (form.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [form.darkMode]);

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

  const toggleDarkMode = () => {
    const newForm = { ...form, darkMode: !form.darkMode };
    setForm(newForm);
    onUpdateSettings(newForm);
  };

  const toggleCheck = (key: ClearOption) => {
    setClearChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const allChecked = Object.values(clearChecks).every(Boolean);
    const val = !allChecked;
    setClearChecks({ products: val, customers: val, sales: val, settings: val, counter: val });
  };

  const handleSelectiveClear = () => {
    const anyChecked = Object.values(clearChecks).some(Boolean);
    if (!anyChecked) { toast.error(t('noItemSelected')); return; }

    if (clearChecks.products) localStorage.removeItem('tilepos_products');
    if (clearChecks.customers) localStorage.removeItem('tilepos_customers');
    if (clearChecks.sales) localStorage.removeItem('tilepos_sales');
    if (clearChecks.settings) localStorage.removeItem('tilepos_settings');
    if (clearChecks.counter) localStorage.removeItem('tilepos_inv_counter');

    toast.success(t('selectedDataCleared'));
    setShowClearModal(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const initials = (form.userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const clearOptions: { key: ClearOption; icon: string; labelKey: Parameters<typeof t>[0]; count?: string }[] = [
    { key: 'products', icon: 'inventory_2', labelKey: 'clearProducts' },
    { key: 'customers', icon: 'group', labelKey: 'clearCustomers' },
    { key: 'sales', icon: 'receipt_long', labelKey: 'allInvoices' },
    { key: 'settings', icon: 'settings', labelKey: 'allSettingsData' },
    { key: 'counter', icon: 'pin', labelKey: 'invoiceCounter' },
  ];

  return (
    <section className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('configuration')}</span>
        <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('settings')}</h2>
      </div>

      {/* Appearance / Dark Mode */}
      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('appearance')}</h3>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-pos-surface-high transition-colors"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${form.darkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-amber-100 text-amber-600'}`}>
            <span className="material-symbols-outlined text-2xl">{form.darkMode ? 'dark_mode' : 'light_mode'}</span>
          </div>
          <div className="text-left flex-1">
            <div className="font-semibold text-pos-on-surface">{form.darkMode ? t('darkMode') : t('lightMode')}</div>
            <div className="text-xs text-pos-on-surface-variant">{form.darkMode ? 'Switch to light theme' : 'Switch to dark theme'}</div>
          </div>
          <div className={`w-12 h-7 rounded-full relative transition-colors ${form.darkMode ? 'bg-pos-secondary' : 'bg-pos-surface-container-highest'}`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${form.darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('businessInfo')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('businessName')}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('phoneLabel')}</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('email')}</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('addressLabel')}</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
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
            <input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('role')}</label>
            <input value={form.userRole} onChange={e => setForm(f => ({ ...f, userRole: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
          </div>
        </div>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
        <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('systemSettings')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('invoicePrefix')}</label>
            <input value={form.invPrefix} onChange={e => setForm(f => ({ ...f, invPrefix: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" placeholder="INV" />
          </div>
          <div>
            <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('lowStockThreshold')}</label>
            <input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 20 }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
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
          <button onClick={() => setShowClearModal(true)} className="px-5 py-2.5 bg-pos-error-container text-pos-on-error-container rounded-lg font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">delete_forever</span>{t('clearAllData')}
          </button>
        </div>
      </div>

      {/* Selective Clear Data Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={() => setShowClearModal(false)}>
          <div className="bg-pos-surface-lowest rounded-2xl w-[420px] max-w-[95vw] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 pb-4 border-b border-pos-surface-container">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-pos-on-error-container">delete_forever</span>
                </div>
                <h3 className="text-lg font-bold text-pos-on-surface">{t('selectDataToClear')}</h3>
              </div>
              <p className="text-xs text-pos-on-surface-variant">{t('selectDataToClearMsg')}</p>
            </div>

            {/* Select All */}
            <div className="px-6 pt-4 pb-2">
              <button
                onClick={toggleAll}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-pos-surface-high transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${Object.values(clearChecks).every(Boolean) ? 'bg-pos-secondary border-pos-secondary' : 'border-pos-outline'}`}>
                  {Object.values(clearChecks).every(Boolean) && <span className="material-symbols-outlined text-white text-sm">check</span>}
                </div>
                <span className="text-sm font-bold text-pos-on-surface">{t('selectAll')}</span>
              </button>
            </div>

            {/* Options */}
            <div className="px-6 pb-4 space-y-1">
              {clearOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => toggleCheck(opt.key)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-pos-surface-high transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${clearChecks[opt.key] ? 'bg-pos-error border-pos-error' : 'border-pos-outline'}`}>
                    {clearChecks[opt.key] && <span className="material-symbols-outlined text-white text-sm">check</span>}
                  </div>
                  <span className={`material-symbols-outlined text-lg ${clearChecks[opt.key] ? 'text-pos-error' : 'text-pos-on-surface-variant'}`}>{opt.icon}</span>
                  <span className={`text-sm font-medium ${clearChecks[opt.key] ? 'text-pos-error' : 'text-pos-on-surface'}`}>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="p-6 pt-2 flex gap-3 border-t border-pos-surface-container">
              <button onClick={() => setShowClearModal(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button
                onClick={handleSelectiveClear}
                disabled={!Object.values(clearChecks).some(Boolean)}
                className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">delete</span>{t('deleteSelected')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}