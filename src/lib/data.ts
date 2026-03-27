export interface Product {
  id: string;
  name: string;
  size: string;
  finish: string;
  pricePerBox: number;
  sqftPerBox: number;
  stock: number;
  batch: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface Sale {
  id: string;
  invoice: string;
  customer: string;
  product: string;
  amount: number;
  time: string;
  status: 'Paid' | 'Pending';
  items: { name: string; detail: string; qty: number; price: number }[];
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  address: string;
  totalSpent: number;
  lastOrder: string;
  color: 'secondary' | 'tertiary' | 'primary' | 'error';
}

export const products: Product[] = [
  { id: '1', name: 'Royal Marble', size: '24×24', finish: 'Glossy', pricePerBox: 1200, sqftPerBox: 9.2, stock: 345, batch: 'BT-2401' },
  { id: '2', name: 'Ivory Stone', size: '12×24', finish: 'Matte', pricePerBox: 950, sqftPerBox: 7.7, stock: 12, batch: 'BT-2388' },
  { id: '3', name: 'Dark Slate', size: '24×48', finish: 'Matte', pricePerBox: 1800, sqftPerBox: 15.6, stock: 210, batch: 'BT-2412' },
  { id: '4', name: 'Pearl White', size: '30×30', finish: 'Glossy', pricePerBox: 780, sqftPerBox: 6.0, stock: 8, batch: 'BT-2395' },
  { id: '5', name: 'Travertine', size: '60×60', finish: 'Lappato', pricePerBox: 2400, sqftPerBox: 25.0, stock: 438, batch: 'BT-2420' },
  { id: '6', name: 'Sand Beige', size: '12×12', finish: 'Matte', pricePerBox: 650, sqftPerBox: 4.0, stock: 18, batch: 'BT-2378' },
];

export const customers: Customer[] = [
  { id: '1', name: 'Rahim Mia', initials: 'RM', phone: '01712-345678', address: 'Chattogram', totalSpent: 234500, lastOrder: '27 Mar 2026', color: 'secondary' },
  { id: '2', name: 'Karim Ahmed', initials: 'KA', phone: '01822-987654', address: 'Dhaka', totalSpent: 189000, lastOrder: '25 Mar 2026', color: 'tertiary' },
  { id: '3', name: 'Selim Brothers', initials: 'SB', phone: '01933-112233', address: 'Sylhet', totalSpent: 98750, lastOrder: '22 Mar 2026', color: 'primary' },
  { id: '4', name: 'Nasir Traders', initials: 'NT', phone: '01555-667788', address: 'Rajshahi', totalSpent: 67200, lastOrder: '18 Mar 2026', color: 'error' },
];

export const recentSales: Sale[] = [
  { id: '1', invoice: 'INV-0090', customer: 'Rahim Mia', product: 'Royal Marble 24×24', amount: 12000, time: '10:34 AM', status: 'Paid', items: [{ name: 'Royal Marble', detail: '24×24 Glossy', qty: 10, price: 1200 }] },
  { id: '2', invoice: 'INV-0089', customer: 'Karim Ahmed', product: 'Dark Slate 24×48', amount: 21600, time: '9:15 AM', status: 'Paid', items: [{ name: 'Dark Slate', detail: '24×48 Matte', qty: 12, price: 1800 }] },
  { id: '3', invoice: 'INV-0088', customer: 'Selim Brothers', product: 'Travertine 60×60', amount: 8900, time: '8:50 AM', status: 'Pending', items: [{ name: 'Travertine', detail: '60×60 Lappato', qty: 3, price: 2400 }, { name: 'Sand Beige', detail: '12×12 Matte', qty: 2, price: 650 }] },
];

let invoiceCounter = 91;
export function getNextInvoiceNumber(): string {
  return `INV-${String(invoiceCounter++).padStart(4, '0')}`;
}

export function formatCurrency(amount: number): string {
  return '৳' + amount.toLocaleString('en-IN');
}
