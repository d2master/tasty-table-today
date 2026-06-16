CREATE OR REPLACE FUNCTION public.get_order_items_public(_order_id uuid)
RETURNS TABLE(product_name text, quantity integer, price numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_name, quantity, price
  FROM public.order_items
  WHERE order_id = _order_id
  ORDER BY product_name;
$$;