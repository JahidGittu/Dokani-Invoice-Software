import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import AdminScreen from '@/components/screens/AdminScreen';

type AdminNav = 'overview' | 'licenses' | 'users' | 'messages' | 'system';

interface Stats {
  totalUsers: number;
  totalLicenses: number;
  activeCount: number;
  blockedCount: number;
  expiringCount: number;
  totalRevenue: number;
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useI18n();
  const [activeNav, setActiveNav] = useState<AdminNav>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalLicenses: 0, activeCount: 0, blockedCount: 0, expiringCount: 0, totalRevenue: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [{ data: licenses }, { data: roles }] = await Promise.all([
      supabase.from('licenses').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    const now = Date.now();
    const lics = licenses || [];
    const active = lics.filter(l => !l.is_blocked && new Date(l.license_expiry).getTime() >= now);
    const expiring = lics.filter(l => {
      const days = (new Date(l.license_expiry).getTime() - now) / 86400000;
      return !l.is_blocked && days >= 0 && days <= 7;
    });
    const blocked = lics.filter(l => l.is_blocked);
    const revenue = lics.reduce((s, l) => s + (l.setup_fee || 0) + (l.annual_fee || 0), 0);
    setStats({
      totalUsers: roles?.length || 0,
      totalLicenses: lics.length,
      activeCount: active.length,
      blockedCount: blocked.length,
      expiringCount: expiring.length,
      totalRevenue: revenue,
    });
  };

  const navItems: { id: AdminNav; icon: string; label: string; labelBn: string; badge?: number }[] = [
    { id: 'overview', icon: 'space_dashboard', label: 'Overview', labelBn: 'ওভারভিউ' },
    { id: 'licenses', icon: 'license', label: 'Licenses', labelBn: 'লাইসেন্স', badge: stats.expiringCount },
    { id: 'users', icon: 'group', label: 'Users & Roles', labelBn: 'ইউজার ও রোল' },
    { id: 'messages', icon: 'send', label: 'Messages', labelBn: 'মেসেজ পাঠান' },
    { id: 'system', icon: 'settings', label: 'System', labelBn: 'সিস্টেম সেটিংস' },
  ];

  const renderContent = () => {
    if (activeNav === 'overview') return <AdminOverview stats={stats} lang={lang} onNavigate={setActiveNav} />;
    // For licenses, users, messages — use the existing AdminScreen with correct tab
    return <AdminScreen initialTab={activeNav === 'system' ? 'users' : activeNav} />;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-60 bg-gray-900 border-r border-gray-800 z-50 flex flex-col transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-800">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg">shield_person</span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight">Dokani</h1>
            <p className="text-[10px] text-gray-500">Control Panel</p>
          </div>
          <button className="lg:hidden ml-auto text-gray-500" onClick={() => setSidebarOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">
            {lang === 'bn' ? 'নেভিগেশন' : 'Navigation'}
          </p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveNav(item.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeNav === item.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{lang === 'bn' ? item.labelBn : item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-2 border-t border-gray-800 pt-3">
          <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
            <span className="material-symbols-outlined text-xl">translate</span>
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all">
            <span className="material-symbols-outlined text-xl">logout</span>
            {lang === 'bn' ? 'লগআউট' : 'Logout'}
          </button>
          <div className="flex items-center gap-3 px-3 py-2 mt-1 rounded-xl bg-gray-800/50">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">SA</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">System Admin</p>
              <p className="text-[10px] text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-60 flex-1 min-h-screen">
        {/* Top bar */}
        <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button className="lg:hidden mr-3 text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-lg">
              {navItems.find(n => n.id === activeNav)?.icon}
            </span>
            {lang === 'bn' ? navItems.find(n => n.id === activeNav)?.labelBn : navItems.find(n => n.id === activeNav)?.label}
          </h2>
          <div className="ml-auto flex items-center gap-3">
            {stats.expiringCount > 0 && (
              <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                {stats.expiringCount} {lang === 'bn' ? 'মেয়াদ শেষ হচ্ছে' : 'expiring'}
              </span>
            )}
            {stats.blockedCount > 0 && (
              <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">block</span>
                {stats.blockedCount} {lang === 'bn' ? 'ব্লক' : 'blocked'}
              </span>
            )}
          </div>
        </header>

        <div className="p-4 lg:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

/* ─── Overview Dashboard ─── */
function AdminOverview({ stats, lang, onNavigate }: { stats: Stats; lang: string; onNavigate: (nav: AdminNav) => void }) {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-black mb-1">
          {lang === 'bn' ? '🛡️ সিস্টেম অ্যাডমিন কন্ট্রোল প্যানেল' : '🛡️ System Admin Control Panel'}
        </h1>
        <p className="text-gray-400 text-sm">
          {lang === 'bn' ? 'সমস্ত ক্লায়েন্ট, লাইসেন্স এবং সিস্টেম একটি জায়গা থেকে পরিচালনা করুন' : 'Manage all clients, licenses and system from one place'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { icon: 'group', label: lang === 'bn' ? 'মোট ইউজার' : 'Total Users', value: stats.totalUsers, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
          { icon: 'license', label: lang === 'bn' ? 'মোট লাইসেন্স' : 'Total Licenses', value: stats.totalLicenses, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500/10' },
          { icon: 'check_circle', label: lang === 'bn' ? 'সক্রিয়' : 'Active', value: stats.activeCount, color: 'from-green-500 to-green-600', bg: 'bg-green-500/10' },
          { icon: 'schedule', label: lang === 'bn' ? 'মেয়াদ শেষ হচ্ছে' : 'Expiring', value: stats.expiringCount, color: 'from-orange-500 to-orange-600', bg: 'bg-orange-500/10' },
          { icon: 'block', label: lang === 'bn' ? 'ব্লক' : 'Blocked', value: stats.blockedCount, color: 'from-red-500 to-red-600', bg: 'bg-red-500/10' },
          { icon: 'payments', label: lang === 'bn' ? 'মোট আয়' : 'Revenue', value: `৳${stats.totalRevenue.toLocaleString()}`, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border border-gray-800 rounded-2xl p-4`}>
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined text-white text-xl">{s.icon}</span>
            </div>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3">
          {lang === 'bn' ? '⚡ দ্রুত কার্যক্রম' : '⚡ Quick Actions'}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: 'add_circle', label: lang === 'bn' ? 'নতুন লাইসেন্স তৈরি' : 'Create License', nav: 'licenses' as AdminNav, color: 'bg-blue-600 hover:bg-blue-700' },
            { icon: 'person_add', label: lang === 'bn' ? 'রোল পরিবর্তন' : 'Manage Roles', nav: 'users' as AdminNav, color: 'bg-purple-600 hover:bg-purple-700' },
            { icon: 'send', label: lang === 'bn' ? 'মেসেজ পাঠান' : 'Send Message', nav: 'messages' as AdminNav, color: 'bg-emerald-600 hover:bg-emerald-700' },
            { icon: 'tune', label: lang === 'bn' ? 'সিস্টেম সেটিংস' : 'System Settings', nav: 'system' as AdminNav, color: 'bg-gray-700 hover:bg-gray-600' },
          ].map((a, i) => (
            <button key={i} onClick={() => onNavigate(a.nav)}
              className={`${a.color} rounded-xl p-4 text-left transition-all active:scale-95`}>
              <span className="material-symbols-outlined text-2xl mb-2 block">{a.icon}</span>
              <p className="text-sm font-bold">{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
