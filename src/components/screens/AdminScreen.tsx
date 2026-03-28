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

export default function AdminScreen() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, [user]);

  const checkAdminAndLoadUsers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Check if current user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        setIsAdmin(true);
        // Load all user roles
        const { data: allRoles } = await supabase
          .from('user_roles')
          .select('*');

        // Load all company_settings to get user info
        const { data: allSettings } = await supabase
          .from('company_settings')
          .select('user_id, user_name, email');

        // Merge data
        const userMap = new Map<string, UserWithRole>();
        allSettings?.forEach(s => {
          userMap.set(s.user_id, {
            id: s.user_id,
            email: s.email || '',
            created_at: '',
            role: 'user',
            blocked: false,
          });
        });
        allRoles?.forEach(r => {
          const existing = userMap.get(r.user_id);
          if (existing) {
            existing.role = r.role;
          } else {
            userMap.set(r.user_id, {
              id: r.user_id,
              email: '',
              created_at: r.created_at,
              role: r.role,
              blocked: false,
            });
          }
        });
        setUsers(Array.from(userMap.values()));
      }
    } catch (err) {
      console.error('Admin check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Delete existing role
      await supabase.from('user_roles').delete().eq('user_id', userId);
      // Insert new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: newRole as any,
      });
      if (error) throw error;
      toast.success(lang === 'bn' ? 'রোল আপডেট হয়েছে' : 'Role updated');
      checkAdminAndLoadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const makeFirstAdmin = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'admin' as any,
      });
      if (error) throw error;
      toast.success('You are now admin!');
      checkAdminAndLoadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.id.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-8 text-center max-w-md mx-auto">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4">admin_panel_settings</span>
          <h2 className="text-xl font-bold mb-2">{lang === 'bn' ? 'অ্যাডমিন অ্যাক্সেস প্রয়োজন' : 'Admin Access Required'}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {lang === 'bn' ? 'এই পেজে অ্যাক্সেস করতে অ্যাডমিন রোল দরকার।' : 'You need admin role to access this page.'}
          </p>
          {/* First-time setup: if no admin exists */}
          <button onClick={makeFirstAdmin}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
            {lang === 'bn' ? 'প্রথম অ্যাডমিন হিসেবে সেটআপ করুন' : 'Setup as First Admin'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            {lang === 'bn' ? '(শুধু প্রথমবার সেটআপের জন্য)' : '(Only for first-time setup)'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">admin_panel_settings</span>
            {lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'bn' ? 'সব ইউজার ম্যানেজ করুন, রোল অ্যাসাইন করুন' : 'Manage all users and assign roles'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: 'group', label: lang === 'bn' ? 'মোট ইউজার' : 'Total Users', value: users.length, color: 'bg-blue-100 text-blue-600' },
          { icon: 'shield', label: lang === 'bn' ? 'অ্যাডমিন' : 'Admins', value: users.filter(u => u.role === 'admin').length, color: 'bg-red-100 text-red-600' },
          { icon: 'verified_user', label: lang === 'bn' ? 'মডারেটর' : 'Moderators', value: users.filter(u => u.role === 'moderator').length, color: 'bg-orange-100 text-orange-600' },
          { icon: 'person', label: lang === 'bn' ? 'সাধারণ ইউজার' : 'Regular Users', value: users.filter(u => u.role === 'user').length, color: 'bg-green-100 text-green-600' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border p-4">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center mb-2`}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'bn' ? 'ইউজার খুঁজুন...' : 'Search users...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">{lang === 'bn' ? 'ইউজার' : 'User'}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">{lang === 'bn' ? 'ইউজার ID' : 'User ID'}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">{lang === 'bn' ? 'রোল' : 'Role'}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">
                          {(u.email || 'U').substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{u.email || 'No email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === user?.id}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'moderator' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}
                    >
                      <option value="user">{lang === 'bn' ? 'ইউজার' : 'User'}</option>
                      <option value="moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                      <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {u.id !== user?.id && (
                        <button className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Block user">
                          <span className="material-symbols-outlined text-lg">block</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                    {lang === 'bn' ? 'কোনো ইউজার পাওয়া যায়নি' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
