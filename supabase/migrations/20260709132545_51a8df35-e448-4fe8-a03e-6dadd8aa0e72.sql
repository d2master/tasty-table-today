
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tip_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_order_status(uuid);

CREATE OR REPLACE FUNCTION public.get_order_status(_order_id uuid)
 RETURNS TABLE(status text, payment_status text, table_number text, order_type text, created_at timestamp with time zone, updated_at timestamp with time zone, tip_enabled boolean, tip_amount numeric, total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT status, payment_status, table_number, order_type, created_at, updated_at, tip_enabled, tip_amount, total
  FROM public.orders WHERE id = _order_id LIMIT 1;
$function$;
