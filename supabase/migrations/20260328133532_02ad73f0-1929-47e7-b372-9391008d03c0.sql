-- Allow admins to manage company_settings, products, customers, sales, sale_items, purchases, purchase_items, staffs, suppliers, inventory_logs, due_payments, product_options for ALL users

-- company_settings
CREATE POLICY "Admins manage all settings"
ON public.company_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- products
CREATE POLICY "Admins manage all products"
ON public.products FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- customers
CREATE POLICY "Admins manage all customers"
ON public.customers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- sales
CREATE POLICY "Admins manage all sales"
ON public.sales FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- sale_items (admin via sale ownership)
CREATE POLICY "Admins manage all sale items"
ON public.sale_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- purchases
CREATE POLICY "Admins manage all purchases"
ON public.purchases FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- purchase_items
CREATE POLICY "Admins manage all purchase items"
ON public.purchase_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- staffs
CREATE POLICY "Admins manage all staffs"
ON public.staffs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- suppliers
CREATE POLICY "Admins manage all suppliers"
ON public.suppliers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- inventory_logs
CREATE POLICY "Admins manage all inventory logs"
ON public.inventory_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- due_payments
CREATE POLICY "Admins manage all due payments"
ON public.due_payments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- product_options
CREATE POLICY "Admins manage all product options"
ON public.product_options FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));