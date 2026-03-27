import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { type CompanySettings, exportAllData, importAllData } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

interface SettingsScreenProps {
  settings: CompanySettings;
  onUpdateSettings: (s: CompanySettings) => void;
}

type ClearOption = 'products' | 'customers' | 'sales' | 'settings' | 'counter';

export default function SettingsScreen({ settings, onUpdateSettings }: SettingsScreenProps) {
  const { t, lang } = useI18n();
  const { user, signOut } = useAuth();
  const [form, setForm] = useState(settings);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
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

  // ─── Auth handlers for cloud backup ───
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authEmail, password: authPassword,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        toast.success(lang === 'bn' ? 'অ্যাকাউন্ট তৈরি হয়েছে!' : 'Account created! Check email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success(lang === 'bn' ? 'লগইন সফল!' : 'Logged in!');
        setShowAuthModal(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Auth failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google login failed');
      setAuthLoading(false);
    }
  };

  const handleCloudBackupClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      toast.info(lang === 'bn' ? 'ক্লাউড ব্যাকআপ শীঘ্রই আসছে!' : 'Cloud backup coming soon!');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success(lang === 'bn' ? 'লগআউট হয়েছে' : 'Logged out');
  };

  const initials = (form.userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const clearOptions: { key: ClearOption; icon: string; labelKey: Parameters<typeof t>[0]; }[] = [
    { key: 'products', icon: 'inventory_2', labelKey: 'clearProducts' },
    { key: 'customers', icon: 'group', labelKey: 'clearCustomers' },
    { key: 'sales', icon: 'receipt_long', labelKey: 'allInvoices' },
    { key: 'settings', icon: 'settings', labelKey: 'allSettingsData' },
    { key: 'counter', icon: 'pin', labelKey: 'invoiceCounter' },
  ];

  return (
    <section className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <span className="text-[10px] text-pos-on-surface-variant uppercase tracking-widest block mb-0.5">{t('configuration')}</span>
          <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">{t('settings')}</h2>
        </div>
        <button onClick={handleSave} className="px-6 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
          <span className="material-symbols-outlined text-lg">save</span>{t('saveAllSettings')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Column 1 (5 cols): Business Info + User Profile ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Business Info Card */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-pos-secondary/5 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-secondary uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">store</span>{t('businessInfo')}
              </h3>
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('businessName')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('phoneLabel')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('email')}</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('addressLabel')}</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-pos-tertiary-container/30 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">person</span>{t('userProfile')}
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3 p-2.5 bg-pos-surface-high/50 rounded-xl">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pos-secondary to-pos-secondary-dim flex items-center justify-center shadow-md">
                  <span className="text-sm font-bold text-white">{initials}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-pos-on-surface">{form.userName || 'User'}</div>
                  <div className="text-[10px] text-pos-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">badge</span>{form.userRole}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('fullName')}</label>
                  <input value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('role')}</label>
                  <input value={form.userRole} onChange={e => setForm(f => ({ ...f, userRole: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary focus:border-pos-secondary outline-none text-pos-on-surface transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2 (3 cols): System + Appearance ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* System Settings */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500/5 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">tune</span>{t('systemSettings')}
              </h3>
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('invoicePrefix')}</label>
                <input value={form.invPrefix} onChange={e => setForm(f => ({ ...f, invPrefix: e.target.value }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" placeholder="INV" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('lowStockThreshold')}</label>
                <input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 20 }))} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface" />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-violet-500/5 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">palette</span>{t('appearance')}
              </h3>
            </div>
            <div className="p-4">
              <button onClick={toggleDarkMode}
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-pos-surface-high/50 hover:bg-pos-surface-high transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${form.darkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-amber-100 text-amber-600'}`}>
                  <span className="material-symbols-outlined text-xl">{form.darkMode ? 'dark_mode' : 'light_mode'}</span>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-sm text-pos-on-surface">{form.darkMode ? t('darkMode') : t('lightMode')}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">{form.darkMode ? 'Switch to light' : 'Switch to dark'}</div>
                </div>
                <div className={`w-11 h-6 rounded-full relative transition-colors ${form.darkMode ? 'bg-pos-secondary' : 'bg-pos-surface-container-highest'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${form.darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Column 3 (4 cols): Cloud Backup + Data Management ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Cloud Backup */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-sky-500/5 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">cloud</span>
                {lang === 'bn' ? 'ক্লাউড ব্যাকআপ' : 'Cloud Backup'}
              </h3>
            </div>
            <div className="p-4">
              {user ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 p-2.5 bg-[hsl(125,100%,95%)] rounded-lg">
                    <span className="material-symbols-outlined text-[hsl(125,60%,35%)] text-lg">check_circle</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-pos-on-surface">{lang === 'bn' ? 'লগইন করা আছে' : 'Logged in'}</div>
                      <div className="text-[10px] text-pos-on-surface-variant truncate">{user.email}</div>
                    </div>
                  </div>
                  <button onClick={handleCloudBackupClick} className="w-full py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    {lang === 'bn' ? 'ড্রাইভে ব্যাকআপ' : 'Backup to Drive'}
                  </button>
                  <button onClick={handleSignOut} className="w-full py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-pos-surface-container-highest transition-colors">
                    <span className="material-symbols-outlined text-sm">logout</span>{t('logout')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-pos-surface-high/50 rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">cloud_off</span>
                    </div>
                    <p className="text-[10px] text-pos-on-surface-variant leading-relaxed">
                      {lang === 'bn' ? 'Google Drive এ ডাটা ব্যাকআপ রাখুন।' : 'Backup data to Google Drive.'}
                    </p>
                  </div>
                  <button onClick={() => setShowAuthModal(true)} className="w-full py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md hover:-translate-y-0.5 transition-transform">
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    {lang === 'bn' ? 'ক্লাউড ব্যাকআপ চালু করুন' : 'Enable Cloud Backup'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-rose-500/5 to-transparent border-b border-pos-surface-container">
              <h3 className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">database</span>{t('dataManagement')}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-pos-on-surface-variant mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">info</span>{t('dataStoredLocally')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportAllData} className="py-2.5 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-sm">file_download</span>{t('exportBackup')}
                </button>
                <button onClick={() => fileRef.current?.click()} className="py-2.5 bg-pos-secondary-container text-pos-on-secondary-container rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-sm">file_upload</span>{t('importBackup')}
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button onClick={() => setShowClearModal(true)} className="w-full mt-2 py-2.5 bg-pos-error-container text-pos-on-error-container rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-sm">delete_forever</span>{t('clearAllData')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selective Clear Data Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={() => setShowClearModal(false)}>
          <div className="bg-pos-surface-lowest rounded-2xl w-[420px] max-w-[95vw] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-4 border-b border-pos-surface-container">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-pos-on-error-container">delete_forever</span>
                </div>
                <h3 className="text-lg font-bold text-pos-on-surface">{t('selectDataToClear')}</h3>
              </div>
              <p className="text-xs text-pos-on-surface-variant">{t('selectDataToClearMsg')}</p>
            </div>
            <div className="px-6 pt-4 pb-2">
              <button onClick={toggleAll} className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-pos-surface-high transition-colors">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${Object.values(clearChecks).every(Boolean) ? 'bg-pos-secondary border-pos-secondary' : 'border-pos-outline'}`}>
                  {Object.values(clearChecks).every(Boolean) && <span className="material-symbols-outlined text-white text-sm">check</span>}
                </div>
                <span className="text-sm font-bold text-pos-on-surface">{t('selectAll')}</span>
              </button>
            </div>
            <div className="px-6 pb-4 space-y-1">
              {clearOptions.map(opt => (
                <button key={opt.key} onClick={() => toggleCheck(opt.key)} className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-pos-surface-high transition-colors">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${clearChecks[opt.key] ? 'bg-pos-error border-pos-error' : 'border-pos-outline'}`}>
                    {clearChecks[opt.key] && <span className="material-symbols-outlined text-white text-sm">check</span>}
                  </div>
                  <span className={`material-symbols-outlined text-lg ${clearChecks[opt.key] ? 'text-pos-error' : 'text-pos-on-surface-variant'}`}>{opt.icon}</span>
                  <span className={`text-sm font-medium ${clearChecks[opt.key] ? 'text-pos-error' : 'text-pos-on-surface'}`}>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
            <div className="p-6 pt-2 flex gap-3 border-t border-pos-surface-container">
              <button onClick={() => setShowClearModal(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={handleSelectiveClear} disabled={!Object.values(clearChecks).some(Boolean)} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">delete</span>{t('deleteSelected')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal for Cloud Backup */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={() => setShowAuthModal(false)}>
          <div className="bg-pos-surface-lowest rounded-2xl w-[420px] max-w-[95vw] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-4 border-b border-pos-surface-container">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-pos-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-pos-on-secondary-container">cloud</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-pos-on-surface">
                    {lang === 'bn' ? 'ক্লাউড ব্যাকআপ' : 'Cloud Backup'}
                  </h3>
                  <p className="text-xs text-pos-on-surface-variant">
                    {lang === 'bn' ? 'লগইন করে ব্যাকআপ চালু করুন' : 'Sign in to enable backup'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Google Login */}
              <button onClick={handleGoogleAuth} disabled={authLoading}
                className="w-full py-3 bg-white border-2 border-pos-surface-container rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-pos-surface-high transition-colors disabled:opacity-50 text-pos-on-surface">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {lang === 'bn' ? 'Google দিয়ে লগইন' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-pos-surface-container" />
                <span className="text-xs text-pos-on-surface-variant">{lang === 'bn' ? 'অথবা' : 'or'}</span>
                <div className="flex-1 h-px bg-pos-surface-container" />
              </div>

              {/* Tabs */}
              <div className="flex bg-pos-surface-high rounded-lg p-1">
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${authMode === 'login' ? 'bg-pos-surface-lowest shadow-sm text-pos-on-surface' : 'text-pos-on-surface-variant'}`}>
                  {lang === 'bn' ? 'লগইন' : 'Login'}
                </button>
                <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${authMode === 'signup' ? 'bg-pos-surface-lowest shadow-sm text-pos-on-surface' : 'text-pos-on-surface-variant'}`}>
                  {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Sign Up'}
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface"
                  placeholder={lang === 'bn' ? 'ইমেইল' : 'Email'} />
                <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={6}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none text-pos-on-surface"
                  placeholder={lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'} />
                <button type="submit" disabled={authLoading}
                  className="w-full py-2.5 bg-pos-secondary text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {authLoading ? '...' : authMode === 'login'
                    ? (lang === 'bn' ? 'লগইন' : 'Login')
                    : (lang === 'bn' ? 'অ্যাকাউন্ট তৈরি' : 'Create Account')}
                </button>
              </form>
            </div>

            <div className="px-6 pb-6">
              <button onClick={() => setShowAuthModal(false)} className="w-full py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
