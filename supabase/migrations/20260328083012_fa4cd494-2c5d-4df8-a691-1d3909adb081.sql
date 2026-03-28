
-- Staffs table
CREATE TABLE public.staffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Salesman',
  salary numeric NOT NULL DEFAULT 0,
  join_date timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own staffs" ON staffs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inventory logs table
CREATE TABLE public.inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL DEFAULT '',
  log_type text NOT NULL DEFAULT 'IN',
  qty integer NOT NULL DEFAULT 0,
  total_after integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  reference_id text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inventory logs" ON inventory_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-log stock changes via triggers
CREATE OR REPLACE FUNCTION public.log_stock_deduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO inventory_logs (user_id, product_id, product_name, log_type, qty, total_after, note)
    VALUES (
      NEW.user_id,
      NEW.id,
      NEW.name,
      CASE WHEN NEW.stock > OLD.stock THEN 'IN' ELSE 'OUT' END,
      ABS(NEW.stock - OLD.stock),
      NEW.stock,
      CASE WHEN NEW.stock > OLD.stock THEN 'Stock added' ELSE 'Stock deducted' END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_stock_change
  AFTER UPDATE OF stock ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_stock_deduction();
