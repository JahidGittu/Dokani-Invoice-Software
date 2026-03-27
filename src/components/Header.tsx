import { useState } from "react";
import { type Product, getLowStockProducts } from "@/lib/store";

const headings: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  sales: 'Sales / POS',
  inventory: 'Inventory',
  customers: 'Customers',
  reports: 'Reports',
  settings: 'Settings',
};

interface HeaderProps {
  activeScreen: string;
  onToggleSidebar: () => void;
  onNavigate: (screen: string) => void;
  onSearch: (query: string) => void;
  products: Product[];
}

export default function Header({ activeScreen, onToggleSidebar, onNavigate, onSearch, products }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const lowStock = getLowStockProducts(products);

  const searchResults = searchQuery.length >= 2 ? [
    ...products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(p => ({
      type: 'product' as const, label: p.name, sub: `${p.size} · ${p.finish}`, screen: 'products',
    })),
    ...(headings[searchQuery.toLowerCase()] ? [{ type: 'screen' as const, label: headings[searchQuery.toLowerCase()]!, sub: 'Screen', screen: searchQuery.toLowerCase() }] : []),
    ...Object.entries(headings).filter(([, v]) => v.toLowerCase().includes(searchQuery.toLowerCase())).map(([k, v]) => ({
      type: 'screen' as const, label: v, sub: 'Navigate', screen: k,
    })).slice(0, 2),
  ] : [];

  return (
    <header className="flex justify-between items-center w-full px-4 lg:px-8 h-16 sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-4 lg:gap-8">
        <button className="lg:hidden p-2 text-slate-500 hover:text-slate-900" onClick={onToggleSidebar}>
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="text-xl font-black text-slate-900">{headings[activeScreen] || 'Dashboard'}</span>
        <div className="relative w-48 lg:w-64 hidden sm:block">
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-10 focus:ring-2 focus:ring-pos-secondary transition-all outline-none"
            placeholder="Search products, screens..."
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-lg">search</span>
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-pos-surface-lowest border border-pos-surface-container rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-pos-surface-high transition-colors flex items-center gap-3"
                  onMouseDown={() => {
                    onNavigate(r.screen);
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                >
                  <span className="material-symbols-outlined text-pos-secondary text-sm">
                    {r.type === 'product' ? 'inventory_2' : 'open_in_new'}
                  </span>
                  <div>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-[10px] text-pos-on-surface-variant">{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {lowStock.length > 0 && (
          <button onClick={() => onNavigate('inventory')} className="px-2.5 py-1 bg-pos-error-container text-pos-on-error-container rounded-full text-[10px] font-bold flex items-center gap-1" style={{ animation: 'pulse-badge 2s infinite' }}>
            <span className="material-symbols-outlined text-sm">warning</span> {lowStock.length} Low Stock
          </button>
        )}
        <button className="p-2 text-slate-500 hover:text-pos-secondary transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-pos-secondary-container flex items-center justify-center">
          <span className="text-xs font-bold text-pos-on-secondary-container">AR</span>
        </div>
      </div>
    </header>
  );
}
