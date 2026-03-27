
-- Phase 1: Add missing columns to sales table
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS less_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_dues numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'Walking';

-- Add total_due column to customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS total_due numeric NOT NULL DEFAULT 0;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  total_due numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own suppliers"
  ON public.suppliers FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  purchase_date text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  delivery numeric NOT NULL DEFAULT 0,
  payable numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  due numeric NOT NULL DEFAULT 0,
  remark text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own purchases"
  ON public.purchases FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create purchase_items table
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  barcode text NOT NULL DEFAULT '',
  carton integer NOT NULL DEFAULT 0,
  piece integer NOT NULL DEFAULT 0,
  sqft_qty numeric NOT NULL DEFAULT 0,
  buy_rate numeric NOT NULL DEFAULT 0,
  sub_total numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own purchase items"
  ON public.purchase_items FOR ALL
  TO public
  USING (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid()));

-- Create due_payments table for tracking partial payments
CREATE TABLE IF NOT EXISTS public.due_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference_type text NOT NULL DEFAULT 'sale',
  reference_id uuid NOT NULL,
  customer_or_supplier text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash',
  note text NOT NULL DEFAULT '',
  payment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.due_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own due payments"
  ON public.due_payments FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add sale_items columns for carton/piece tracking
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS carton integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piece integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sqft_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'Sale',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
