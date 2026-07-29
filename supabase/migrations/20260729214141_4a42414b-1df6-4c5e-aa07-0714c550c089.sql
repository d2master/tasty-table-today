CREATE OR REPLACE FUNCTION public.waiter_login(_slug text, _username text, _password text)
RETURNS TABLE(token text, waiter_id uuid, waiter_name text, restaurant_id uuid, restaurant_slug text, restaurant_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_waiter public.waiters%ROWTYPE;
  v_rest public.restaurants%ROWTYPE;
  v_token text;
  v_slug text := lower(trim(coalesce(_slug, '')));
  v_username text := lower(trim(coalesce(_username, '')));
BEGIN
  IF v_slug = '' OR v_username = '' OR _password IS NULL OR _password = '' THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  SELECT * INTO v_rest
  FROM public.restaurants
  WHERE lower(trim(slug)) = v_slug
  LIMIT 1;

  IF v_rest.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  SELECT * INTO v_waiter
  FROM public.waiters
  WHERE restaurant_id = v_rest.id
    AND lower(trim(username)) = v_username
    AND is_active = true
  LIMIT 1;

  IF v_waiter.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  IF v_waiter.password_hash IS NULL
     OR extensions.crypt(_password, v_waiter.password_hash) IS DISTINCT FROM v_waiter.password_hash THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.waiter_sessions(waiter_id, token, expires_at)
  VALUES (v_waiter.id, v_token, now() + interval '12 hours');

  RETURN QUERY SELECT v_token, v_waiter.id, v_waiter.name, v_rest.id, v_rest.slug, v_rest.name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.waiter_login(text, text, text) TO anon, authenticated, service_role;