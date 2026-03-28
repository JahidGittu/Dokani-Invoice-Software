import { cn } from "@/lib/utils";
import { type Product, getLowStockProducts } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";

interface NavItem {
  id: string;
  icon: string;
  labelKey: string;
  badge?: 'lowStock';
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const topItems: NavItem[] = [
  { id: 'dashboard', icon: 'dashboard', labelKey: 'dashboard' },
  { id: 'new-sale', icon: 'add_shopping_cart', labelKey: 'newSaleEntry' },
];

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    defaultOpen: true,
    items: [
      { id: 'products', icon: 'inventory_2', labelKey: 'products' },
      { id: 'purchases', icon: 'shopping_cart', labelKey: 'purchases' },
      { id: 'sales', icon: 'point_of_sale', labelKey: 'salesPOS' },
      { id: 'inventory', icon: 'layers', labelKey: 'inventory', badge: 'lowStock' },
    ],
  },
  {
    label: 'Accounts',
    defaultOpen: true,
    items: [
      { id: 'customers', icon: 'group', labelKey: 'customers' },
      { id: 'suppliers', icon: 'local_shipping', labelKey: 'suppliers' },
      { id: 'staffs', icon: 'badge', labelKey: 'staffs' },
    ],
  },
  {
    label: 'Misc',
    defaultOpen: false,
    items: [
      { id: 'transactions', icon: 'swap_horiz', labelKey: 'transactions' },
      { id: 'reports', icon: 'assessment', labelKey: 'reports' },
      { id: 'sms-email', icon: 'mail', labelKey: 'smsEmail' },
    ],
  },
];

const footerItems: NavItem[] = [
  { id: 'admin', icon: 'admin_panel_settings', labelKey: 'adminPanel' },
  { id: 'excel', icon: 'file_upload', labelKey: 'excelImport' },
  { id: 'settings', icon: 'settings', labelKey: 'settings' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ activeScreen, onNavigate, isOpen, onClose, products, userName = 'Arif Rahman', userRole = 'System Admin' }: SidebarProps) {
  const { t } = useI18n();
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);
  const initials = (userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Track open/closed groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach(g => { initial[g.label] = g.defaultOpen ?? true; });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNav = (id: string) => {
    onNavigate(id);
    onClose();
  };

  const renderNavButton = (item: NavItem) => (
    <button
      key={item.id}
      onClick={() => handleNav(item.id)}
      className={cn(
        "w-full flex items-center px-4 py-3 rounded-xl transition-all duration-150 cursor-pointer text-left gap-3",
        activeScreen === item.id
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className={cn("material-symbols-outlined text-2xl", activeScreen === item.id && "text-primary")}>{item.icon}</span>
      <span className="text-sm font-medium">{t(item.labelKey as any)}</span>
      {item.badge === 'lowStock' && lowStock.length > 0 && (
        <span className="ml-auto px-2 py-0.5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold">{lowStock.length}</span>
      )}
    </button>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 flex flex-col bg-card border-r border-border z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* ── Brand Header ── */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-foreground text-lg">grid_view</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">Dokani</h1>
              <p className="text-[10px] text-muted-foreground">Business Edition</p>
            </div>
          </div>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Scrollable Nav ── */}
        <nav className="flex-1 px-3 pt-3 overflow-y-auto space-y-1">
          {/* Top: Dashboard & New Sale */}
          <div className="space-y-0.5 mb-2">
            {topItems.map(renderNavButton)}
          </div>

          {/* Grouped sections */}
          {navGroups.map(group => {
            const isOpen = openGroups[group.label] ?? true;
            const hasActive = group.items.some(i => i.id === activeScreen);
            return (
              <div key={group.label} className="pt-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{group.label}</span>
                  <span className={cn("material-symbols-outlined text-sm transition-transform", isOpen && "rotate-180")}>
                    expand_more
                  </span>
                </button>
                {(isOpen || hasActive) && (
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map(renderNavButton)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer: Profile & Settings ── */}
        <div className="px-3 pb-3 pt-2 border-t border-border space-y-0.5">
          {footerItems.map(renderNavButton)}

          {/* Profile */}
          <div className="flex items-center px-3 py-3 gap-3 mt-1 rounded-lg bg-muted/50">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{userName}</div>
              <div className="text-[10px] text-muted-foreground">{userRole}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
