ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pix_password text;
GRANT UPDATE (pix_password) ON public.restaurants TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_restaurant_sensitive();

CREATE OR REPLACE FUNCTION public.get_my_restaurant_sensitive()
 RETURNS TABLE(id uuid, trash_password text, pix_key text, pix_key_type text, pix_password text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, trash_password, pix_key, pix_key_type, pix_password
  FROM public.restaurants
  WHERE owner_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.update_pix_settings_with_password(
  _password text,
  _pix_enabled boolean,
  _pix_key text,
  _pix_key_type text,
  _pix_recipient_name text,
  _pix_city text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_current_password text;
BEGIN
  SELECT id, pix_password INTO v_restaurant_id, v_current_password
  FROM public.restaurants
  WHERE owner_id = auth.uid();

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  IF v_current_password IS NULL OR v_current_password = '' THEN
    RAISE EXCEPTION 'Pix password not configured';
  END IF;

  IF _password IS DISTINCT FROM v_current_password THEN
    RAISE EXCEPTION 'Invalid password';
  END IF;

  UPDATE public.restaurants
  SET
    pix_enabled = _pix_enabled,
    pix_key = _pix_key,
    pix_key_type = _pix_key_type,
    pix_recipient_name = _pix_recipient_name,
    pix_city = _pix_city,
    updated_at = now()
  WHERE id = v_restaurant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_pix_password(_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _new_password IS NULL OR _new_password !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Password must be exactly 6 digits';
  END IF;

  UPDATE public.restaurants
  SET pix_password = _new_password, updated_at = now()
  WHERE owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
END;
$function$;