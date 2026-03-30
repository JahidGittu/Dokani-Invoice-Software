import { useState, useEffect, useCallback, useRef } from "react";
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
  nid: string;
  photoUrl: string;
  fatherName: string;
  motherName: string;
  email: string;
  address: string;
}

export default function StaffsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit modal fields
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('Salesman');
  const [editNid, setEditNid] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editMotherName, setEditMotherName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editJoinDate, setEditJoinDate] = useState('');
  const editFileRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Salesman');
  const [nid, setNid] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [salary, setSalary] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStaffs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('staffs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch staffs error:', error); return; }
    setStaffs((data || []).map((s: any) => ({
      id: s.id, name: s.name, phone: s.phone, role: s.role,
      salary: Number(s.salary), joinDate: s.join_date, status: s.status as 'active' | 'inactive',
      nid: s.nid || '', photoUrl: s.photo_url || '',
      fatherName: s.father_name || '', motherName: s.mother_name || '',
      email: s.email || '', address: s.address || '',
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchStaffs(); }, [fetchStaffs]);

  const resetForm = () => {
    setName(''); setDesignation('Salesman'); setNid(''); setPhoto(null); setPhotoPreview('');
    setFatherName(''); setMotherName(''); setMobile(''); setEmail('');
    setAddress(''); setSalary(''); setJoinDate(new Date().toISOString().split('T')[0]);
    setEditingStaff(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `staff-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) { console.error('Upload error:', error); return ''; }
    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!name.trim() || !user) { toast.error('নাম দিন'); return; }

    let photoUrl = '';
    if (photo) {
      photoUrl = await uploadPhoto(photo);
    }

    const { error } = await supabase.from('staffs').insert({
      user_id: user.id, name: name.trim(), role: designation, phone: mobile,
      salary: parseFloat(salary) || 0, status: 'active',
      nid, photo_url: photoUrl, father_name: fatherName, mother_name: motherName,
      email, address, join_date: joinDate,
    } as any);
    if (error) { toast.error('Failed to add staff'); return; }
    toast.success('Staff added');
    resetForm();
    fetchStaffs();
  };

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setEditName(s.name); setEditDesignation(s.role); setEditNid(s.nid);
    setEditFatherName(s.fatherName); setEditMotherName(s.motherName);
    setEditMobile(s.phone); setEditEmail(s.email); setEditAddress(s.address);
    setEditSalary(String(s.salary || '')); setEditJoinDate(s.joinDate?.split('T')[0] || '');
    setEditPhotoPreview(s.photoUrl || ''); setEditPhoto(null);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editName.trim() || !user || !editingStaff) return;
    let photoUrl = editingStaff.photoUrl || '';
    if (editPhoto) { photoUrl = await uploadPhoto(editPhoto); }
    const { error } = await supabase.from('staffs').update({
      name: editName.trim(), role: editDesignation, phone: editMobile, salary: parseFloat(editSalary) || 0,
      nid: editNid, photo_url: photoUrl, father_name: editFatherName, mother_name: editMotherName,
      email: editEmail, address: editAddress, join_date: editJoinDate,
    } as any).eq('id', editingStaff.id);
    if (error) { toast.error('Failed to update staff'); return; }
    toast.success('Staff updated');
    setShowEditModal(false); setEditingStaff(null);
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
    await supabase.from('staffs').delete().eq('id', id);
    toast.success('Staff deleted');
    setShowDeleteConfirm(null);
    fetchStaffs();
  };

  const inputClass = "w-full border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring bg-background text-foreground";
  const labelClass = "block text-sm font-bold text-primary mb-1";

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header with tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-primary font-bold">Staff Profile</span>
            <span className="text-muted-foreground">›</span>
            <span className="font-semibold text-foreground">{activeTab === 'list' ? "Staff's List" : 'Add Staff'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('add'); resetForm(); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border transition-colors ${
                activeTab === 'add'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Add Staff
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border transition-colors ${
                activeTab === 'list'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">list</span>
              Staff's List
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {activeTab === 'add' && (
          <div className="p-5 space-y-5">
            {/* Row 1: Name, Designation, NID, Photo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Staff name" />
              </div>
              <div>
                <label className={labelClass}>Designation</label>
                <select value={designation} onChange={e => setDesignation(e.target.value)} className={inputClass}>
                  <option>Salesman</option>
                  <option>Manager</option>
                  <option>Delivery</option>
                  <option>Labour</option>
                  <option>Accountant</option>
                  <option>Cashier</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>NID</label>
                <input value={nid} onChange={e => setNid(e.target.value)} className={inputClass} placeholder="NID Number" />
              </div>
              <div>
                <label className={labelClass}>Photo</label>
                <div className="flex items-center gap-2">
                  {photoPreview && (
                    <img src={photoPreview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-border" />
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange}
                    className="w-full text-sm text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80" />
                </div>
              </div>
            </div>

            {/* Row 2: Father, Mother, Mobile, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Father's Name</label>
                <input value={fatherName} onChange={e => setFatherName(e.target.value)} className={inputClass} placeholder="Father's name" />
              </div>
              <div>
                <label className={labelClass}>Mother's Name</label>
                <input value={motherName} onChange={e => setMotherName(e.target.value)} className={inputClass} placeholder="Mother's name" />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input value={mobile} onChange={e => setMobile(e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" />
              </div>
            </div>

            {/* Row 3: Address (wide), Salary, Joining Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className={labelClass}>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Full address" />
              </div>
              <div>
                <label className={labelClass}>Salary</label>
                <input type="number" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value)} className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>Joining Date</label>
                <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave}
                className="px-6 py-2.5 bg-[hsl(142,70%,40%)] text-white rounded-lg text-sm font-bold hover:bg-[hsl(142,70%,35%)] transition-colors">
                Save
              </button>
              <button onClick={resetForm}
                className="px-6 py-2.5 bg-muted-foreground/80 text-white rounded-lg text-sm font-bold hover:bg-muted-foreground/70 transition-colors">
                Reset
              </button>
            </div>

            {/* Recent Staff Table */}
            {staffs.length > 0 && (
              <div className="mt-6 border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                  <h4 className="text-sm font-bold text-foreground">Recently Added</h4>
                  <button onClick={() => setActiveTab('list')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase">
                      <th className="text-center py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Name</th>
                      <th className="text-left py-2 px-3">Designation</th>
                      <th className="text-left py-2 px-3">Mobile</th>
                      <th className="text-right py-2 px-3">Salary</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffs.slice(0, 5).map((s, i) => (
                      <tr key={s.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors text-sm">
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{s.name}</td>
                        <td className="py-2 px-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.role}</span></td>
                        <td className="py-2 px-3 text-muted-foreground">{s.phone || '-'}</td>
                        <td className="py-2 px-3 text-right font-bold">৳{s.salary.toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            s.status === 'active' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)]' : 'bg-muted text-muted-foreground'
                          }`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Staff List */}
        {activeTab === 'list' && (
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : staffs.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-5xl text-muted-foreground/30 mb-3">badge</span>
                <p className="text-muted-foreground text-sm">No staff members added yet</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Click "Add Staff" to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase">
                      <th className="text-center py-3 px-3">#</th>
                      <th className="text-left py-3 px-3">Photo</th>
                      <th className="text-left py-3 px-3">Name</th>
                      <th className="text-left py-3 px-3">Designation</th>
                      <th className="text-left py-3 px-3">Mobile</th>
                      <th className="text-left py-3 px-3">NID</th>
                      <th className="text-right py-3 px-3">Salary</th>
                      <th className="text-center py-3 px-3">Status</th>
                      <th className="text-center py-3 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffs.map((s, i) => (
                      <tr key={s.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-3 px-3">
                          {s.photoUrl ? (
                            <img src={s.photoUrl} alt={s.name} className="w-9 h-9 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">{s.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-sm font-semibold text-foreground">{s.name}</div>
                          {s.fatherName && <div className="text-[10px] text-muted-foreground">F: {s.fatherName}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">{s.role}</span>
                        </td>
                        <td className="py-3 px-3 text-sm text-muted-foreground">{s.phone || '-'}</td>
                        <td className="py-3 px-3 text-sm text-muted-foreground">{s.nid || '-'}</td>
                        <td className="py-3 px-3 text-sm font-bold text-right">৳{s.salary.toLocaleString()}</td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => toggleStatus(s.id)}
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              s.status === 'active' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)]' : 'bg-muted text-muted-foreground'
                            }`}>
                            {s.status}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEdit(s)} className="text-primary hover:text-primary/80 p-1" title="Edit">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => setShowDeleteConfirm(s.id)} className="text-destructive hover:text-destructive/80 p-1" title="Delete">
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-card rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30 rounded-t-xl">
              <h3 className="text-base font-bold text-foreground">Edit Staff — {editingStaff.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Name *</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Designation</label>
                  <select value={editDesignation} onChange={e => setEditDesignation(e.target.value)} className={inputClass}>
                    <option>Salesman</option><option>Manager</option><option>Delivery</option>
                    <option>Labour</option><option>Accountant</option><option>Cashier</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>NID</label>
                  <input value={editNid} onChange={e => setEditNid(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Photo</label>
                  <div className="flex items-center gap-2">
                    {editPhotoPreview && <img src={editPhotoPreview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-border" />}
                    <input ref={editFileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setEditPhoto(f); setEditPhotoPreview(URL.createObjectURL(f)); } }}
                      className="w-full text-sm text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-sm file:font-semibold file:bg-muted file:text-foreground" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Father's Name</label>
                  <input value={editFatherName} onChange={e => setEditFatherName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mother's Name</label>
                  <input value={editMotherName} onChange={e => setEditMotherName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mobile</label>
                  <input value={editMobile} onChange={e => setEditMobile(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Address</label>
                  <input value={editAddress} onChange={e => setEditAddress(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Salary</label>
                  <input type="number" value={editSalary} onChange={e => setEditSalary(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Joining Date</label>
                  <input type="date" value={editJoinDate} onChange={e => setEditJoinDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleEditSave} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">Update</button>
                <button onClick={() => setShowEditModal(false)} className="px-6 py-2.5 bg-muted text-foreground rounded-lg text-sm font-bold hover:bg-muted/80 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-card rounded-xl w-[350px] shadow-2xl p-7 text-center" onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-destructive mb-3">warning</span>
            <h3 className="text-lg font-bold mb-2">Delete Staff?</h3>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={() => deleteStaff(showDeleteConfirm)} className="flex-1 py-2.5 bg-destructive text-white rounded-lg font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
