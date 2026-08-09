ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS observation text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.get_order_status(uuid);

CREATE OR REPLACE FUNCTION public.get_order_status(_order_id uuid)
 RETURNS TABLE(status text, payment_status text, table_number text, order_type text, created_at timestamp with time zone, updated_at timestamp with time zone, tip_enabled boolean, tip_amount numeric, total numeric, observation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT status, payment_status, table_number, order_type, created_at, updated_at, tip_enabled, tip_amount, total, observation
  FROM public.orders WHERE id = _order_id LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.waiter_orders_for_table(uuid, text);

CREATE OR REPLACE FUNCTION public.waiter_orders_for_table(_waiter_id uuid, _table_number text)
 RETURNS TABLE(id uuid, status text, total numeric, tip_enabled boolean, tip_amount numeric, waiter_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, observation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.status, o.total, o.tip_enabled, o.tip_amount, o.waiter_id, o.created_at, o.updated_at, o.observation
  FROM public.orders o
  JOIN public.waiters w ON w.id = _waiter_id
  WHERE o.restaurant_id = w.restaurant_id
    AND o.order_type = 'table'
    AND o.table_number = _table_number
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.waiter_orders_for_table(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_orders_for_table(uuid, text) TO service_role;