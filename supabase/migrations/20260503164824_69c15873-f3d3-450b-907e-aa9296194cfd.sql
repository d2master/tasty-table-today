
-- Helper that bypasses RLS to verify the order exists, is pending, and was just created
CREATE OR REPLACE FUNCTION public.can_insert_order_item(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND o.status = 'pending'
      AND o.created_at > (now() - interval '5 minutes')
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_insert_order_item(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create items for pending orders" ON public.order_items;

CREATE POLICY "Anyone can create items for pending orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_insert_order_item(order_id));
