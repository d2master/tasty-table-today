-- =========================================================
-- 1) Restrict public access to sensitive restaurant columns
-- =========================================================
-- Drop the overly broad public SELECT policy
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;

-- Revoke broad SELECT and grant only safe columns to anon/authenticated
REVOKE SELECT ON public.restaurants FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  slug,
  description,
  logo_url,
  is_blocked,
  pix_enabled,
  pix_recipient_name,
  pix_city,
  created_at,
  updated_at
) ON public.restaurants TO anon, authenticated;

-- Re-add a public SELECT RLS policy (column privileges above will gate which columns are visible)
CREATE POLICY "Public can view safe restaurant fields"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (true);

-- Owners (and platform admins) keep full SELECT on all columns
CREATE POLICY "Owners can view all their restaurant fields"
ON public.restaurants
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_platform_admin());

-- Owner full-row visibility requires SELECT on all columns; grant ALL to authenticated owners via column-less grant
-- We grant SELECT on every column to authenticated; RLS will ensure only owner sees sensitive ones via policy above.
-- But since column grants are union'd, granting all columns to authenticated would re-expose to public-authenticated.
-- Solution: use a SECURITY DEFINER function for owners to fetch sensitive fields instead.

CREATE OR REPLACE FUNCTION public.get_my_restaurant_sensitive()
RETURNS TABLE (
  id uuid,
  trash_password text,
  pix_key text,
  pix_key_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, trash_password, pix_key, pix_key_type
  FROM public.restaurants
  WHERE owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_restaurant_sensitive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_restaurant_sensitive() TO authenticated;

-- =========================================================
-- 2) Server-side trash password verification
-- =========================================================
-- Function that verifies trash password and permanently deletes order in one server-side call
CREATE OR REPLACE FUNCTION public.permanent_delete_order_with_password(
  _order_id uuid,
  _password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_trash_password text;
BEGIN
  SELECT o.restaurant_id INTO v_restaurant_id
  FROM public.orders o
  WHERE o.id = _order_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Caller must own the restaurant
  IF NOT public.is_restaurant_owner(v_restaurant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT r.trash_password INTO v_trash_password
  FROM public.restaurants r
  WHERE r.id = v_restaurant_id;

  IF v_trash_password IS NULL OR v_trash_password = '' THEN
    RAISE EXCEPTION 'Trash password not configured';
  END IF;

  IF _password IS DISTINCT FROM v_trash_password THEN
    RAISE EXCEPTION 'Invalid password';
  END IF;

  DELETE FROM public.orders WHERE id = _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.permanent_delete_order_with_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanent_delete_order_with_password(uuid, text) TO authenticated;

-- =========================================================
-- 3) Restrict order_items insert to brand-new pending orders
-- =========================================================
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Anyone can create items for pending orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.status = 'pending'
      AND o.created_at > now() - interval '5 minutes'
  )
);

-- =========================================================
-- 4) Storage: enforce ownership on product-images updates/deletes
-- =========================================================
-- Files are expected to be stored under "<restaurant_id>/..." prefix
DROP POLICY IF EXISTS "Owners can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;

CREATE POLICY "Restaurant owners can update their product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete their product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(name))[1]
  )
);
