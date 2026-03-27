const headings: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  sales: 'Sales / POS',
  inventory: 'Inventory',
  customers: 'Customers',
  reports: 'Reports',
};

interface HeaderProps {
  activeScreen: string;
}

export default function Header({ activeScreen }: HeaderProps) {
  return (
    <header className="flex justify-between items-center w-full px-8 h-16 sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-8">
        <span className="text-xl font-black text-slate-900">{headings[activeScreen] || 'Dashboard'}</span>
        <div className="relative w-64">
          <input
            className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-10 focus:ring-2 focus:ring-pos-secondary transition-all outline-none"
            placeholder="Search..."
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-lg">search</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 bg-pos-error-container text-pos-on-error-container rounded-full text-[10px] font-bold flex items-center gap-1" style={{ animation: 'pulse-badge 2s infinite' }}>
          <span className="material-symbols-outlined text-sm">warning</span> 3 Low Stock
        </span>
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
