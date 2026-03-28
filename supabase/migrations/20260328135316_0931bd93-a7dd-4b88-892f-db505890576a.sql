
ALTER TABLE public.profiles ADD COLUMN full_name text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.handle_new_profile_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, shop_name, phone, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'shop_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    shop_name = EXCLUDED.shop_name,
    phone = EXCLUDED.phone,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
$function$;
