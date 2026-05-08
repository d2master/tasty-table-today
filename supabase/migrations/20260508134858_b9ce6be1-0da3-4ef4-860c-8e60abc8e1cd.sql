CREATE OR REPLACE FUNCTION public.get_available_tables(_slug text)
 RETURNS TABLE(table_number integer, is_occupied boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT id, table_count FROM public.restaurants WHERE slug = _slug LIMIT 1
  ),
  occ AS (
    SELECT DISTINCT o.table_number AS tn
    FROM public.orders o
    JOIN r ON o.restaurant_id = r.id
    WHERE o.order_type = 'table'
      AND o.deleted_at IS NULL
      AND o.status IN ('pending','preparing','ready')
  )
  SELECT gs::int AS table_number,
         EXISTS (SELECT 1 FROM occ WHERE occ.tn = gs::text) AS is_occupied
  FROM r, generate_series(1, r.table_count) gs;
$function$;