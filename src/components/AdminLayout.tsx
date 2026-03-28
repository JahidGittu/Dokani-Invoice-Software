import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import AdminScreen from '@/components/screens/AdminScreen';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type AdminNav = 'overview' | 'licenses' | 'users' | 'messages' | 'system';

interface Stats {
  totalUsers: number;
  totalLicenses: number;
  activeCount: number;
  blockedCount: number;
  expiringCount: number;
  totalRevenue: number;
}

interface LicenseRaw {
  id: string;
  user_id: string;
  setup_fee: number;
  annual_fee: number;
  is_blocked: boolean;
  license_expiry: string;
  created_at: string;
  shop_name: string;
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useI18n();
  const [activeNav, setActiveNav] = useState<AdminNav>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalLicenses: 0, activeCount: 0, blockedCount: 0, expiringCount: 0, totalRevenue: 0 });
  const [licenses, setLicenses] = useState<LicenseRaw[]>([]);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const [{ data: licData }, { data: roles }] = await Promise.all([
      supabase.from('licenses').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    const now = Date.now();
    const lics = (licData || []) as LicenseRaw[];
    setLicenses(lics);
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
    if (activeNav === 'overview') return <AdminOverview stats={stats} lang={lang} onNavigate={setActiveNav} licenses={licenses} />;
    if (activeNav === 'system') return <SystemSettings lang={lang} />;
    return <AdminScreen initialTab={activeNav} />;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-60 bg-gray-900 border-r border-gray-800 z-50 flex flex-col transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">
            {lang === 'bn' ? 'নেভিগেশন' : 'Navigation'}
          </p>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveNav(item.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeNav === item.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{lang === 'bn' ? item.labelBn : item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

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

/* ─── Overview Dashboard with Charts ─── */
function AdminOverview({ stats, lang, onNavigate, licenses }: { stats: Stats; lang: string; onNavigate: (nav: AdminNav) => void; licenses: LicenseRaw[] }) {
  const [pendingSignups, setPendingSignups] = useState<{ id: string; subject: string; message: string; created_at: string; sender_id: string }[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<{ user_id: string; email: string; shop_name: string }[]>([]);

  useEffect(() => {
    loadPendingSignups();
    loadPendingProfiles();

    const channel = supabase
      .channel('admin-signups-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
        loadPendingSignups();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadPendingProfiles();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, () => {
        loadPendingProfiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPendingSignups = async () => {
    const { data } = await supabase.from('admin_messages').select('*')
      .eq('message_type', 'new_signup')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setPendingSignups(data as any);
  };

  const loadPendingProfiles = async () => {
    const [{ data: profiles }, { data: activeLicenses }] = await Promise.all([
      supabase.from('profiles').select('user_id, email, shop_name').eq('status', 'pending'),
      supabase.from('licenses').select('user_id'),
    ]);

    const licensedUserIds = new Set((activeLicenses || []).map((license: { user_id: string }) => license.user_id));
    setPendingProfiles((profiles || []).filter((profile: { user_id: string }) => !licensedUserIds.has(profile.user_id)) as any);
  };

  // Monthly revenue chart data
  const monthlyData = (() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = 0;
    }
    licenses.forEach(l => {
      const key = l.created_at.slice(0, 7);
      if (key in months) months[key] += (l.setup_fee || 0) + (l.annual_fee || 0);
    });
    return Object.entries(months).map(([month, revenue]) => ({
      month: month.slice(5),
      revenue,
    }));
  })();

  // Pie chart for license status
  const pieData = [
    { name: lang === 'bn' ? 'সক্রিয়' : 'Active', value: stats.activeCount, color: '#22c55e' },
    { name: lang === 'bn' ? 'মেয়াদ শেষ হচ্ছে' : 'Expiring', value: stats.expiringCount, color: '#f97316' },
    { name: lang === 'bn' ? 'ব্লক' : 'Blocked', value: stats.blockedCount, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Expiry timeline - next 30 days
  const expiryTimeline = (() => {
    const now = Date.now();
    return licenses
      .filter(l => !l.is_blocked)
      .map(l => ({ ...l, daysLeft: Math.ceil((new Date(l.license_expiry).getTime() - now) / 86400000) }))
      .filter(l => l.daysLeft >= -5 && l.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  })();

  // Check which signups already have licenses
  const pendingWithoutLicense = pendingSignups.filter((signup) => {
    const matchingProfile = pendingProfiles.find((profile) => {
      const emailMatch = profile.email && signup.message.includes(profile.email);
      const shopMatch = profile.shop_name && signup.subject.includes(profile.shop_name);
      return emailMatch || shopMatch || profile.user_id === signup.sender_id;
    });

    return Boolean(matchingProfile);
  });

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

      {/* Pending Signups Alert */}
      {pendingWithoutLicense.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">notification_important</span>
            {lang === 'bn' ? `🆕 ${pendingWithoutLicense.length}টি নতুন সাইনআপ — অ্যাক্টিভেশন প্রয়োজন` : `🆕 ${pendingWithoutLicense.length} New Signup(s) — Activation Required`}
          </h3>
          <div className="space-y-2">
            {pendingWithoutLicense.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-400 text-lg">person_add</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{s.subject.replace('🆕 নতুন সাইনআপ: ', '')}</p>
                    <p className="text-[10px] text-gray-500">
                      {(() => { try { return new Date(s.created_at).toLocaleString('bn-BD'); } catch { return s.created_at; } })()}
                    </p>
                  </div>
                </div>
                <button onClick={() => onNavigate('users')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span>
                  {lang === 'bn' ? 'ইউজার দেখুন' : 'View User'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-lg">bar_chart</span>
            {lang === 'bn' ? 'মাসিক রেভিনিউ' : 'Monthly Revenue'}
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                  formatter={(value: number) => [`৳${value.toLocaleString()}`, lang === 'bn' ? 'আয়' : 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* License Status Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-400 text-lg">donut_large</span>
            {lang === 'bn' ? 'লাইসেন্স স্ট্যাটাস' : 'License Status'}
          </h3>
          <div className="h-52 flex items-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm text-center w-full">{lang === 'bn' ? 'কোনো ডাটা নেই' : 'No data'}</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-400">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expiry Timeline */}
      {expiryTimeline.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400 text-lg">timeline</span>
            {lang === 'bn' ? 'লাইসেন্স এক্সপায়ারি টাইমলাইন (আগামী ৩০ দিন)' : 'License Expiry Timeline (Next 30 Days)'}
          </h3>
          <div className="space-y-2">
            {expiryTimeline.map(l => (
              <div key={l.id} className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl",
                l.daysLeft < 0 ? "bg-red-500/10 border border-red-500/20" :
                l.daysLeft <= 3 ? "bg-orange-500/10 border border-orange-500/20" :
                "bg-gray-800/50 border border-gray-700/30"
              )}>
                <div className="flex items-center gap-3">
                  <span className={cn("material-symbols-outlined text-xl",
                    l.daysLeft < 0 ? "text-red-400" : l.daysLeft <= 3 ? "text-orange-400" : "text-gray-400"
                  )}>storefront</span>
                  <div>
                    <p className="text-sm font-bold text-white">{l.shop_name}</p>
                    <p className="text-[10px] text-gray-500">{lang === 'bn' ? 'মেয়াদ:' : 'Expires:'} {l.license_expiry}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-bold px-3 py-1 rounded-full",
                  l.daysLeft < 0 ? "bg-red-500/20 text-red-400" :
                  l.daysLeft <= 3 ? "bg-orange-500/20 text-orange-400" :
                  "bg-gray-700 text-gray-300"
                )}>
                  {l.daysLeft < 0
                    ? `${Math.abs(l.daysLeft)} ${lang === 'bn' ? 'দিন আগে শেষ' : 'days ago'}`
                    : `${l.daysLeft} ${lang === 'bn' ? 'দিন বাকি' : 'days left'}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

/* ─── System Settings ─── */
function SystemSettings({ lang }: { lang: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400">settings</span>
          {lang === 'bn' ? 'সিস্টেম সেটিংস' : 'System Settings'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Software Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-400">{lang === 'bn' ? 'সফটওয়্যার তথ্য' : 'Software Info'}</h4>
            <div className="space-y-2">
              {[
                { label: lang === 'bn' ? 'সফটওয়্যার নাম' : 'Software Name', value: 'Dokani' },
                { label: lang === 'bn' ? 'ভার্সন' : 'Version', value: '1.0.0' },
                { label: lang === 'bn' ? 'ক্যাটাগরি' : 'Category', value: lang === 'bn' ? 'টাইলস শপ' : 'Tiles Shop' },
                { label: lang === 'bn' ? 'সাপোর্ট ফোন' : 'Support Phone', value: '01777615690' },
                { label: lang === 'bn' ? 'সাপোর্ট ইমেইল' : 'Support Email', value: 'admin@dokani.com.bd' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-800/50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className="text-sm font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-400">{lang === 'bn' ? 'প্রাইসিং মডেল' : 'Pricing Model'}</h4>
            <div className="space-y-2">
              {[
                { label: lang === 'bn' ? 'সেটআপ ফি' : 'Setup Fee', value: '৳10,000' },
                { label: lang === 'bn' ? 'বাৎসরিক রিনিউয়াল' : 'Annual Renewal', value: '৳3,000 – ৳4,000' },
                { label: lang === 'bn' ? 'অটো-ব্লক' : 'Auto-Block', value: lang === 'bn' ? 'মেয়াদ শেষের ২ দিন পর' : '2 days after expiry' },
                { label: lang === 'bn' ? 'সতর্কবার্তা' : 'Warning', value: lang === 'bn' ? 'মেয়াদ শেষের ৭ দিন আগে' : '7 days before expiry' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-800/50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className="text-sm font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Future Plans */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400">rocket_launch</span>
          {lang === 'bn' ? 'ভবিষ্যৎ পরিকল্পনা' : 'Future Plans'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: 'phone_android', label: lang === 'bn' ? 'মোবাইল রিপেয়ার' : 'Mobile Repair', status: 'planned' },
            { icon: 'local_pharmacy', label: lang === 'bn' ? 'ফার্মেসি' : 'Pharmacy', status: 'planned' },
            { icon: 'shopping_cart', label: lang === 'bn' ? 'মুদি দোকান' : 'Grocery', status: 'planned' },
            { icon: 'devices', label: lang === 'bn' ? 'ইলেকট্রনিক্স' : 'Electronics', status: 'planned' },
            { icon: 'checkroom', label: lang === 'bn' ? 'পোশাক' : 'Clothing', status: 'planned' },
            { icon: 'storefront', label: lang === 'bn' ? 'সব ধরনের দোকান' : 'All Shops', status: 'planned' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/30 rounded-xl p-4 text-center">
              <span className="material-symbols-outlined text-2xl text-gray-500 mb-2 block">{item.icon}</span>
              <p className="text-xs font-bold text-gray-400">{item.label}</p>
              <span className="text-[10px] text-gray-600 mt-1 block">Coming Soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
