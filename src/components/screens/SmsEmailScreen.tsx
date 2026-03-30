import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { type Customer } from "@/lib/store";
import { toast } from "sonner";
import InfoTooltip from "@/components/InfoTooltip";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'supplier' | 'staff';
}

interface SmsEmailScreenProps {
  customers: Customer[];
  suppliers?: { id: string; name: string; phone: string }[];
  staffs?: { id: string; name: string; phone: string }[];
}

export default function SmsEmailScreen({ customers, suppliers = [], staffs = [] }: SmsEmailScreenProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'sms' | 'email'>('sms');
  const [recipientType, setRecipientType] = useState<'customer' | 'supplier' | 'staff'>('customer');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');

  const allContacts: Contact[] = recipientType === 'customer'
    ? customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, type: 'customer' as const }))
    : recipientType === 'supplier'
    ? suppliers.map(s => ({ id: s.id, name: s.name, phone: s.phone, type: 'supplier' as const }))
    : staffs.map(s => ({ id: s.id, name: s.name, phone: s.phone, type: 'staff' as const }));

  const filtered = allContacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const toggleCustomer = (id: string) => {
    setSelectedCustomers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedCustomers(prev => prev.length === filtered.length ? [] : filtered.map(c => c.id));
  };

  const handleSend = () => {
    if (!selectedCustomers.length) { toast.error('Select at least one recipient'); return; }
    if (!message.trim()) { toast.error('Enter a message'); return; }

    if (tab === 'sms') {
      const selected = allContacts.filter(c => selectedCustomers.includes(c.id) && c.phone);
      if (!selected.length) { toast.error('Selected contacts have no phone numbers'); return; }
      selected.forEach(c => {
        const phone = c.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      });
      toast.success(`Opened WhatsApp for ${selected.length} contact(s)`);
    } else {
      toast.info('Email feature coming soon!');
    }

    setMessage('');
    setSubject('');
    setSelectedCustomers([]);
  };

  const recipientLabel = recipientType === 'customer' ? 'Customers' : recipientType === 'supplier' ? 'Suppliers' : 'Staffs';

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">campaign</span>
          SMS & Email
        </h2>
        <InfoTooltip text="কাস্টমার, সাপ্লায়ার বা স্টাফদের WhatsApp/Email এ মেসেজ পাঠান" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {/* Recipient Type */}
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { key: 'customer' as const, label: '👥 Customers', count: customers.length },
            { key: 'supplier' as const, label: '🏭 Suppliers', count: suppliers.length },
            { key: 'staff' as const, label: '👷 Staffs', count: staffs.length },
          ]).map(({ key, label, count }) => (
            <button key={key} onClick={() => { setRecipientType(key); setSelectedCustomers([]); setSearch(''); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${recipientType === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Channel */}
        <div className="flex bg-muted rounded-xl p-1">
          <button onClick={() => setTab('sms')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === 'sms' ? 'bg-[hsl(142,70%,35%)] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <span className="material-symbols-outlined text-sm">chat</span>WhatsApp
          </button>
          <button onClick={() => setTab('email')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === 'email' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <span className="material-symbols-outlined text-sm">mail</span>Email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Contact Selection — 2 cols */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Select {recipientLabel}
              <span className="text-xs font-normal text-muted-foreground">({selectedCustomers.length}/{filtered.length})</span>
            </h3>
            <button onClick={selectAll} className="text-xs text-primary font-semibold hover:underline">
              {selectedCustomers.length === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm py-2 pl-9 pr-3 outline-none placeholder:text-muted-foreground/50"
                placeholder={`Search ${recipientLabel.toLowerCase()}...`} />
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <span className="material-symbols-outlined text-3xl block mb-2">person_off</span>
                <span className="text-sm">No {recipientLabel.toLowerCase()} found</span>
              </div>
            ) : filtered.map(c => (
              <label key={c.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border/20 cursor-pointer hover:bg-muted/30 transition-colors ${
                  selectedCustomers.includes(c.id) ? 'bg-primary/5' : ''
                }`}>
                <input type="checkbox" checked={selectedCustomers.includes(c.id)}
                  onChange={() => toggleCustomer(c.id)}
                  className="w-4 h-4 rounded border-border accent-primary shrink-0" />
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.phone || 'No phone'}</div>
                </div>
                {selectedCustomers.includes(c.id) && (
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Right: Message Composer — 3 cols */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">edit_note</span>
            Compose Message
          </h3>

          {tab === 'email' && (
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring transition-shadow"
                placeholder="Email subject..." />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7}
              className="w-full bg-muted/50 border border-border rounded-xl text-sm py-3 px-3 outline-none resize-none focus:ring-2 focus:ring-ring transition-shadow"
              placeholder={tab === 'sms' ? 'Type your WhatsApp message here...' : 'Type your email body here...'} />
            <div className="text-right text-[10px] text-muted-foreground mt-1">{message.length} characters</div>
          </div>

          {/* Quick Templates */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase mb-2">
              Quick Templates <InfoTooltip text="রেডিমেড মেসেজ টেমপ্লেট, ক্লিক করলে মেসেজ বক্সে চলে যাবে" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { label: '💰 Payment Reminder', text: 'প্রিয় গ্রাহক, আপনার বকেয়া পরিশোধ করুন। ধন্যবাদ।', icon: 'payments' },
                { label: '📦 New Stock Alert', text: 'নতুন মাল এসেছে! দেখে যান আমাদের দোকানে।', icon: 'inventory_2' },
                { label: '🙏 Thank You', text: 'ধন্যবাদ আমাদের থেকে কেনাকাটা করার জন্য। আবার আসবেন।', icon: 'favorite' },
              ].map(tmpl => (
                <button key={tmpl.label} onClick={() => setMessage(tmpl.text)}
                  className="px-3 py-2.5 bg-muted rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors text-left">
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {message && selectedCustomers.length > 0 && (
            <div className="bg-muted/30 border border-border/50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Preview</div>
              <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{message}</div>
              <div className="text-[10px] text-muted-foreground mt-2">→ Will be sent to {selectedCustomers.length} {recipientLabel.toLowerCase()}</div>
            </div>
          )}

          <button onClick={handleSend}
            disabled={!selectedCustomers.length || !message.trim()}
            className="w-full py-3.5 bg-[hsl(142,70%,35%)] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
            <span className="material-symbols-outlined text-lg">{tab === 'sms' ? 'send' : 'mail'}</span>
            {tab === 'sms' ? `Send via WhatsApp (${selectedCustomers.length})` : `Send Email (${selectedCustomers.length})`}
          </button>
        </div>
      </div>
    </section>
  );
}
