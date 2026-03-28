import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  joinDate: string;
  status: 'active' | 'inactive';
}

export default function StaffsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Salesman');
  const [salary, setSalary] = useState('');

  const fetchStaffs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('staffs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch staffs error:', error); return; }
    setStaffs((data || []).map((s: any) => ({
      id: s.id, name: s.name, phone: s.phone, role: s.role,
      salary: Number(s.salary), joinDate: s.join_date, status: s.status as 'active' | 'inactive',
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchStaffs(); }, [fetchStaffs]);

  const handleAdd = async () => {
    if (!name.trim() || !user) return;
    const { error } = await supabase.from('staffs').insert({
      user_id: user.id, name: name.trim(), phone, role,
      salary: parseFloat(salary) || 0, status: 'active',
    } as any);
    if (error) { toast.error('Failed to add staff'); return; }
    toast.success('Staff added');
    setName(''); setPhone(''); setRole('Salesman'); setSalary('');
    setShowForm(false);
    fetchStaffs();
  };

  const toggleStatus = async (id: string) => {
    const staff = staffs.find(s => s.id === id);
    if (!staff) return;
    const newStatus = staff.status === 'active' ? 'inactive' : 'active';
    await supabase.from('staffs').update({ status: newStatus } as any).eq('id', id);
    fetchStaffs();
  };

  const deleteStaff = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await supabase.from('staffs').delete().eq('id', id);
    toast.success('Staff deleted');
    fetchStaffs();
  };

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Staffs</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors">
          <span className="material-symbols-outlined text-lg">person_add</span>
          Add Staff
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">New Staff</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Staff name" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring">
                <option>Salesman</option>
                <option>Manager</option>
                <option>Delivery</option>
                <option>Labour</option>
                <option>Accountant</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Salary</label>
              <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90">Save</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 bg-muted text-foreground rounded-lg text-sm font-semibold hover:bg-muted/80">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : staffs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-muted-foreground/30 mb-3">badge</span>
          <p className="text-muted-foreground text-sm">No staff members added yet</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Click "Add Staff" to get started</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Phone</th>
                <th className="text-left py-3 px-4">Role</th>
                <th className="text-right py-3 px-4">Salary</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffs.map(s => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{s.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{s.phone || '-'}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{s.role}</span>
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-right">৳{s.salary.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => toggleStatus(s.id)}
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        s.status === 'active' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)]' : 'bg-muted text-muted-foreground'
                      }`}>
                      {s.status}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => deleteStaff(s.id)} className="text-destructive hover:text-destructive/80">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
