import { useState, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { type Product, type SaleRecord, type Customer, getLowStockProducts } from "@/lib/store";

interface AdminMsg {
  id: string;
  subject: string;
  message: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}
interface HeaderProps {
  activeScreen: string;
  onToggleSidebar: () => void;
  onNavigate: (screen: string) => void;
  onSearch: (query: string) => void;
  products: Product[];
  sales?: SaleRecord[];
  customers?: Customer[];
  userName?: string;
  shopName?: string;
}

type DropdownId = 'info' | 'settings' | 'lang' | 'profile' | 'messages' | null;

export default function Header({ activeScreen, onToggleSidebar, onNavigate, onSearch, products, sales = [], customers = [], userName = 'AR', shopName = 'Dokani' }: HeaderProps) {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);
  const initials = (userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const [messages, setMessages] = useState<AdminMsg[]>([]);
  const unreadCount = messages.filter(m => !m.is_read).length;

  const debouncedQuery = useDebounce(searchQuery, 250);

  // Load admin messages for current user
  useEffect(() => {
    if (!user) return;
    const loadMessages = async () => {
      const { data } = await supabase.from('admin_messages').select('*')
        .eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (data) setMessages(data as any);
    };
    loadMessages();
    const interval = setInterval(loadMessages, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDropdown = (id: DropdownId) => {
    setOpenDropdown(prev => prev === id ? null : id);
  };

  const searchResults = useMemo(() => {
    if (debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return [
      ...products.filter(p => p.name.toLowerCase().includes(q) || p.batch.toLowerCase().includes(q)).slice(0, 3).map(p => ({
        label: `${p.name} — ৳${p.pricePerBox}`, sub: `${p.size} · ${p.finish}`, screen: 'products', icon: 'inventory_2',
      })),
      ...sales.filter(s => s.customer.toLowerCase().includes(q) || s.invoice.toLowerCase().includes(q)).slice(0, 3).map(s => ({
        label: `${s.invoice} · ${s.customer}`, sub: `৳${s.total.toLocaleString()}`, screen: 'sales', icon: 'receipt',
      })),
      ...customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))).slice(0, 2).map(c => ({
        label: `${c.name}${c.phone ? ' · ' + c.phone : ''}`, sub: t('customer'), screen: 'customers', icon: 'person',
      })),
    ];
  }, [debouncedQuery, products, sales, customers, t]);

  const DropdownButton = ({ id, icon, label, children }: { id: DropdownId; icon: string; label: string; children: React.ReactNode }) => (
    <div className="relative">
      <button
        onClick={() => toggleDropdown(id)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm font-medium"
      >
        <span className="material-symbols-outlined text-lg">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
        <span className="material-symbols-outlined text-sm">
          {openDropdown === id ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {openDropdown === id && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 min-w-[180px] py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );

  const DropdownItem = ({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick(); setOpenDropdown(null); }}
      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {label}
    </button>
  );

  return (
    <header ref={dropdownRef} className="flex justify-between items-center w-full px-4 lg:px-6 h-14 sticky top-0 z-40 bg-gray-900 dark:bg-gray-950 shadow-lg">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-2 text-gray-400 hover:text-white" onClick={onToggleSidebar}>
          <span className="material-symbols-outlined">menu</span>
        </button>
        {/* Global search */}
        <div className="relative w-44 lg:w-72 hidden sm:block">
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full bg-white/10 border border-white/10 rounded-lg text-xs text-white py-2 pl-9 pr-3 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white/15 transition-all outline-none"
            placeholder={t('searchPlaceholder')}
            type="text"
            id="global-search"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-lg">search</span>
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                  onMouseDown={() => { onNavigate(r.screen); setSearchQuery(''); setShowResults(false); }}
                >
                  <span className="material-symbols-outlined text-gray-400 text-base">{r.icon}</span>
                  <div>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-[10px] text-gray-400">{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Info, Settings, Language, Shop Profile */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <button onClick={() => { onNavigate('inventory'); setOpenDropdown(null); }} className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold flex items-center gap-1 mr-1">
            <span className="material-symbols-outlined text-sm">warning</span> {lowStock.length}
          </button>
        )}

        {/* Messages Notification */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('messages')}
            className="relative flex items-center gap-1 px-2 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <span className="material-symbols-outlined text-lg">mail</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center min-w-[18px] h-[18px]">
                {unreadCount}
              </span>
            )}
          </button>
          {openDropdown === 'messages' && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 w-[320px] max-h-[400px] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {lang === 'bn' ? 'বার্তা' : 'Messages'}
                  {unreadCount > 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto max-h-[340px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <span className="material-symbols-outlined text-3xl mb-2 block">inbox</span>
                    {lang === 'bn' ? 'কোনো বার্তা নেই' : 'No messages'}
                  </div>
                ) : messages.map(m => (
                  <button key={m.id} className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!m.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    onClick={async () => {
                      if (!m.is_read) {
                        await supabase.from('admin_messages').update({ is_read: true } as any).eq('id', m.id);
                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, is_read: true } : msg));
                      }
                    }}>
                    <div className="flex items-start gap-2">
                      <span className={`material-symbols-outlined text-lg mt-0.5 ${
                        m.message_type === 'license_warning' ? 'text-orange-500' :
                        m.message_type === 'payment_reminder' ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {m.message_type === 'license_warning' ? 'warning' : m.message_type === 'payment_reminder' ? 'payments' : 'mail'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold truncate ${!m.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{m.subject || 'Message'}</p>
                          {!m.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-1" />}
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{m.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Dropdown */}
        <DropdownButton id="info" icon="info" label={lang === 'bn' ? 'তথ্য' : 'Info'}>
          <DropdownItem icon="dashboard" label={lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'} onClick={() => onNavigate('dashboard')} />
          <DropdownItem icon="bar_chart" label={lang === 'bn' ? 'রিপোর্ট' : 'Reports'} onClick={() => onNavigate('reports')} />
          <DropdownItem icon="inventory_2" label={lang === 'bn' ? 'মজুদ' : 'Inventory'} onClick={() => onNavigate('inventory')} />
          <DropdownItem icon="help" label={lang === 'bn' ? 'সাহায্য' : 'Help'} onClick={() => {}} />
        </DropdownButton>

        {/* Settings Dropdown */}
        <DropdownButton id="settings" icon="tune" label={lang === 'bn' ? 'সেটিংস' : 'Settings'}>
          <DropdownItem icon="settings" label={lang === 'bn' ? 'সাধারণ সেটিংস' : 'General Settings'} onClick={() => onNavigate('settings')} />
          <DropdownItem icon="receipt_long" label={lang === 'bn' ? 'ইনভয়েস সেটিংস' : 'Invoice Settings'} onClick={() => onNavigate('settings')} />
          <DropdownItem icon="backup" label={lang === 'bn' ? 'ব্যাকআপ' : 'Backup'} onClick={() => onNavigate('settings')} />
          <DropdownItem icon="admin_panel_settings" label={lang === 'bn' ? 'সিস্টেম অ্যাডমিন' : 'System Admin'} onClick={() => onNavigate('admin')} />
        </DropdownButton>

        {/* Language Dropdown */}
        <DropdownButton id="lang" icon="translate" label={lang === 'bn' ? 'ভাষা' : 'Lang'}>
          <DropdownItem
            icon={lang === 'en' ? 'radio_button_checked' : 'radio_button_unchecked'}
            label="English"
            onClick={() => setLang('en')}
          />
          <DropdownItem
            icon={lang === 'bn' ? 'radio_button_checked' : 'radio_button_unchecked'}
            label="বাংলা"
            onClick={() => setLang('bn')}
          />
        </DropdownButton>

        {/* Divider */}
        <div className="w-px h-7 bg-white/15 mx-1 hidden sm:block" />

        {/* Shop/Profile Dropdown */}
        <DropdownButton id="profile" icon="storefront" label={shopName || 'Dokani'}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{shopName}</p>
            <p className="text-xs text-gray-500">{userName}</p>
          </div>
          <DropdownItem icon="person" label={lang === 'bn' ? 'প্রোফাইল' : 'Profile'} onClick={() => onNavigate('settings')} />
          <DropdownItem icon="manage_accounts" label={lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account'} onClick={() => onNavigate('settings')} />
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <DropdownItem icon="logout" label={lang === 'bn' ? 'লগআউট' : 'Logout'} onClick={signOut} danger />
          </div>
        </DropdownButton>
      </div>
    </header>
  );
}
