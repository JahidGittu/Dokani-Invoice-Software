import { useState, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type Supplier } from "@/lib/store";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pencil, Trash2, Printer, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface SupplierScreenProps {
  suppliers: Supplier[];
  onAddSupplier: (name: string, phone: string, address: string, contactPerson?: string, openingBalance?: number) => void;
  onDeleteSupplier: (id: string) => void;
  shopName?: string;
  shopAddress?: string;
}

type SortKey = 'name' | 'contactPerson' | 'phone' | 'totalDue';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

export default function SupplierScreen({ suppliers, onAddSupplier, onDeleteSupplier, shopName = '', shopAddress = '' }: SupplierScreenProps) {
  const { t } = useI18n();
  const [view, setView] = useState<'list' | 'add'>('add');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Search, Sort, Pagination
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const printRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Supplier name required'); return; }
    onAddSupplier(name, phone, address, contactPerson, openingBalance ? parseFloat(openingBalance) : 0);
    toast.success(t('supplierAdded'));
    resetForm();
  };

  const resetForm = () => {
    setName(''); setContactPerson(''); setPhone(''); setAddress(''); setOpeningBalance('');
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeleteSupplier(showDeleteConfirm); toast.success(t('supplierDeleted')); }
    setShowDeleteConfirm(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Filtered + sorted suppliers
  const filteredSuppliers = useMemo(() => {
    let list = [...suppliers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortKey === 'totalDue') {
        aVal = a.totalDue || 0;
        bVal = b.totalDue || 0;
      } else {
        aVal = ((a as any)[sortKey] || '').toString().toLowerCase();
        bVal = ((b as any)[sortKey] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [suppliers, search, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE));
  const paginatedSuppliers = filteredSuppliers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when search changes
  useMemo(() => setPage(1), [search]);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'supplier-print-styles';
    style.textContent = `
      @media print {
        body > *:not(#supplier-print-area) { display: none !important; }
        #supplier-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: white; }
        #supplier-print-area * { color: #333 !important; }
        #supplier-print-area .print-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
        #supplier-print-area .print-header h1 { margin: 0; font-size: 22px; font-weight: bold; }
        #supplier-print-area .print-header p { margin: 4px 0 0; font-size: 13px; color: #666 !important; }
        #supplier-print-area .print-header h2 { margin: 16px 0 0; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; }
        #supplier-print-area table { width: 100%; border-collapse: collapse; font-size: 13px; }
        #supplier-print-area th { background: #3f51b5 !important; color: white !important; padding: 8px 10px; text-align: left; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #supplier-print-area td { border: 1px solid #ccc; padding: 6px 10px; }
        #supplier-print-area tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #supplier-print-area .print-footer { margin-top: 20px; font-size: 11px; color: #999 !important; text-align: center; }
      }
    `;
    document.head.appendChild(style);

    const printDiv = document.createElement('div');
    printDiv.id = 'supplier-print-area';
    printDiv.style.display = 'none';
    printDiv.innerHTML = `
      <div style="padding:20px;font-family:Arial,sans-serif;">
        <div class="print-header">
          <h1>${shopName || 'My Shop'}</h1>
          <p>${shopAddress || ''}</p>
          <h2>Supplier List</h2>
        </div>
        <table>
          <thead><tr>
            <th style="text-align:center;">#</th>
            <th>Supplier</th>
            <th>Contact Person</th>
            <th>Address</th>
            <th>Mobile</th>
            <th style="text-align:right;">Total Due</th>
          </tr></thead>
          <tbody>${filteredSuppliers.map((s, idx) => `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td>${s.name}</td>
              <td>${s.contactPerson || '—'}</td>
              <td>${s.address || '—'}</td>
              <td>${s.phone || '—'}</td>
              <td style="text-align:right;">${formatCurrency(s.totalDue || 0)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="print-footer">Printed on ${new Date().toLocaleDateString('en-GB')} • Total Suppliers: ${filteredSuppliers.length}</div>
      </div>
    `;
    document.body.appendChild(printDiv);

    window.print();

    // Cleanup after print
    setTimeout(() => {
      document.body.removeChild(printDiv);
      document.head.removeChild(style);
    }, 500);
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown size={14} className={`inline ml-1 ${sortKey === col ? 'text-pos-secondary' : 'text-pos-on-surface-variant/50'}`} />
  );

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header with breadcrumb and buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm mb-1">
            <span className="text-pos-on-surface-variant">Suppliers</span>
            <span className="text-pos-on-surface-variant">›</span>
            <span className="text-pos-secondary font-medium">
              {view === 'add' ? 'Add New' : 'List'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('suppliers')}</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setView('add')}
            className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 text-sm transition-all ${
              view === 'add'
                ? 'bg-pos-secondary text-white shadow-lg'
                : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'
            }`}
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {t('addSupplier')}
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 text-sm transition-all ${
              view === 'list'
                ? 'bg-pos-secondary text-white shadow-lg'
                : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'
            }`}
          >
            <span className="material-symbols-outlined text-lg">list</span>
            Supplier List
          </button>
        </div>
      </div>

      {/* Add Supplier Form */}
      {view === 'add' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Supplier *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mir Ceramic Limited"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Contact Person</label>
              <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Dealer / Salesman name"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Mobile</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Opening Balance</label>
              <input value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} type="number" placeholder="0"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAdd}
              className="px-6 py-2.5 bg-[hsl(125,60%,35%)] hover:bg-[hsl(125,60%,30%)] text-white rounded-lg font-semibold text-sm transition-colors">
              Add Supplier
            </button>
            <button onClick={resetForm}
              className="px-6 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors">
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Search bar + Print button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier name, contact, mobile..."
            className="w-full pl-9 pr-3 py-2.5 bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm outline-none focus:border-pos-secondary transition-colors"
          />
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2.5 bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <Printer size={16} />
          Print List
        </button>
      </div>

      {/* Supplier Table */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-pos-surface-container/50">
              <TableHead className="w-12 text-center font-bold">#</TableHead>
              <TableHead className="font-bold cursor-pointer select-none" onClick={() => handleSort('name')}>
                Supplier <SortIcon col="name" />
              </TableHead>
              <TableHead className="font-bold cursor-pointer select-none" onClick={() => handleSort('contactPerson')}>
                Contact Person <SortIcon col="contactPerson" />
              </TableHead>
              <TableHead className="font-bold cursor-pointer select-none" onClick={() => handleSort('phone')}>
                Mobile <SortIcon col="phone" />
              </TableHead>
              <TableHead className="text-right font-bold cursor-pointer select-none" onClick={() => handleSort('totalDue')}>
                Total Due <SortIcon col="totalDue" />
              </TableHead>
              <TableHead className="text-center font-bold w-28">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSuppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-pos-on-surface-variant text-sm">
                  {search ? 'No suppliers match your search.' : 'No suppliers found. Add your first supplier.'}
                </TableCell>
              </TableRow>
            )}
            {paginatedSuppliers.map((s, idx) => (
              <TableRow key={s.id} className="hover:bg-pos-surface-container/30">
                <TableCell className="text-center font-medium text-pos-on-surface-variant">{(page - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell className="text-pos-on-surface-variant">{s.contactPerson || '—'}</TableCell>
                <TableCell className="text-pos-on-surface-variant">{s.phone || '—'}</TableCell>
                <TableCell className={`text-right font-bold ${(s.totalDue || 0) > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>
                  {formatCurrency(s.totalDue || 0)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-3">
                    <button className="text-pos-secondary hover:text-pos-secondary/80 transition-colors" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(s.id)} className="text-pos-error hover:text-pos-error/80 transition-colors" title={t('delete')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {filteredSuppliers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-pos-surface-container">
            <span className="text-xs text-pos-on-surface-variant">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredSuppliers.length)} of {filteredSuppliers.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-pos-surface-container disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                    p === page ? 'bg-pos-secondary text-white' : 'hover:bg-pos-surface-container text-pos-on-surface-variant'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-pos-surface-container disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t('delete')}</h3>
            <p className="text-sm text-pos-on-surface-variant mb-6">Are you sure you want to delete this supplier?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
