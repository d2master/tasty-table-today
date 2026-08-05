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
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.waiters WHERE id = _waiter_id;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Waiter not found'; END IF;

  SELECT waiter_id INTO v_owner FROM public.orders
  WHERE id = _order_id AND restaurant_id = v_rid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_owner IS NOT NULL AND v_owner <> _waiter_id THEN
    RAISE EXCEPTION 'Order belongs to another waiter';
  END IF;

  SELECT COALESCE(SUM(price * quantity), 0) INTO v_subtotal
  FROM public.order_items WHERE order_id = _order_id;

  v_tip := CASE WHEN COALESCE(_tip_enabled, false) THEN round(v_subtotal * 0.10, 2) ELSE 0 END;

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

REVOKE ALL ON FUNCTION public.waiter_close_bill(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_close_bill(uuid, uuid, boolean) TO service_role;