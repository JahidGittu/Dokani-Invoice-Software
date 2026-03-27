
CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  option_type text NOT NULL, -- 'category', 'brand', 'finish', 'size'
  option_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, option_type, option_value)
);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own product options"
ON public.product_options FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
