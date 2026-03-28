import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string;
  blocked: boolean;
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

  // License form
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [licenseForm, setLicenseForm] = useState({
    user_id: '', shop_name: '', owner_name: '', owner_phone: '', owner_email: '',
    setup_fee: 10000, annual_fee: 3000, license_start: new Date().toISOString().slice(0, 10),
    license_expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), notes: '',
  });
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);

  // Message form
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgForm, setMsgForm] = useState({ recipient_id: '', subject: '', message: '', message_type: 'general' });
  const [sentMessages, setSentMessages] = useState<AdminMessage[]>([]);

  useEffect(() => { checkAdminAndLoad(); }, [user]);

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
    const { data: allRoles } = await supabase.from('user_roles').select('*');
    const { data: allSettings } = await supabase.from('company_settings').select('user_id, user_name, email');
    const userMap = new Map<string, UserWithRole>();
    allSettings?.forEach(s => userMap.set(s.user_id, { id: s.user_id, email: s.email || '', created_at: '', role: 'user', blocked: false }));
    allRoles?.forEach(r => {
      const existing = userMap.get(r.user_id);
      if (existing) existing.role = r.role;
      else userMap.set(r.user_id, { id: r.user_id, email: '', created_at: r.created_at, role: r.role, blocked: false });
    });
    setUsers(Array.from(userMap.values()));
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

  const makeFirstAdmin = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' as any });
      if (error) throw error;
      toast.success('You are now System Admin!');
      checkAdminAndLoad();
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
        sender_id: user!.id,
        recipient_id: msgForm.recipient_id,
        subject: msgForm.subject,
        message: msgForm.message,
        message_type: msgForm.message_type,
      } as any);
      if (error) throw error;
      toast.success(lang === 'bn' ? 'মেসেজ পাঠানো হয়েছে' : 'Message sent');
      setShowMsgForm(false);
      setMsgForm({ recipient_id: '', subject: '', message: '', message_type: 'general' });
      loadMessages();
    } catch (err: any) { toast.error(err.message); }
  };

  const sendExpiryWarning = async (license: License) => {
    try {
      const { error } = await supabase.from('admin_messages').insert({
        sender_id: user!.id,
        recipient_id: license.user_id,
        subject: lang === 'bn' ? '⚠️ লাইসেন্স মেয়াদ শেষ হচ্ছে' : '⚠️ License Expiring Soon',
        message: lang === 'bn'
          ? `প্রিয় ${license.owner_name}, আপনার "${license.shop_name}" দোকানের Dokani সফটওয়্যার লাইসেন্সের মেয়াদ ${license.license_expiry} তারিখে শেষ হবে। দয়া করে রিনিউ করুন। মেয়াদ শেষের ২ দিন পর সফটওয়্যার অটো-ব্লক হয়ে যাবে। রিনিউয়াল ফি: ৳${license.annual_fee}।`
          : `Dear ${license.owner_name}, your Dokani license for "${license.shop_name}" expires on ${license.license_expiry}. Please renew. The software will auto-block 2 days after expiry. Renewal fee: ৳${license.annual_fee}.`,
        message_type: 'license_warning',
      } as any);
      if (error) throw error;
      toast.success(lang === 'bn' ? 'সতর্কবার্তা পাঠানো হয়েছে' : 'Warning sent');
      loadMessages();
    } catch (err: any) { toast.error(err.message); }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const getExpiryBadge = (expiryDate: string, isBlocked: boolean) => {
    if (isBlocked) return { text: lang === 'bn' ? 'ব্লক' : 'Blocked', color: 'bg-red-100 text-red-700' };
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return { text: lang === 'bn' ? 'মেয়াদ শেষ' : 'Expired', color: 'bg-red-100 text-red-700' };
    if (days <= 7) return { text: `${days}${lang === 'bn' ? ' দিন বাকি' : 'd left'}`, color: 'bg-orange-100 text-orange-700' };
    if (days <= 30) return { text: `${days}${lang === 'bn' ? ' দিন বাকি' : 'd left'}`, color: 'bg-yellow-100 text-yellow-700' };
    return { text: lang === 'bn' ? 'সক্রিয়' : 'Active', color: 'bg-green-100 text-green-700' };
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search));
  const filteredLicenses = licenses.filter(l => l.shop_name.toLowerCase().includes(search.toLowerCase()) || l.owner_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-card rounded-2xl border p-8 text-center max-w-md mx-auto">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4">admin_panel_settings</span>
          <h2 className="text-xl font-bold mb-2">{lang === 'bn' ? 'সিস্টেম অ্যাডমিন অ্যাক্সেস প্রয়োজন' : 'System Admin Access Required'}</h2>
          <p className="text-muted-foreground text-sm mb-6">{lang === 'bn' ? 'এই পেজে অ্যাক্সেস করতে অ্যাডমিন রোল দরকার।' : 'You need admin role to access this page.'}</p>
          <button onClick={makeFirstAdmin} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
            {lang === 'bn' ? 'প্রথম সিস্টেম অ্যাডমিন হিসেবে সেটআপ' : 'Setup as First System Admin'}
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; icon: string; label: string }[] = [
    { id: 'licenses', icon: 'license', label: lang === 'bn' ? 'লাইসেন্স' : 'Licenses' },
    { id: 'users', icon: 'group', label: lang === 'bn' ? 'ইউজার' : 'Users' },
    { id: 'messages', icon: 'mail', label: lang === 'bn' ? 'মেসেজ' : 'Messages' },
  ];

  const expiringCount = licenses.filter(l => !l.is_blocked && getDaysUntilExpiry(l.license_expiry) <= 7 && getDaysUntilExpiry(l.license_expiry) >= 0).length;
  const expiredCount = licenses.filter(l => getDaysUntilExpiry(l.license_expiry) < 0).length;
  const blockedCount = licenses.filter(l => l.is_blocked).length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">admin_panel_settings</span>
            {lang === 'bn' ? 'সিস্টেম অ্যাডমিন প্যানেল' : 'System Admin Panel'}
          </h1>
          <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'লাইসেন্স, ইউজার ও মেসেজ ম্যানেজ করুন' : 'Manage licenses, users & messages'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: 'license', label: lang === 'bn' ? 'মোট লাইসেন্স' : 'Total Licenses', value: licenses.length, color: 'bg-blue-100 text-blue-600' },
          { icon: 'check_circle', label: lang === 'bn' ? 'সক্রিয়' : 'Active', value: licenses.filter(l => !l.is_blocked && getDaysUntilExpiry(l.license_expiry) >= 0).length, color: 'bg-green-100 text-green-600' },
          { icon: 'schedule', label: lang === 'bn' ? 'শেষ হচ্ছে' : 'Expiring', value: expiringCount, color: 'bg-orange-100 text-orange-600' },
          { icon: 'error', label: lang === 'bn' ? 'মেয়াদ শেষ' : 'Expired', value: expiredCount, color: 'bg-red-100 text-red-600' },
          { icon: 'block', label: lang === 'bn' ? 'ব্লক' : 'Blocked', value: blockedCount, color: 'bg-gray-200 text-gray-600' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border p-3">
            <div className={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center mb-1.5`}>
              <span className="material-symbols-outlined text-lg">{s.icon}</span>
            </div>
            <p className="text-xl font-black text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
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
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'bn' ? 'খুঁজুন...' : 'Search...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
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

          {/* License Form Modal */}
          {showLicenseForm && (
            <div className="bg-card rounded-xl border p-5 space-y-4">
              <h3 className="font-bold text-foreground">{editingLicenseId ? (lang === 'bn' ? 'লাইসেন্স সম্পাদনা' : 'Edit License') : (lang === 'bn' ? 'নতুন লাইসেন্স' : 'New License')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {!editingLicenseId && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'ইউজার সিলেক্ট' : 'Select User'}</label>
                    <select value={licenseForm.user_id} onChange={e => setLicenseForm({ ...licenseForm, user_id: e.target.value })}
                      className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card">
                      <option value="">{lang === 'bn' ? 'ইউজার বাছুন' : 'Select user'}</option>
                      {users.filter(u => !licenses.find(l => l.user_id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.email || u.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'দোকানের নাম *' : 'Shop Name *'}</label>
                  <input value={licenseForm.shop_name} onChange={e => setLicenseForm({ ...licenseForm, shop_name: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'মালিকের নাম *' : 'Owner Name *'}</label>
                  <input value={licenseForm.owner_name} onChange={e => setLicenseForm({ ...licenseForm, owner_name: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'মোবাইল' : 'Phone'}</label>
                  <input value={licenseForm.owner_phone} onChange={e => setLicenseForm({ ...licenseForm, owner_phone: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
                  <input value={licenseForm.owner_email} onChange={e => setLicenseForm({ ...licenseForm, owner_email: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'সেটআপ ফি (৳)' : 'Setup Fee (৳)'}</label>
                  <input type="number" value={licenseForm.setup_fee} onChange={e => setLicenseForm({ ...licenseForm, setup_fee: +e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'বাৎসরিক ফি (৳)' : 'Annual Fee (৳)'}</label>
                  <input type="number" value={licenseForm.annual_fee} onChange={e => setLicenseForm({ ...licenseForm, annual_fee: +e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'শুরু তারিখ' : 'Start Date'}</label>
                  <input type="date" value={licenseForm.license_start} onChange={e => setLicenseForm({ ...licenseForm, license_start: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'মেয়াদ শেষ' : 'Expiry Date'}</label>
                  <input type="date" value={licenseForm.license_expiry} onChange={e => setLicenseForm({ ...licenseForm, license_expiry: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'নোট' : 'Notes'}</label>
                  <textarea value={licenseForm.notes} onChange={e => setLicenseForm({ ...licenseForm, notes: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowLicenseForm(false)} className="px-4 py-2 border rounded-lg text-sm">{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                <button onClick={saveLicense} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">{lang === 'bn' ? 'সেভ করুন' : 'Save'}</button>
              </div>
            </div>
          )}

          {/* Licenses Table */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'দোকান' : 'Shop'}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'মালিক' : 'Owner'}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'ফি' : 'Fee'}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'মেয়াদ' : 'Expiry'}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map(l => {
                    const badge = getExpiryBadge(l.license_expiry, l.is_blocked);
                    const daysLeft = getDaysUntilExpiry(l.license_expiry);
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-foreground">{l.shop_name}</p>
                          <p className="text-[10px] text-muted-foreground">{l.owner_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{l.owner_name}</p>
                          <p className="text-[10px] text-muted-foreground">{l.owner_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-foreground">৳{l.setup_fee.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">+৳{l.annual_fee}/yr</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{l.license_expiry}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badge.color}`}>{badge.text}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {/* Edit */}
                            <button onClick={() => {
                              setEditingLicenseId(l.id);
                              setLicenseForm({ user_id: l.user_id, shop_name: l.shop_name, owner_name: l.owner_name, owner_phone: l.owner_phone, owner_email: l.owner_email, setup_fee: l.setup_fee, annual_fee: l.annual_fee, license_start: l.license_start, license_expiry: l.license_expiry, notes: l.notes });
                              setShowLicenseForm(true);
                            }} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Edit">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            {/* Send warning */}
                            {daysLeft <= 7 && daysLeft >= -2 && !l.is_blocked && (
                              <button onClick={() => sendExpiryWarning(l)} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-600 transition-colors" title={lang === 'bn' ? 'সতর্কবার্তা পাঠান' : 'Send warning'}>
                                <span className="material-symbols-outlined text-lg">notification_important</span>
                              </button>
                            )}
                            {/* Block/Unblock */}
                            <button onClick={() => toggleBlock(l)}
                              className={`p-1.5 rounded-lg transition-colors ${l.is_blocked ? 'hover:bg-green-100 text-green-600' : 'hover:bg-red-100 text-red-500'}`}
                              title={l.is_blocked ? 'Unblock' : 'Block'}>
                              <span className="material-symbols-outlined text-lg">{l.is_blocked ? 'lock_open' : 'block'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLicenses.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">{lang === 'bn' ? 'কোনো লাইসেন্স নেই' : 'No licenses found'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'ইউজার' : 'User'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'রোল' : 'Role'}</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">{(u.email || 'U').substring(0, 2).toUpperCase()}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{u.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</span></td>
                    <td className="px-4 py-3">
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} disabled={u.id === user?.id}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'moderator' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                        <option value="user">{lang === 'bn' ? 'ইউজার' : 'User'}</option>
                        <option value="moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                        <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setMsgForm({ ...msgForm, recipient_id: u.id }); setShowMsgForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Send message">
                        <span className="material-symbols-outlined text-lg">send</span>
                      </button>
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

          {/* Message Form */}
          {showMsgForm && (
            <div className="bg-card rounded-xl border p-5 space-y-4">
              <h3 className="font-bold text-foreground">{lang === 'bn' ? 'মেসেজ পাঠান' : 'Send Message'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'প্রাপক' : 'Recipient'}</label>
                  <select value={msgForm.recipient_id} onChange={e => setMsgForm({ ...msgForm, recipient_id: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card">
                    <option value="">{lang === 'bn' ? 'ইউজার বাছুন' : 'Select user'}</option>
                    {licenses.map(l => <option key={l.user_id} value={l.user_id}>{l.shop_name} ({l.owner_name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'ধরন' : 'Type'}</label>
                  <select value={msgForm.message_type} onChange={e => setMsgForm({ ...msgForm, message_type: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card">
                    <option value="general">{lang === 'bn' ? 'সাধারণ' : 'General'}</option>
                    <option value="license_warning">{lang === 'bn' ? 'লাইসেন্স সতর্কতা' : 'License Warning'}</option>
                    <option value="payment_reminder">{lang === 'bn' ? 'পেমেন্ট রিমাইন্ডার' : 'Payment Reminder'}</option>
                    <option value="update">{lang === 'bn' ? 'আপডেট' : 'Update'}</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'বিষয়' : 'Subject'}</label>
                  <input value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{lang === 'bn' ? 'মেসেজ' : 'Message'}</label>
                  <textarea value={msgForm.message} onChange={e => setMsgForm({ ...msgForm, message: e.target.value })}
                    className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-card" rows={3} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMsgForm(false)} className="px-4 py-2 border rounded-lg text-sm">{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">{lang === 'bn' ? 'পাঠান' : 'Send'}</button>
              </div>
            </div>
          )}

          {/* Sent Messages */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-bold text-foreground">{lang === 'bn' ? 'পাঠানো মেসেজ' : 'Sent Messages'} ({sentMessages.length})</p>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {sentMessages.map(m => {
                const recipient = licenses.find(l => l.user_id === m.recipient_id);
                return (
                  <div key={m.id} className="px-4 py-3 hover:bg-muted/20">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground">{m.subject || '(No subject)'}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.message_type === 'license_warning' ? 'bg-orange-100 text-orange-700' :
                          m.message_type === 'payment_reminder' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{m.message_type}</span>
                        {m.is_read && <span className="material-symbols-outlined text-green-500 text-sm">done_all</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {lang === 'bn' ? 'প্রাপক:' : 'To:'} {recipient?.shop_name || m.recipient_id.slice(0, 8)} · {new Date(m.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-foreground/70 line-clamp-2">{m.message}</p>
                  </div>
                );
              })}
              {sentMessages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">{lang === 'bn' ? 'কোনো মেসেজ নেই' : 'No messages yet'}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
