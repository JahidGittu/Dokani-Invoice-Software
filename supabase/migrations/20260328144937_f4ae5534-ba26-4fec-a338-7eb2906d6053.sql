ALTER TABLE public.products ADD COLUMN unit text NOT NULL DEFAULT 'SQFT';
ALTER TABLE public.products ADD COLUMN height text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN width text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN reorder_limit integer NOT NULL DEFAULT 0;