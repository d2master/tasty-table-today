ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS table_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_available_tables(_slug text)
RETURNS TABLE(table_number integer, is_occupied boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT id, table_count FROM public.restaurants WHERE slug = _slug LIMIT 1
  ),
  occ AS (
    SELECT DISTINCT o.table_number AS tn
    FROM public.orders o
    JOIN r ON o.restaurant_id = r.id
    WHERE o.order_type = 'table'
      AND o.deleted_at IS NULL
      AND o.status IN ('pending','preparing')
  )
  SELECT gs::int AS table_number,
         EXISTS (SELECT 1 FROM occ WHERE occ.tn = gs::text) AS is_occupied
  FROM r, generate_series(1, r.table_count) gs;
$$;

CREATE OR REPLACE FUNCTION public.get_order_status(_order_id uuid)
RETURNS TABLE(
  status text,
  payment_status text,
  table_number text,
  order_type text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status, payment_status, table_number, order_type, created_at, updated_at
  FROM public.orders WHERE id = _order_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_tables(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated;