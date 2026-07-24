
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ WAITERS ============
CREATE TABLE public.waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  username text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, username)
);

GRANT SELECT ON public.waiters TO authenticated;
GRANT ALL ON public.waiters TO service_role;

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their waiters"
  ON public.waiters FOR SELECT TO authenticated
  USING (public.is_restaurant_owner(restaurant_id));

CREATE TRIGGER update_waiters_updated_at
  BEFORE UPDATE ON public.waiters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WAITER SESSIONS ============
CREATE TABLE public.waiter_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiter_id uuid NOT NULL REFERENCES public.waiters(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.waiter_sessions TO service_role;
ALTER TABLE public.waiter_sessions ENABLE ROW LEVEL SECURITY;
-- no policies -> only service_role can access

-- ============ ORDERS.waiter_id ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON public.orders(waiter_id);

-- ============ FUNCTIONS ============

-- Login: verifies password and creates session token. Called from edge function (service role).
CREATE OR REPLACE FUNCTION public.waiter_login(_slug text, _username text, _password text)
RETURNS TABLE(token text, waiter_id uuid, waiter_name text, restaurant_id uuid, restaurant_slug text, restaurant_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_waiter.id IS NULL OR v_waiter.password_hash <> crypt(_password, v_waiter.password_hash) THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.waiter_sessions(waiter_id, token, expires_at)
  VALUES (v_waiter.id, v_token, now() + interval '12 hours');

  RETURN QUERY SELECT v_token, v_waiter.id, v_waiter.name, v_rest.id, v_rest.slug, v_rest.name;
END;
$$;

-- Validate token, return waiter info (used by edge functions)
CREATE OR REPLACE FUNCTION public.waiter_from_token(_token text)
RETURNS TABLE(waiter_id uuid, waiter_name text, restaurant_id uuid, restaurant_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.restaurant_id, r.slug
  FROM public.waiter_sessions s
  JOIN public.waiters w ON w.id = s.waiter_id
  JOIN public.restaurants r ON r.id = w.restaurant_id
  WHERE s.token = _token AND s.expires_at > now() AND w.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.waiter_logout(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.waiter_sessions WHERE token = _token;
$$;

-- Owner: create/update/delete/reset password of waiters
CREATE OR REPLACE FUNCTION public.waiter_create(_restaurant_id uuid, _username text, _password text, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_restaurant_owner(_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _username IS NULL OR length(trim(_username)) < 3 THEN RAISE EXCEPTION 'Username inválido'; END IF;
  IF _password IS NULL OR length(_password) < 4 THEN RAISE EXCEPTION 'Senha muito curta'; END IF;
  IF _name IS NULL OR length(trim(_name)) < 1 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;

  INSERT INTO public.waiters(restaurant_id, username, password_hash, name)
  VALUES (_restaurant_id, lower(trim(_username)), crypt(_password, gen_salt('bf')), trim(_name))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe um garçom com este usuário';
END;
$$;

CREATE OR REPLACE FUNCTION public.waiter_update(_waiter_id uuid, _name text, _is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rid uuid;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL OR NOT public.is_restaurant_owner(v_rid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.waiters SET
    name = COALESCE(NULLIF(trim(_name), ''), name),
    is_active = COALESCE(_is_active, is_active),
    updated_at = now()
  WHERE id = _waiter_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.waiter_reset_password(_waiter_id uuid, _new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rid uuid;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL OR NOT public.is_restaurant_owner(v_rid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 4 THEN RAISE EXCEPTION 'Senha muito curta'; END IF;
  UPDATE public.waiters SET password_hash = crypt(_new_password, gen_salt('bf')), updated_at = now()
   WHERE id = _waiter_id;
  DELETE FROM public.waiter_sessions WHERE waiter_id = _waiter_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.waiter_delete(_waiter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rid uuid;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL OR NOT public.is_restaurant_owner(v_rid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.waiters WHERE id = _waiter_id;
END;
$$;

-- Waiter view of tables (called by edge fn passing waiter's restaurant_id).
-- Returns each table with: is_occupied, my_active_order_id, my_active (true if this waiter owns the active order).
CREATE OR REPLACE FUNCTION public.waiter_tables(_waiter_id uuid)
RETURNS TABLE(table_number int, is_occupied boolean, active_waiter_id uuid, active_order_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (SELECT restaurant_id FROM public.waiters WHERE id = _waiter_id LIMIT 1),
  r AS (SELECT id, table_count FROM public.restaurants WHERE id = (SELECT restaurant_id FROM w) LIMIT 1),
  active AS (
    SELECT DISTINCT ON (o.table_number)
      o.table_number::int AS tn, o.waiter_id, o.id AS oid
    FROM public.orders o
    WHERE o.restaurant_id = (SELECT id FROM r)
      AND o.order_type = 'table'
      AND o.deleted_at IS NULL
      AND o.status IN ('pending','preparing','ready')
    ORDER BY o.table_number, o.created_at DESC
  )
  SELECT gs::int AS table_number,
         EXISTS (SELECT 1 FROM active a WHERE a.tn = gs) AS is_occupied,
         (SELECT a.waiter_id FROM active a WHERE a.tn = gs) AS active_waiter_id,
         (SELECT a.oid FROM active a WHERE a.tn = gs) AS active_order_id
  FROM r, generate_series(1, r.table_count) gs;
$$;

-- Waiter: list orders for a table (only ones belonging to their restaurant)
CREATE OR REPLACE FUNCTION public.waiter_orders_for_table(_waiter_id uuid, _table_number text)
RETURNS TABLE(id uuid, status text, total numeric, tip_enabled boolean, tip_amount numeric, waiter_id uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.total, o.tip_enabled, o.tip_amount, o.waiter_id, o.created_at, o.updated_at
  FROM public.orders o
  JOIN public.waiters w ON w.id = _waiter_id
  WHERE o.restaurant_id = w.restaurant_id
    AND o.order_type = 'table'
    AND o.table_number = _table_number
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
$$;

-- Waiter: update order status (only for their restaurant, and only if waiter matches OR order has no waiter yet)
CREATE OR REPLACE FUNCTION public.waiter_update_order_status(_waiter_id uuid, _order_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rid uuid; v_owner uuid;
BEGIN
  IF _status NOT IN ('pending','preparing','ready','done','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Waiter not found'; END IF;
  SELECT waiter_id INTO v_owner FROM public.orders WHERE id = _order_id AND restaurant_id = v_rid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_owner IS NOT NULL AND v_owner <> _waiter_id THEN
    RAISE EXCEPTION 'Order belongs to another waiter';
  END IF;
  UPDATE public.orders SET
    status = _status,
    waiter_id = COALESCE(waiter_id, _waiter_id),
    updated_at = now()
  WHERE id = _order_id;
END;
$$;

-- Waiter: history summary for owner filter (waiter_id + date range)
CREATE OR REPLACE FUNCTION public.waiter_history(_restaurant_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(
  waiter_id uuid,
  waiter_name text,
  orders_count bigint,
  total_sales numeric,
  total_tips numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name,
    COUNT(o.id) AS orders_count,
    COALESCE(SUM(o.total), 0) AS total_sales,
    COALESCE(SUM(o.tip_amount), 0) AS total_tips
  FROM public.waiters w
  LEFT JOIN public.orders o
    ON o.waiter_id = w.id
   AND o.created_at >= COALESCE(_from, '-infinity'::timestamptz)
   AND o.created_at <= COALESCE(_to, 'infinity'::timestamptz)
   AND o.deleted_at IS NULL
  WHERE w.restaurant_id = _restaurant_id
    AND public.is_restaurant_owner(_restaurant_id)
  GROUP BY w.id, w.name
  ORDER BY w.name;
$$;

-- Waiter: currently active tables (owner view, realtime-friendly)
CREATE OR REPLACE FUNCTION public.waiter_active_tables(_restaurant_id uuid)
RETURNS TABLE(waiter_id uuid, waiter_name text, table_number text, order_id uuid, status text, total numeric, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, o.table_number, o.id, o.status, o.total, o.created_at
  FROM public.orders o
  JOIN public.waiters w ON w.id = o.waiter_id
  WHERE o.restaurant_id = _restaurant_id
    AND public.is_restaurant_owner(_restaurant_id)
    AND o.order_type = 'table'
    AND o.deleted_at IS NULL
    AND o.status IN ('pending','preparing','ready')
  ORDER BY o.created_at DESC;
$$;

-- Grant EXECUTE
REVOKE ALL ON FUNCTION public.waiter_login(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_from_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_logout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_create(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_update(uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_reset_password(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_tables(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_orders_for_table(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_update_order_status(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_history(uuid,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_active_tables(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.waiter_create(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_update(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_reset_password(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_history(uuid,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_active_tables(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.waiter_login(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiter_from_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiter_logout(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiter_tables(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiter_orders_for_table(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiter_update_order_status(uuid,uuid,text) TO service_role;
