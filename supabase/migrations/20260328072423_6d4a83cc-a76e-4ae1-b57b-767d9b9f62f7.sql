
-- Licenses table: tracks each shop owner's license
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_name text NOT NULL DEFAULT '',
  owner_name text NOT NULL DEFAULT '',
  owner_phone text NOT NULL DEFAULT '',
  owner_email text NOT NULL DEFAULT '',
  setup_fee numeric NOT NULL DEFAULT 10000,
  annual_fee numeric NOT NULL DEFAULT 3000,
  license_start date NOT NULL DEFAULT CURRENT_DATE,
  license_expiry date NOT NULL DEFAULT (CURRENT_DATE + interval '1 year')::date,
  status text NOT NULL DEFAULT 'active',
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamp with time zone,
  blocked_reason text NOT NULL DEFAULT '',
  payment_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- System admin can manage all licenses
CREATE POLICY "Admins manage all licenses"
  ON public.licenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own license
CREATE POLICY "Users read own license"
  ON public.licenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin messages table: messages from admin to shop owners
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Admin can send messages (insert/read all)
CREATE POLICY "Admins manage all messages"
  ON public.admin_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own messages
CREATE POLICY "Users read own messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

-- Users can update their own messages (mark as read)
CREATE POLICY "Users update own messages"
  ON public.admin_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Add updated_at trigger to licenses
CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
