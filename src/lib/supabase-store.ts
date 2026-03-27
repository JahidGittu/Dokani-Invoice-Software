import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Product, Customer, SaleRecord, SaleItem, CompanySettings } from './store';
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
      stock: p.stock,
      batch: p.batch,
      barcode: p.barcode || '',
      category: (p as any).category || '',
      brand: (p as any).brand || '',
      buyRate: Number((p as any).buy_rate) || 0,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('products').insert({
      user_id: user.id, name: p.name, size: p.size, finish: p.finish,
      price_per_box: p.pricePerBox, sqft_per_box: p.sqftPerBox,
      stock: p.stock, batch: p.batch, barcode: (p as any).barcode || '',
    });
    if (error) { toast.error('Failed to add product'); return; }
    fetchProducts();
  }, [user, fetchProducts]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    if (!user) return;
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.size !== undefined) dbUpdates.size = updates.size;
    if (updates.finish !== undefined) dbUpdates.finish = updates.finish;
    if (updates.pricePerBox !== undefined) dbUpdates.price_per_box = updates.pricePerBox;
    if (updates.sqftPerBox !== undefined) dbUpdates.sqft_per_box = updates.sqftPerBox;
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
    if (updates.batch !== undefined) dbUpdates.batch = updates.batch;
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
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        await supabase.from('products').update({ stock: Math.max(0, prod.stock - item.qty) }).eq('id', item.productId);
      }
    }
    fetchProducts();
  }, [user, products, fetchProducts]);

  return { products, setProducts: fetchProducts as any, addProduct, updateProduct, deleteProduct, deductStock, loading };
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
      address: c.address, totalSpent: Number(c.total_spent), totalDue: 0,
      lastOrder: c.last_order || '', color: c.color as Customer['color'],
    })));
  }, [user]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const addCustomer = useCallback(async (name: string, phone: string, address: string) => {
    if (!user) return;
    const colors: Customer['color'][] = ['secondary', 'tertiary', 'primary', 'error'];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const { data, error } = await supabase.from('customers').insert({
      user_id: user.id, name, initials, phone, address,
      total_spent: 0,
      last_order: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      color: colors[Math.floor(Math.random() * colors.length)],
    }).select().single();
    if (error) { toast.error('Failed to add customer'); return; }
    fetchCustomers();
    return data;
  }, [user, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('customers').delete().eq('id', id);
    fetchCustomers();
  }, [user, fetchCustomers]);

  const updateCustomerSpend = useCallback(async (name: string, amount: number) => {
    if (!user) return;
    const c = customers.find(c => c.name === name);
    if (!c) return;
    await supabase.from('customers').update({
      total_spent: c.totalSpent + amount,
      last_order: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    }).eq('id', c.id);
    fetchCustomers();
  }, [user, customers, fetchCustomers]);

  return { customers, setCustomers: fetchCustomers as any, addCustomer, deleteCustomer, updateCustomerSpend };
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
    setSales((salesData || []).map(s => ({
      id: s.id, invoice: s.invoice, customer: s.customer, phone: s.phone,
      address: s.address || '', subtotal: Number(s.subtotal), discount: Number(s.discount),
      discountType: s.discount_type as 'flat' | 'percent', total: Number(s.total),
      paymentMethod: s.payment_method, notes: s.notes || '',
      status: s.status as 'paid' | 'pending' | 'credit',
      date: s.sale_date, time: s.sale_time,
      items: (s.sale_items || []).map((i: any) => ({
        productId: i.product_id, name: i.name, detail: i.detail,
        qty: i.qty, price: Number(i.price),
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
    }).select().single();
    if (error || !saleRow) { toast.error('Failed to save sale'); return; }
    
    if (sale.items.length > 0) {
      const { error: itemsError } = await supabase.from('sale_items').insert(
        sale.items.map(i => ({
          sale_id: saleRow.id, product_id: i.productId,
          name: i.name, detail: i.detail, qty: i.qty, price: i.price,
        }))
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

  return { sales, setSales: fetchSales as any, addSale, deleteSale };
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
      // Create default settings for new user
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
