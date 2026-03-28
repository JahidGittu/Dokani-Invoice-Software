import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

interface UserWithRole {
  id: string;
  email: string;
  shop_name: string;
  phone: string;
  full_name: string;
  created_at: string;
  role: string;
  blocked: boolean;
  status: string; // 'pending' | 'active'
  hasLicense: boolean;
}

interface License {
  id: string;
  user_id: string;
  shop_name: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  setup_fee: number;
  annual_fee: number;
  license_start: string;
  license_expiry: string;
  status: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string;
  payment_history: any[];
  notes: string;
  created_at: string;
}

interface AdminMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  message: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

interface ProfileRecord {
  user_id: string;
  email: string;
  shop_name: string;
  phone: string;
}

type AdminTab = 'users' | 'licenses' | 'messages';

export default function AdminScreen({ initialTab }: { initialTab?: string }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'licenses');

  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [licenseForm, setLicenseForm] = useState({
    user_id: '', shop_name: '', owner_name: '', owner_phone: '', owner_email: '',
    setup_fee: 10000, annual_fee: 3000, license_start: new Date().toISOString().slice(0, 10),
    license_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), notes: '',
  });
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);

  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgForm, setMsgForm] = useState({ recipient_id: '', subject: '', message: '', message_type: 'general' });
  const [sentMessages, setSentMessages] = useState<AdminMessage[]>([]);

  useEffect(() => { checkAdminAndLoad(); }, [user]);
  useEffect(() => { if (initialTab) setActiveTab(initialTab as AdminTab); }, [initialTab]);
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin-screen-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
        loadUsers();
        loadMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, () => {
        loadUsers();
        loadLicenses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, () => {
        loadUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        loadUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAdminAndLoad = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: roleData } = await supabase.from('user_roles').select('role')
        .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (roleData) {
        setIsAdmin(true);
        await Promise.all([loadUsers(), loadLicenses(), loadMessages()]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    const [{ data: profiles }, { data: allRoles }, { data: allLicenses }] = await Promise.all([
      supabase.from('profiles').select('user_id, email, shop_name, phone, full_name, status, created_at'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('licenses').select('user_id'),
    ]);

    const roleMap = new Map<string, string>();
    allRoles?.forEach(r => roleMap.set(r.user_id, r.role));

    const licenseSet = new Set<string>();
    allLicenses?.forEach(l => licenseSet.add(l.user_id));

    const result: UserWithRole[] = (profiles || []).map((p: any) => ({
      id: p.user_id,
      email: p.email || '',
      shop_name: p.shop_name || '',
      phone: p.phone || '',
      created_at: p.created_at,
      role: roleMap.get(p.user_id) || 'user',
      blocked: false,
      status: licenseSet.has(p.user_id) ? 'active' : (p.status || 'pending'),
      hasLicense: licenseSet.has(p.user_id),
    }));

    setUsers(result);
  };

  const loadLicenses = async () => {
    const { data } = await supabase.from('licenses').select('*').order('created_at', { ascending: false });
    if (data) setLicenses(data as any);
  };

  const loadMessages = async () => {
    const { data } = await supabase.from('admin_messages').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setSentMessages(data as any);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
      if (error) throw error;
      toast.success(lang === 'bn' ? 'রোল আপডেট হয়েছে' : 'Role updated');
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const saveLicense = async () => {
    if (!licenseForm.shop_name || !licenseForm.owner_name) {
      toast.error(lang === 'bn' ? 'দোকানের নাম ও মালিকের নাম দিন' : 'Shop name & owner name required');
      return;
    }
    try {
      if (editingLicenseId) {
        const { error } = await supabase.from('licenses').update({
          shop_name: licenseForm.shop_name, owner_name: licenseForm.owner_name,
          owner_phone: licenseForm.owner_phone, owner_email: licenseForm.owner_email,
          setup_fee: licenseForm.setup_fee, annual_fee: licenseForm.annual_fee,
          license_start: licenseForm.license_start, license_expiry: licenseForm.license_expiry,
          notes: licenseForm.notes,
        } as any).eq('id', editingLicenseId);
        if (error) throw error;
        toast.success(lang === 'bn' ? 'লাইসেন্স আপডেট হয়েছে' : 'License updated');
      } else {
        const { error } = await supabase.from('licenses').insert({
          user_id: licenseForm.user_id || user!.id,
          shop_name: licenseForm.shop_name, owner_name: licenseForm.owner_name,
          owner_phone: licenseForm.owner_phone, owner_email: licenseForm.owner_email,
          setup_fee: licenseForm.setup_fee, annual_fee: licenseForm.annual_fee,
          license_start: licenseForm.license_start, license_expiry: licenseForm.license_expiry,
          notes: licenseForm.notes,
        } as any);
        if (error) throw error;
        toast.success(lang === 'bn' ? 'লাইসেন্স তৈরি হয়েছে' : 'License created');
      }
      setShowLicenseForm(false);
      setEditingLicenseId(null);
      loadLicenses();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleBlock = async (license: License) => {
    try {
      const { error } = await supabase.from('licenses').update({
        is_blocked: !license.is_blocked,
        blocked_at: !license.is_blocked ? new Date().toISOString() : null,
        blocked_reason: !license.is_blocked ? 'Manually blocked by admin' : '',
        status: !license.is_blocked ? 'blocked' : 'active',
      } as any).eq('id', license.id);
      if (error) throw error;
      toast.success(!license.is_blocked
        ? (lang === 'bn' ? 'ব্লক করা হয়েছে' : 'User blocked')
        : (lang === 'bn' ? 'আনব্লক করা হয়েছে' : 'User unblocked'));
      loadLicenses();
    } catch (err: any) { toast.error(err.message); }
  };

  const sendMessage = async () => {
    if (!msgForm.recipient_id || !msgForm.message) {
      toast.error(lang === 'bn' ? 'প্রাপক ও মেসেজ দিন' : 'Recipient and message required');
      return;
    }
    try {
      const { error } = await supabase.from('admin_messages').insert({
        sender_id: user!.id, recipient_id: msgForm.recipient_id,
        subject: msgForm.subject, message: msgForm.message, message_type: msgForm.message_type,
      } as any);
      if (error) throw error;
      toast.success(lang === 'bn' ? 'মেসেজ পাঠানো হয়েছে' : 'Message sent');
      setShowMsgForm(false);
      setMsgForm({ recipient_id: '', subject: '', message: '', message_type: 'general' });
      loadMessages();
    } catch (err: any) { toast.error(err.message); }
  };

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const banUser = async (userId: string) => {
    try {
      // Block their license if exists
      const { data: lic } = await supabase.from('licenses').select('id').eq('user_id', userId).maybeSingle();
      if (lic) {
        await supabase.from('licenses').update({
          is_blocked: true, blocked_at: new Date().toISOString(),
          blocked_reason: 'Banned by admin', status: 'blocked',
        } as any).eq('id', lic.id);
      }
      // Update profile status
      await supabase.from('profiles').update({ status: 'banned' } as any).eq('user_id', userId);
      toast.success(lang === 'bn' ? 'ইউজার ব্যান করা হয়েছে' : 'User banned');
      loadUsers(); loadLicenses();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(lang === 'bn' ? 'ইউজার পুরোপুরি ডিলেট করা হয়েছে' : 'User deleted permanently');
      setConfirmDelete(null);
      loadUsers();
      loadLicenses();
      loadMessages();
    } catch (err: any) {
      toast.error(err.message || (lang === 'bn' ? 'ইউজার ডিলেট করা যায়নি' : 'Failed to delete user'));
    }
  };

  const sendExpiryWarning = async (license: License) => {
    try {
      const { error } = await supabase.from('admin_messages').insert({
        sender_id: user!.id, recipient_id: license.user_id,
        subject: lang === 'bn' ? '⚠️ লাইসেন্স মেয়াদ শেষ হচ্ছে' : '⚠️ License Expiring Soon',
        message: lang === 'bn'
          ? `প্রিয় ${license.owner_name}, আপনার "${license.shop_name}" দোকানের Dokani সফটওয়্যার লাইসেন্সের মেয়াদ ${license.license_expiry} তারিখে শেষ হবে। রিনিউয়াল ফি: ৳${license.annual_fee}।`
          : `Dear ${license.owner_name}, your Dokani license for "${license.shop_name}" expires on ${license.license_expiry}. Renewal fee: ৳${license.annual_fee}.`,
        message_type: 'license_warning',
      } as any);
      if (error) throw error;
      toast.success(lang === 'bn' ? 'সতর্কবার্তা পাঠানো হয়েছে' : 'Warning sent');
      loadMessages();
    } catch (err: any) { toast.error(err.message); }
  };

  const getDaysUntilExpiry = (expiryDate: string) => Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);

  const getExpiryBadge = (expiryDate: string, isBlocked: boolean) => {
    if (isBlocked) return { text: lang === 'bn' ? 'ব্লক' : 'Blocked', color: 'bg-red-500/20 text-red-400' };
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return { text: lang === 'bn' ? 'মেয়াদ শেষ' : 'Expired', color: 'bg-red-500/20 text-red-400' };
    if (days <= 7) return { text: `${days}${lang === 'bn' ? ' দিন বাকি' : 'd left'}`, color: 'bg-orange-500/20 text-orange-400' };
    if (days <= 30) return { text: `${days}${lang === 'bn' ? ' দিন বাকি' : 'd left'}`, color: 'bg-yellow-500/20 text-yellow-400' };
    return { text: lang === 'bn' ? 'সক্রিয়' : 'Active', color: 'bg-green-500/20 text-green-400' };
  };

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase();
    return (u.email || '').toLowerCase().includes(s) || (u.shop_name || '').toLowerCase().includes(s) || u.id.includes(search);
  });
  const filteredLicenses = licenses.filter(l => l.shop_name.toLowerCase().includes(search.toLowerCase()) || l.owner_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center max-w-md mx-auto">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4">admin_panel_settings</span>
          <h2 className="text-xl font-bold text-white mb-2">{lang === 'bn' ? 'সিস্টেম অ্যাডমিন অ্যাক্সেস প্রয়োজন' : 'System Admin Access Required'}</h2>
          <p className="text-gray-400 text-sm">{lang === 'bn' ? 'এই পেজে অ্যাক্সেস করতে অ্যাডমিন রোল দরকার।' : 'You need admin role to access this page.'}</p>
        </div>
      </div>
    );
  }

  const expiringCount = licenses.filter(l => !l.is_blocked && getDaysUntilExpiry(l.license_expiry) <= 7 && getDaysUntilExpiry(l.license_expiry) >= 0).length;

  // Dark-themed input class
  const inputCls = "w-full mt-1 border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none";
  const selectCls = inputCls;

  const tabs: { id: AdminTab; icon: string; label: string }[] = [
    { id: 'licenses', icon: 'license', label: lang === 'bn' ? 'লাইসেন্স' : 'Licenses' },
    { id: 'users', icon: 'group', label: lang === 'bn' ? 'ইউজার' : 'Users' },
    { id: 'messages', icon: 'mail', label: lang === 'bn' ? 'মেসেজ' : 'Messages' },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id ? 'bg-gray-700 shadow-sm text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
            {tab.id === 'licenses' && expiringCount > 0 && (
              <span className="w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center">{expiringCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'bn' ? 'খুঁজুন...' : 'Search...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
      </div>

      {/* ===== LICENSES TAB ===== */}
      {activeTab === 'licenses' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowLicenseForm(true); setEditingLicenseId(null); setLicenseForm({ user_id: '', shop_name: '', owner_name: '', owner_phone: '', owner_email: '', setup_fee: 10000, annual_fee: 3000, license_start: new Date().toISOString().slice(0, 10), license_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), notes: '' }); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
              <span className="material-symbols-outlined text-lg">add</span>
              {lang === 'bn' ? 'নতুন লাইসেন্স' : 'New License'}
            </button>
          </div>

          {/* License Form */}
          {showLicenseForm && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
              <h3 className="font-bold text-white">{editingLicenseId ? (lang === 'bn' ? 'লাইসেন্স সম্পাদনা' : 'Edit License') : (lang === 'bn' ? 'নতুন লাইসেন্স' : 'New License')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {!editingLicenseId && (
                  <div>
                    <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'ইউজার সিলেক্ট' : 'Select User'}</label>
                    <select value={licenseForm.user_id} onChange={e => setLicenseForm({ ...licenseForm, user_id: e.target.value })} className={selectCls}>
                      <option value="">{lang === 'bn' ? 'ইউজার বাছুন' : 'Select user'}</option>
                      {users.filter(u => !licenses.find(l => l.user_id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.email || u.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {[
                  { key: 'shop_name', label: lang === 'bn' ? 'দোকানের নাম *' : 'Shop Name *' },
                  { key: 'owner_name', label: lang === 'bn' ? 'মালিকের নাম *' : 'Owner Name *' },
                  { key: 'owner_phone', label: lang === 'bn' ? 'মোবাইল' : 'Phone' },
                  { key: 'owner_email', label: lang === 'bn' ? 'ইমেইল' : 'Email' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-gray-400">{f.label}</label>
                    <input value={(licenseForm as any)[f.key]} onChange={e => setLicenseForm({ ...licenseForm, [f.key]: e.target.value })} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'সেটআপ ফি (৳)' : 'Setup Fee (৳)'}</label>
                  <input type="number" value={licenseForm.setup_fee} onChange={e => setLicenseForm({ ...licenseForm, setup_fee: +e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'বাৎসরিক ফি (৳)' : 'Annual Fee (৳)'}</label>
                  <input type="number" value={licenseForm.annual_fee} onChange={e => setLicenseForm({ ...licenseForm, annual_fee: +e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'শুরু তারিখ' : 'Start Date'}</label>
                  <input type="date" value={licenseForm.license_start} onChange={e => setLicenseForm({ ...licenseForm, license_start: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'মেয়াদ শেষ' : 'Expiry Date'}</label>
                  <input type="date" value={licenseForm.license_expiry} onChange={e => setLicenseForm({ ...licenseForm, license_expiry: e.target.value })} className={inputCls} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'নোট' : 'Notes'}</label>
                  <textarea value={licenseForm.notes} onChange={e => setLicenseForm({ ...licenseForm, notes: e.target.value })} className={inputCls} rows={2} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowLicenseForm(false)} className="px-4 py-2 border border-gray-700 text-gray-400 rounded-lg text-sm hover:bg-gray-800">{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                <button onClick={saveLicense} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{lang === 'bn' ? 'সেভ করুন' : 'Save'}</button>
              </div>
            </div>
          )}

          {/* License Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLicenses.map(l => {
              const badge = getExpiryBadge(l.license_expiry, l.is_blocked);
              const daysLeft = getDaysUntilExpiry(l.license_expiry);
              return (
                <div key={l.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400">storefront</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{l.shop_name}</p>
                        <p className="text-[10px] text-gray-500">{l.owner_name}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.text}</span>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{lang === 'bn' ? 'ফোন' : 'Phone'}</span>
                      <span className="text-gray-300">{l.owner_phone || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{lang === 'bn' ? 'ইমেইল' : 'Email'}</span>
                      <span className="text-gray-300">{l.owner_email || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{lang === 'bn' ? 'সেটআপ + বাৎসরিক' : 'Setup + Annual'}</span>
                      <span className="text-gray-300 font-bold">৳{l.setup_fee.toLocaleString()} + ৳{l.annual_fee.toLocaleString()}/yr</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{lang === 'bn' ? 'মেয়াদ' : 'Period'}</span>
                      <span className="text-gray-300">{l.license_start} → {l.license_expiry}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-800">
                    <button onClick={() => {
                      setEditingLicenseId(l.id);
                      setLicenseForm({ user_id: l.user_id, shop_name: l.shop_name, owner_name: l.owner_name, owner_phone: l.owner_phone, owner_email: l.owner_email, setup_fee: l.setup_fee, annual_fee: l.annual_fee, license_start: l.license_start, license_expiry: l.license_expiry, notes: l.notes });
                      setShowLicenseForm(true);
                    }} className="flex-1 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">edit</span> {lang === 'bn' ? 'সম্পাদনা' : 'Edit'}
                    </button>
                    {daysLeft <= 7 && daysLeft >= -2 && !l.is_blocked && (
                      <button onClick={() => sendExpiryWarning(l)} className="flex-1 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span> {lang === 'bn' ? 'সতর্ক' : 'Warn'}
                      </button>
                    )}
                    <button onClick={() => toggleBlock(l)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                        l.is_blocked ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}>
                      <span className="material-symbols-outlined text-sm">{l.is_blocked ? 'lock_open' : 'block'}</span>
                      {l.is_blocked ? (lang === 'bn' ? 'আনব্লক' : 'Unblock') : (lang === 'bn' ? 'ব্লক' : 'Block')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredLicenses.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">{lang === 'bn' ? 'কোনো লাইসেন্স নেই' : 'No licenses found'}</div>
          )}
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">{lang === 'bn' ? 'ইউজার / দোকান' : 'User / Shop'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">{lang === 'bn' ? 'ফোন' : 'Phone'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">{lang === 'bn' ? 'রোল' : 'Role'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {/* Admins first */}
                {filteredUsers.filter(u => u.role === 'admin').map(u => (
                  <tr key={u.id} className="border-b-2 border-blue-500/30 bg-blue-950/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/30 to-purple-500/30 ring-2 ring-blue-500/40">
                          <span className="text-xs font-bold text-blue-300">
                            {(u.email || 'A').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-blue-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-400">shield</span>
                            {u.shop_name || u.email || 'System Admin'}
                          </p>
                          <p className="text-[10px] text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{u.phone || '—'}</span></td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400">
                        🛡️ {lang === 'bn' ? 'সিস্টেম অ্যাডমিন' : 'System Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                        {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-gray-600 italic">{lang === 'bn' ? 'সুরক্ষিত' : 'Protected'}</span>
                    </td>
                  </tr>
                ))}
                {/* Separator */}
                {filteredUsers.some(u => u.role === 'admin') && filteredUsers.some(u => u.role !== 'admin') && (
                  <tr><td colSpan={5} className="py-1 bg-gray-800/30"><div className="border-t border-dashed border-gray-700" /></td></tr>
                )}
                {/* Regular users */}
                {filteredUsers.filter(u => u.role !== 'admin').map(u => (
                  <tr key={u.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${u.status === 'pending' && !u.hasLicense ? 'bg-amber-500/20' : 'bg-blue-500/10'}`}>
                          <span className={`text-xs font-bold ${u.status === 'pending' && !u.hasLicense ? 'text-amber-400' : 'text-blue-400'}`}>
                            {(u.email || 'U').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{u.shop_name || u.email || 'No email'}</p>
                          <p className="text-[10px] text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{u.phone || '—'}</span></td>
                    <td className="px-4 py-3">
                      {u.hasLicense ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400">
                          {lang === 'bn' ? '✅ সক্রিয়' : '✅ Active'}
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400">
                          {lang === 'bn' ? '🛡️ অ্যাডমিন' : '🛡️ Admin'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 animate-pulse">
                          {lang === 'bn' ? '⏳ অপেক্ষায়' : '⏳ Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} disabled={u.id === user?.id}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${
                          u.role === 'admin' ? 'bg-red-500/20 text-red-400' : u.role === 'moderator' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                        <option value="user">{lang === 'bn' ? 'ইউজার' : 'User'}</option>
                        <option value="moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                        <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {!u.hasLicense && u.role !== 'admin' && (
                          <button onClick={() => {
                            setActiveTab('licenses');
                            setShowLicenseForm(true);
                            setEditingLicenseId(null);
                            setLicenseForm({
                              user_id: u.id, shop_name: u.shop_name || '', owner_name: '', owner_phone: u.phone || '',
                              owner_email: u.email || '', setup_fee: 10000, annual_fee: 3000,
                              license_start: new Date().toISOString().slice(0, 10),
                              license_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), notes: '',
                            });
                          }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            {lang === 'bn' ? 'লাইসেন্স দিন' : 'Activate'}
                          </button>
                        )}
                        <button onClick={() => { setMsgForm({ ...msgForm, recipient_id: u.id }); setShowMsgForm(true); setActiveTab('messages'); }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors" title="Send message">
                          <span className="material-symbols-outlined text-lg">send</span>
                        </button>
                        {u.id !== user?.id && u.role !== 'admin' && (
                          <>
                            <button onClick={() => banUser(u.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-bold hover:bg-orange-500/20 transition-colors flex items-center gap-1"
                              title={lang === 'bn' ? 'ব্যান করুন' : 'Ban user'}>
                              <span className="material-symbols-outlined text-sm">block</span>
                              {lang === 'bn' ? 'ব্যান' : 'Ban'}
                            </button>
                            {confirmDelete === u.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deleteUser(u.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 transition-colors">
                                  {lang === 'bn' ? 'নিশ্চিত?' : 'Sure?'}
                                </button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="px-2 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-[10px] font-bold hover:bg-gray-600 transition-colors">
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors flex items-center gap-1"
                                title={lang === 'bn' ? 'ডিলেট করুন' : 'Delete user'}>
                                <span className="material-symbols-outlined text-sm">delete</span>
                                {lang === 'bn' ? 'ডিলেট' : 'Delete'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MESSAGES TAB ===== */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowMsgForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
              <span className="material-symbols-outlined text-lg">send</span>
              {lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
            </button>
          </div>

          {showMsgForm && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
              <h3 className="font-bold text-white">{lang === 'bn' ? 'মেসেজ পাঠান' : 'Send Message'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'প্রাপক' : 'Recipient'}</label>
                  <select value={msgForm.recipient_id} onChange={e => setMsgForm({ ...msgForm, recipient_id: e.target.value })} className={selectCls}>
                    <option value="">{lang === 'bn' ? 'ইউজার বাছুন' : 'Select user'}</option>
                    {licenses.map(l => <option key={l.user_id} value={l.user_id}>{l.shop_name} ({l.owner_name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'ধরন' : 'Type'}</label>
                  <select value={msgForm.message_type} onChange={e => setMsgForm({ ...msgForm, message_type: e.target.value })} className={selectCls}>
                    <option value="general">{lang === 'bn' ? 'সাধারণ' : 'General'}</option>
                    <option value="license_warning">{lang === 'bn' ? 'লাইসেন্স সতর্কতা' : 'License Warning'}</option>
                    <option value="payment_reminder">{lang === 'bn' ? 'পেমেন্ট রিমাইন্ডার' : 'Payment Reminder'}</option>
                    <option value="update">{lang === 'bn' ? 'আপডেট' : 'Update'}</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'বিষয়' : 'Subject'}</label>
                  <input value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-400">{lang === 'bn' ? 'মেসেজ' : 'Message'}</label>
                  <textarea value={msgForm.message} onChange={e => setMsgForm({ ...msgForm, message: e.target.value })} className={inputCls} rows={3} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMsgForm(false)} className="px-4 py-2 border border-gray-700 text-gray-400 rounded-lg text-sm hover:bg-gray-800">{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{lang === 'bn' ? 'পাঠান' : 'Send'}</button>
              </div>
            </div>
          )}

          {/* Sent Messages */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-bold text-white">{lang === 'bn' ? 'পাঠানো মেসেজ' : 'Sent Messages'} ({sentMessages.length})</p>
            </div>
            <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
              {sentMessages.map(m => {
                const recipient = licenses.find(l => l.user_id === m.recipient_id);
                return (
                  <div key={m.id} className="px-4 py-3 hover:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-white">{m.subject || '(No subject)'}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.message_type === 'license_warning' ? 'bg-orange-500/20 text-orange-400' :
                          m.message_type === 'payment_reminder' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>{m.message_type}</span>
                        {m.is_read && <span className="material-symbols-outlined text-green-400 text-sm">done_all</span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      {lang === 'bn' ? 'প্রাপক:' : 'To:'} {recipient?.shop_name || m.recipient_id.slice(0, 8)} · {new Date(m.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-2">{m.message}</p>
                  </div>
                );
              })}
              {sentMessages.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">{lang === 'bn' ? 'কোনো মেসেজ নেই' : 'No messages yet'}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
