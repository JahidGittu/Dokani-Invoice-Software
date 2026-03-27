import { cn } from "@/lib/utils";

const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'products', icon: 'inventory_2', label: 'Products' },
  { id: 'sales', icon: 'point_of_sale', label: 'Sales / POS' },
  { id: 'inventory', icon: 'layers', label: 'Inventory' },
  { id: 'customers', icon: 'group', label: 'Customers' },
  { id: 'reports', icon: 'assessment', label: 'Reports' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col bg-slate-100 tracking-tight text-sm font-medium border-r border-pos-surface-container z-50">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-pos-secondary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">grid_view</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tighter text-slate-900">TilePOS</h1>
            <p className="text-[10px] text-pos-on-surface-variant">Lite Edition · Offline</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <a
            key={item.id}
            onClick={() => onNavigate(item.id)}
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
          </a>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-0.5 border-t border-pos-surface-container pt-3">
        <a className="flex items-center px-4 py-3 text-slate-500 border-l-[3px] border-transparent hover:bg-slate-200 transition-all cursor-pointer">
          <span className="material-symbols-outlined mr-3 text-xl">settings</span><span>Settings</span>
        </a>
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
  );
}
