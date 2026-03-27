import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { type Customer } from "@/lib/store";
import { toast } from "sonner";

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
    if (selectedCustomers.length === filtered.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filtered.map(c => c.id));
    }
  };

  const handleSend = () => {
    if (!selectedCustomers.length) { toast.error('Select at least one customer'); return; }
    if (!message.trim()) { toast.error('Enter a message'); return; }

    if (tab === 'sms') {
      const selected = allContacts.filter(c => selectedCustomers.includes(c.id) && c.phone);
      if (!selected.length) { toast.error('Selected contacts have no phone numbers'); return; }
      selected.forEach(c => {
        const phone = c.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      });
      toast.success(`Opened WhatsApp for ${selected.length} customer(s)`);
    } else {
      toast.info('Email feature coming soon! Configure SMTP in settings.');
    }

    setMessage('');
    setSubject('');
    setSelectedCustomers([]);
  };

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">SMS & Email</h2>
      </div>

      {/* Tab Switcher */}
      {/* Recipient Type */}
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-muted rounded-lg p-0.5">
          {(['customer', 'supplier', 'staff'] as const).map(type => (
            <button key={type} onClick={() => { setRecipientType(type); setSelectedCustomers([]); }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${recipientType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {type === 'customer' ? '👥 Customers' : type === 'supplier' ? '🏭 Suppliers' : '👷 Staffs'}
            </button>
          ))}
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button onClick={() => setTab('sms')}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${tab === 'sms' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <span className="material-symbols-outlined text-lg">sms</span>SMS / WhatsApp
          </button>
          <button onClick={() => setTab('email')}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${tab === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <span className="material-symbols-outlined text-lg">mail</span>Email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Customer Selection */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Select Recipients ({selectedCustomers.length})</h3>
            <button onClick={selectAll} className="text-xs text-primary font-semibold hover:underline">
              {selectedCustomers.length === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm py-2 pl-9 pr-3 outline-none placeholder:text-muted-foreground/50"
                placeholder="Search customers..." />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No customers found</div>
            ) : filtered.map(c => (
              <label key={c.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors ${
                  selectedCustomers.includes(c.id) ? 'bg-primary/5' : ''
                }`}>
                <input type="checkbox" checked={selectedCustomers.includes(c.id)}
                  onChange={() => toggleCustomer(c.id)}
                  className="w-4 h-4 rounded border-border accent-primary" />
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.phone || 'No phone'}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Right: Message Composer */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">Compose Message</h3>

          {tab === 'email' && (
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Email subject..." />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8}
              className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 px-3 outline-none resize-none focus:ring-2 focus:ring-ring"
              placeholder={tab === 'sms' ? 'Type your WhatsApp message here...' : 'Type your email body here...'} />
          </div>

          {/* Quick Templates */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-2">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Payment Reminder', text: 'প্রিয় গ্রাহক, আপনার বকেয়া পরিশোধ করুন। ধন্যবাদ।' },
                { label: 'New Stock', text: 'নতুন মাল এসেছে! দেখে যান আমাদের দোকানে।' },
                { label: 'Thank You', text: 'ধন্যবাদ আমাদের থেকে কেনাকাটা করার জন্য। আবার আসবেন।' },
              ].map(tmpl => (
                <button key={tmpl.label} onClick={() => setMessage(tmpl.text)}
                  className="px-3 py-1.5 bg-muted rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSend}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-lg">{tab === 'sms' ? 'send' : 'mail'}</span>
            {tab === 'sms' ? `Send via WhatsApp (${selectedCustomers.length})` : `Send Email (${selectedCustomers.length})`}
          </button>
        </div>
      </div>
    </section>
  );
}
