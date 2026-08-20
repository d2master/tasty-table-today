ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS tip_percent numeric NOT NULL DEFAULT 10;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_tip_percent_range;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_tip_percent_range CHECK (tip_percent >= 0 AND tip_percent <= 100);

DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);
CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
 RETURNS TABLE(id uuid, name text, slug text, description text, logo_url text, is_blocked boolean, table_count integer, pix_enabled boolean, pix_recipient_name text, pix_city text, is_open boolean, closed_message text, service_mode text, delivery_payment_methods text[], tip_percent numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, slug, description, logo_url, is_blocked, table_count,
         pix_enabled, pix_recipient_name, pix_city, is_open, closed_message, service_mode, delivery_payment_methods, tip_percent
  FROM public.restaurants
  WHERE slug = _slug
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.waiter_close_bill(_waiter_id uuid, _order_id uuid, _tip_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rid uuid;
  v_owner uuid;
  v_subtotal numeric;
  v_tip numeric;
  v_pct numeric;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Waiter not found'; END IF;

  SELECT waiter_id INTO v_owner FROM public.orders
  WHERE id = _order_id AND restaurant_id = v_rid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_owner IS NOT NULL AND v_owner <> _waiter_id THEN
    RAISE EXCEPTION 'Order belongs to another waiter';
  END IF;

  SELECT COALESCE(tip_percent, 10) INTO v_pct FROM public.restaurants WHERE id = v_rid;

  SELECT COALESCE(SUM(price * quantity), 0) INTO v_subtotal
  FROM public.order_items WHERE order_id = _order_id;

  v_tip := CASE WHEN COALESCE(_tip_enabled, false) THEN round(v_subtotal * v_pct / 100, 2) ELSE 0 END;

  UPDATE public.orders SET
    tip_enabled = COALESCE(_tip_enabled, false),
    tip_amount = v_tip,
    total = v_subtotal + v_tip,
    status = 'done',
    waiter_id = COALESCE(waiter_id, _waiter_id),
    updated_at = now()
  WHERE id = _order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_restaurant_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.waiter_close_bill(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waiter_close_bill(uuid, uuid, boolean) TO service_role;