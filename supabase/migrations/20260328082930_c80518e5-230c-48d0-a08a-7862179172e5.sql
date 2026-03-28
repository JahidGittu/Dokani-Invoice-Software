
-- 1. Create atomic stock deduction function
CREATE OR REPLACE FUNCTION public.deduct_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - p_qty), updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- 2. Create atomic stock addition function
CREATE OR REPLACE FUNCTION public.add_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products SET stock = stock + p_qty, updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- 3. Fix RLS policies: change from public to authenticated
DROP POLICY IF EXISTS "Users manage own products" ON products;
CREATE POLICY "Users manage own products" ON products FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own sales" ON sales;
CREATE POLICY "Users manage own sales" ON sales FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own sale items" ON sale_items;
CREATE POLICY "Users manage own sale items" ON sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage own customers" ON customers;
CREATE POLICY "Users manage own customers" ON customers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own suppliers" ON suppliers;
CREATE POLICY "Users manage own suppliers" ON suppliers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own purchases" ON purchases;
CREATE POLICY "Users manage own purchases" ON purchases FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own purchase items" ON purchase_items;
CREATE POLICY "Users manage own purchase items" ON purchase_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage own settings" ON company_settings;
CREATE POLICY "Users manage own settings" ON company_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own due payments" ON due_payments;
CREATE POLICY "Users manage own due payments" ON due_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own product options" ON product_options;
CREATE POLICY "Users can manage own product options" ON product_options FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
