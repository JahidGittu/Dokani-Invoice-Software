import { cn } from "@/lib/utils";
import { type Product, getLowStockProducts } from "@/lib/store";
import { useMemo } from "react";

const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'products', icon: 'inventory_2', label: 'Products' },
  { id: 'sales', icon: 'point_of_sale', label: 'Sales / POS' },
  { id: 'new-sale', icon: 'receipt_long', label: 'New Sale Entry' },
  { id: 'inventory', icon: 'layers', label: 'Inventory' },
  { id: 'customers', icon: 'group', label: 'Customers' },
  { id: 'reports', icon: 'assessment', label: 'Reports' },
  { id: 'excel', icon: 'file_upload', label: 'Excel Import' },
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

export default function Sidebar({ activeScreen, onNavigate, isOpen, onClose, products, userName = 'Arif Rahman', userRole = 'Administrator' }: SidebarProps) {
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);
  const initials = (userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 flex flex-col bg-slate-100 tracking-tight text-sm font-medium border-r border-pos-surface-container z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-pos-secondary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-base">grid_view</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tighter text-slate-900">TilePOS</h1>
              <p className="text-[10px] text-pos-on-surface-variant">Lite Edition · Offline</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
              className={cn(
                "w-full flex items-center px-4 py-3 border-l-[3px] border-transparent hover:bg-slate-200 transition-all duration-150 cursor-pointer text-left",
                activeScreen === item.id
                  ? "border-l-pos-secondary bg-pos-surface-high text-slate-900 font-semibold"
                  : "text-slate-500"
              )}
            >
              <span className={cn("material-symbols-outlined mr-3 text-xl", activeScreen === item.id && "text-pos-secondary")}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.id === 'inventory' && lowStock.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-pos-error text-white rounded-full text-[9px] font-bold">{lowStock.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 space-y-0.5 border-t border-pos-surface-container pt-3">
          <button
            onClick={() => { onNavigate('settings'); onClose(); }}
            className={cn(
              "w-full flex items-center px-4 py-3 border-l-[3px] border-transparent hover:bg-slate-200 transition-all cursor-pointer text-left",
              activeScreen === 'settings' ? "border-l-pos-secondary bg-pos-surface-high text-slate-900 font-semibold" : "text-slate-500"
            )}
          >
            <span className={cn("material-symbols-outlined mr-3 text-xl", activeScreen === 'settings' && "text-pos-secondary")}>settings</span>
            <span>Settings</span>
          </button>
          <div className="flex items-center px-4 py-3 gap-3">
            <div className="w-8 h-8 rounded-full bg-pos-secondary-container flex items-center justify-center">
              <span className="text-xs font-bold text-pos-on-secondary-container">{initials}</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-pos-on-surface">{userName}</div>
              <div className="text-[10px] text-pos-on-surface-variant">{userRole}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
