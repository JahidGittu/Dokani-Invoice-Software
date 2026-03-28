import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Product, Customer, SaleRecord, SaleItem, CompanySettings, Supplier, PurchaseRecord, PurchaseItem } from './store';
import { toast } from 'sonner';

// ─── Products Hook (Supabase) ───
export function useSupabaseProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('Fetch products error:', error); return; }
    setProducts((data || []).map(p => ({
      id: p.id,
      name: p.name,
      size: p.size,
      finish: p.finish,
      pricePerBox: Number(p.price_per_box),
      sqftPerBox: Number(p.sqft_per_box),
      piecesPerBox: Number(p.pieces_per_box) || 4,
      stock: p.stock,
      batch: p.batch,
      barcode: p.barcode || '',
      category: p.category || '',
      brand: p.brand || '',
      buyRate: Number(p.buy_rate) || 0,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('products').insert({
      user_id: user.id, name: p.name, size: p.size, finish: p.finish,
      price_per_box: p.pricePerBox, sqft_per_box: p.sqftPerBox,
      stock: p.stock, batch: p.batch, barcode: p.barcode || '',
      category: p.category || '', brand: p.brand || '',
      buy_rate: p.buyRate || 0, pieces_per_box: p.piecesPerBox || 4,
    });
    if (error) { toast.error('Failed to add product'); return; }
    fetchProducts();
  }, [user, fetchProducts]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    if (!user) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.size !== undefined) dbUpdates.size = updates.size;
    if (updates.finish !== undefined) dbUpdates.finish = updates.finish;
    if (updates.pricePerBox !== undefined) dbUpdates.price_per_box = updates.pricePerBox;
    if (updates.sqftPerBox !== undefined) dbUpdates.sqft_per_box = updates.sqftPerBox;
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
    if (updates.batch !== undefined) dbUpdates.batch = updates.batch;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
    if (updates.buyRate !== undefined) dbUpdates.buy_rate = updates.buyRate;
    if (updates.piecesPerBox !== undefined) dbUpdates.pieces_per_box = updates.piecesPerBox;
    const { error } = await supabase.from('products').update(dbUpdates).eq('id', id);
    if (error) { toast.error('Failed to update product'); return; }
    fetchProducts();
  }, [user, fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast.error('Failed to delete product'); return; }
    fetchProducts();
  }, [user, fetchProducts]);

  const deductStock = useCallback(async (items: { productId: string; qty: number }[]) => {
    if (!user) return;
    for (const item of items) {
      await supabase.rpc('deduct_stock', { p_product_id: item.productId, p_qty: item.qty });
    }
    fetchProducts();
  }, [user, fetchProducts]);

  const addStock = useCallback(async (items: { productId: string; qty: number }[]) => {
    if (!user) return;
    for (const item of items) {
      await supabase.rpc('add_stock', { p_product_id: item.productId, p_qty: item.qty });
    }
    fetchProducts();
  }, [user, fetchProducts]);

  return { products, setProducts: fetchProducts as unknown as React.Dispatch<React.SetStateAction<Product[]>>, addProduct, updateProduct, deleteProduct, deductStock, addStock, loading };
}

// ─── Customers Hook (Supabase) ───
export function useSupabaseCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const fetchCustomers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch customers error:', error); return; }
    setCustomers((data || []).map(c => ({
      id: c.id, name: c.name, initials: c.initials, phone: c.phone,
      address: c.address, totalSpent: Number(c.total_spent),
      totalDue: Number((c as any).total_due) || 0,
      lastOrder: c.last_order || '', color: c.color as Customer['color'],
    })));
  }, [user]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const addCustomer = useCallback(async (name: string, phone: string, address: string) => {
    if (!user) return;
    const colors: Customer['color'][] = ['secondary', 'tertiary', 'primary', 'error'];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const { error } = await supabase.from('customers').insert({
      user_id: user.id, name, initials, phone, address,
      total_spent: 0, total_due: 0,
      last_order: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      color: colors[Math.floor(Math.random() * colors.length)],
    } as any);
    if (error) { toast.error('Failed to add customer'); return; }
    fetchCustomers();
  }, [user, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('customers').delete().eq('id', id);
    fetchCustomers();
  }, [user, fetchCustomers]);

  const updateCustomerSpend = useCallback(async (name: string, amount: number, dueAmount: number = 0) => {
    if (!user) return;
    const c = customers.find(c => c.name === name);
    if (!c) return;
    await supabase.from('customers').update({
      total_spent: c.totalSpent + amount,
      total_due: (c.totalDue || 0) + dueAmount,
      last_order: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    } as any).eq('id', c.id);
    fetchCustomers();
  }, [user, customers, fetchCustomers]);

  const updateCustomerDue = useCallback(async (id: string, newDue: number) => {
    if (!user) return;
    await supabase.from('customers').update({ total_due: newDue } as any).eq('id', id);
    fetchCustomers();
  }, [user, fetchCustomers]);

  return { customers, setCustomers: fetchCustomers as any, addCustomer, deleteCustomer, updateCustomerSpend, updateCustomerDue };
}

// ─── Sales Hook (Supabase) ───
export function useSupabaseSales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleRecord[]>([]);

  const fetchSales = useCallback(async () => {
    if (!user) return;
    const { data: salesData, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('Fetch sales error:', error); return; }
    setSales((salesData || []).map((s: any) => ({
      id: s.id, invoice: s.invoice, customer: s.customer, phone: s.phone,
      address: s.address || '', subtotal: Number(s.subtotal), discount: Number(s.discount),
      discountType: s.discount_type as 'flat' | 'percent', total: Number(s.total),
      paymentMethod: s.payment_method, notes: s.notes || '',
      status: s.status as 'paid' | 'pending' | 'credit',
      date: s.sale_date, time: s.sale_time,
      paid: Number(s.paid) || 0,
      due: Number(s.due) || 0,
      labour: Number(s.labour) || 0,
      delivery: Number(s.delivery) || 0,
      lessAmount: Number(s.less_amount) || 0,
      returnAmount: Number(s.return_amount) || 0,
      previousDues: Number(s.previous_dues) || 0,
      balance: Number(s.balance) || 0,
      soldBy: s.sold_by || '',
      customerType: s.customer_type || 'Walking',
      items: (s.sale_items || []).map((i: any) => ({
        productId: i.product_id, name: i.name, detail: i.detail,
        qty: i.qty, price: Number(i.price),
        carton: i.carton || 0, piece: i.piece || 0,
        sqftQty: Number(i.sqft_qty) || 0,
        itemType: i.item_type || 'Sale',
        category: i.category || '',
      })),
    })));
  }, [user]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const addSale = useCallback(async (sale: SaleRecord) => {
    if (!user) return;
    const { data: saleRow, error } = await supabase.from('sales').insert({
      user_id: user.id, invoice: sale.invoice, customer: sale.customer,
      phone: sale.phone, address: sale.address, subtotal: sale.subtotal,
      discount: sale.discount, discount_type: sale.discountType,
      total: sale.total, payment_method: sale.paymentMethod,
      notes: sale.notes, status: sale.status,
      sale_date: sale.date, sale_time: sale.time,
      paid: sale.paid ?? sale.total,
      due: sale.due ?? 0,
      labour: sale.labour ?? 0,
      delivery: sale.delivery ?? 0,
      less_amount: sale.lessAmount ?? 0,
      return_amount: sale.returnAmount ?? 0,
      previous_dues: sale.previousDues ?? 0,
      balance: sale.balance ?? 0,
      sold_by: sale.soldBy ?? '',
      customer_type: sale.customerType ?? 'Walking',
    } as any).select().single();
    if (error || !saleRow) { toast.error('Failed to save sale'); return; }
    
    if (sale.items.length > 0) {
      const { error: itemsError } = await supabase.from('sale_items').insert(
        sale.items.map(i => ({
          sale_id: saleRow.id, product_id: i.productId,
          name: i.name, detail: i.detail, qty: i.qty, price: i.price,
          carton: i.carton ?? 0, piece: i.piece ?? 0,
          sqft_qty: i.sqftQty ?? 0, item_type: i.itemType ?? 'Sale',
          category: i.category ?? '',
        } as any))
      );
      if (itemsError) console.error('Insert sale items error:', itemsError);
    }
    fetchSales();
  }, [user, fetchSales]);

  const deleteSale = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('sales').delete().eq('id', id);
    fetchSales();
  }, [user, fetchSales]);

  const updateSaleDue = useCallback(async (id: string, paid: number, due: number) => {
    if (!user) return;
    await supabase.from('sales').update({
      paid, due,
      status: due <= 0 ? 'paid' : 'pending',
    } as any).eq('id', id);
    fetchSales();
  }, [user, fetchSales]);

  return { sales, setSales: fetchSales as any, addSale, deleteSale, updateSaleDue };
}

// ─── Suppliers Hook (Supabase) ───
export function useSupabaseSuppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const fetchSuppliers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Fetch suppliers error:', error); return; }
    setSuppliers((data || []).map((s: any) => ({
      id: s.id, name: s.name, phone: s.phone, address: s.address,
      totalDue: Number(s.total_due) || 0,
    })));
  }, [user]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const addSupplier = useCallback(async (name: string, phone: string, address: string) => {
    if (!user) return;
    const { error } = await supabase.from('suppliers').insert({
      user_id: user.id, name, phone, address, total_due: 0,
    } as any);
    if (error) { toast.error('Failed to add supplier'); return; }
    fetchSuppliers();
  }, [user, fetchSuppliers]);

  const deleteSupplier = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('suppliers').delete().eq('id', id);
    fetchSuppliers();
  }, [user, fetchSuppliers]);

  const updateSupplierDue = useCallback(async (name: string, dueAmount: number) => {
    if (!user) return;
    const s = suppliers.find(s => s.name === name);
    if (!s) return;
    await supabase.from('suppliers').update({
      total_due: (s.totalDue || 0) + dueAmount,
    } as any).eq('id', s.id);
    fetchSuppliers();
  }, [user, suppliers, fetchSuppliers]);

  return { suppliers, setSuppliers: fetchSuppliers as any, addSupplier, deleteSupplier, updateSupplierDue };
}

// ─── Purchases Hook (Supabase) ───
export function useSupabasePurchases() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('Fetch purchases error:', error); return; }
    setPurchases((data || []).map((p: any) => ({
      id: p.id, invoice: p.invoice, supplierName: p.supplier_name,
      date: p.purchase_date, total: Number(p.total),
      discount: Number(p.discount), delivery: Number(p.delivery),
      payable: Number(p.payable), paid: Number(p.paid), due: Number(p.due),
      remark: p.remark || '',
      items: (p.purchase_items || []).map((i: any) => ({
        productId: i.product_id, name: i.name, barcode: i.barcode,
        carton: i.carton, piece: i.piece, sqftQty: Number(i.sqft_qty),
        buyRate: Number(i.buy_rate), subTotal: Number(i.sub_total),
      })),
    })));
  }, [user]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const addPurchase = useCallback(async (purchase: PurchaseRecord) => {
    if (!user) return;
    const { data: pRow, error } = await supabase.from('purchases').insert({
      user_id: user.id, invoice: purchase.invoice,
      supplier_name: purchase.supplierName,
      purchase_date: purchase.date, total: purchase.total,
      discount: purchase.discount, delivery: purchase.delivery,
      payable: purchase.payable, paid: purchase.paid, due: purchase.due,
      remark: purchase.remark,
    } as any).select().single();
    if (error || !pRow) { toast.error('Failed to save purchase'); return; }

    if (purchase.items.length > 0) {
      await supabase.from('purchase_items').insert(
        purchase.items.map(i => ({
          purchase_id: pRow.id, product_id: i.productId,
          name: i.name, barcode: i.barcode || '',
          carton: i.carton, piece: i.piece,
          sqft_qty: i.sqftQty, buy_rate: i.buyRate, sub_total: i.subTotal,
        } as any))
      );
    }
    fetchPurchases();
  }, [user, fetchPurchases]);

  const deletePurchase = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('purchases').delete().eq('id', id);
    fetchPurchases();
  }, [user, fetchPurchases]);

  return { purchases, setPurchases: fetchPurchases as any, addPurchase, deletePurchase };
}

// ─── Company Settings Hook (Supabase) ───
export function useSupabaseSettings() {
  const { user } = useAuth();
  const [settings, setSettingsState] = useState<CompanySettings>({
    name: 'TilePOS Lite', address: '', phone: '', email: '',
    userName: '', userRole: 'Administrator', lowStockThreshold: 20,
    invPrefix: 'INV', darkMode: false,
  });
  const [invCounter, setInvCounter] = useState(1);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('company_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.error('Fetch settings error:', error); return; }
    if (data) {
      setSettingsState({
        name: data.name, address: data.address, phone: data.phone, email: data.email,
        userName: data.user_name, userRole: data.user_role,
        lowStockThreshold: data.low_stock_threshold, invPrefix: data.inv_prefix,
        darkMode: data.dark_mode,
      });
      setInvCounter(data.inv_counter);
    } else {
      await supabase.from('company_settings').insert({ user_id: user.id });
      fetchSettings();
    }
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const setSettings = useCallback(async (s: CompanySettings) => {
    if (!user) return;
    setSettingsState(s);
    await supabase.from('company_settings').update({
      name: s.name, address: s.address, phone: s.phone, email: s.email,
      user_name: s.userName, user_role: s.userRole,
      low_stock_threshold: s.lowStockThreshold, inv_prefix: s.invPrefix,
      dark_mode: s.darkMode,
    }).eq('user_id', user.id);
  }, [user]);

  const getNextInvoiceNumber = useCallback(async () => {
    if (!user) return 'INV-0001';
    const num = invCounter;
    const newCounter = num + 1;
    setInvCounter(newCounter);
    await supabase.from('company_settings').update({ inv_counter: newCounter }).eq('user_id', user.id);
    return `${settings.invPrefix}-${String(num).padStart(4, '0')}`;
  }, [user, invCounter, settings.invPrefix]);

  return { settings, setSettings, getNextInvoiceNumber };
}

// ─── Due Payments Hook (Supabase) ───
export function useSupabaseDuePayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('due_payments')
      .select('*')
      .order('payment_date', { ascending: false });
    if (error) { console.error('Fetch due payments error:', error); return; }
    setPayments(data || []);
  }, [user]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayment = useCallback(async (payment: {
    referenceType: 'sale' | 'purchase';
    referenceId: string;
    customerOrSupplier: string;
    amount: number;
    paymentMethod: string;
    note: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from('due_payments').insert({
      user_id: user.id,
      reference_type: payment.referenceType,
      reference_id: payment.referenceId,
      customer_or_supplier: payment.customerOrSupplier,
      amount: payment.amount,
      payment_method: payment.paymentMethod,
      note: payment.note,
    } as any);
    if (error) { toast.error('Failed to record payment'); return; }
    fetchPayments();
    return true;
  }, [user, fetchPayments]);

  return { payments, addPayment, fetchPayments };
}
