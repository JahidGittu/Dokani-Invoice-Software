-- Function to notify all admins about new signup (bypasses RLS)
CREATE OR REPLACE FUNCTION public.notify_admins_new_signup(
  p_user_id uuid,
  p_email text,
  p_shop_name text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
BEGIN
  FOR admin_row IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO admin_messages (sender_id, recipient_id, subject, message, message_type)
    VALUES (
      p_user_id,
      admin_row.user_id,
      '🆕 নতুন সাইনআপ: ' || COALESCE(NULLIF(p_shop_name, ''), p_email),
      'নতুন ইউজার সাইনআপ করেছে:' || E'\n' ||
      '📧 ' || p_email || E'\n' ||
      '🏪 ' || COALESCE(NULLIF(p_shop_name, ''), 'N/A') || E'\n' ||
      '📱 ' || COALESCE(NULLIF(p_phone, ''), 'N/A') || E'\n\n' ||
      'অনুগ্রহ করে লাইসেন্স তৈরি করে অ্যাক্টিভেট করুন।',
      'new_signup'
    );
  END LOOP;
END;
$$;