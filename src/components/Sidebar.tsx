import { cn } from "@/lib/utils";
import { type Product, getLowStockProducts } from "@/lib/store";

const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'products', icon: 'inventory_2', label: 'Products' },
  { id: 'sales', icon: 'point_of_sale', label: 'Sales / POS' },
  { id: 'inventory', icon: 'layers', label: 'Inventory' },
  { id: 'customers', icon: 'group', label: 'Customers' },
  { id: 'reports', icon: 'assessment', label: 'Reports' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export default function Sidebar({ activeScreen, onNavigate, isOpen, onClose, products }: SidebarProps) {
  const lowStock = getLowStockProducts(products);

  return (
    <>
      {/* Mobile overlay */}
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

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => (
            <a
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
              className={cn(
                "flex items-center px-4 py-3 border-l-[3px] border-transparent hover:bg-slate-200 transition-all duration-150 cursor-pointer",
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
            </a>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-pos-surface-container pt-3">
          <div className="flex items-center px-4 py-3 gap-3">
            <div className="w-8 h-8 rounded-full bg-pos-secondary-container flex items-center justify-center">
              <span className="text-xs font-bold text-pos-on-secondary-container">AR</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-pos-on-surface">Arif Rahman</div>
              <div className="text-[10px] text-pos-on-surface-variant">Administrator</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
