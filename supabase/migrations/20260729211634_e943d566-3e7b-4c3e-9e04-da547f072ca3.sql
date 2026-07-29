CREATE OR REPLACE FUNCTION public.waiter_create(_restaurant_id uuid, _username text, _password text, _name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_restaurant_owner(_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _username IS NULL OR length(trim(_username)) < 3 THEN RAISE EXCEPTION 'Username inválido'; END IF;
  IF _password IS NULL OR length(_password) < 4 THEN RAISE EXCEPTION 'Senha muito curta'; END IF;
  IF _name IS NULL OR length(trim(_name)) < 1 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;

  INSERT INTO public.waiters(restaurant_id, username, password_hash, name)
  VALUES (_restaurant_id, lower(trim(_username)), extensions.crypt(_password, extensions.gen_salt('bf')), trim(_name))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe um garçom com este usuário';
END;
$function$;

CREATE OR REPLACE FUNCTION public.waiter_reset_password(_waiter_id uuid, _new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_rid uuid;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL OR NOT public.is_restaurant_owner(v_rid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 4 THEN RAISE EXCEPTION 'Senha muito curta'; END IF;
  UPDATE public.waiters SET password_hash = extensions.crypt(_new_password, extensions.gen_salt('bf')), updated_at = now()
   WHERE id = _waiter_id;
  DELETE FROM public.waiter_sessions WHERE waiter_id = _waiter_id;
END;
$function$;

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
BEGIN
  SELECT * INTO v_rest FROM public.restaurants WHERE slug = _slug LIMIT 1;
  IF v_rest.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  SELECT * INTO v_waiter FROM public.waiters
   WHERE restaurant_id = v_rest.id AND username = _username AND is_active = true
   LIMIT 1;

  IF v_waiter.id IS NULL OR v_waiter.password_hash <> extensions.crypt(_password, v_waiter.password_hash) THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.waiter_sessions(waiter_id, token, expires_at)
  VALUES (v_waiter.id, v_token, now() + interval '12 hours');

  RETURN QUERY SELECT v_token, v_waiter.id, v_waiter.name, v_rest.id, v_rest.slug, v_rest.name;
END;
$function$;