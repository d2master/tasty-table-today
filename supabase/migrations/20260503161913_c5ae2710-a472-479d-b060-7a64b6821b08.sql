
-- 1) Restaurants: restrict columns readable by anon/authenticated
-- Keep RLS policies, but enforce column-level grants so sensitive cols are unreachable via SELECT.
REVOKE SELECT ON public.restaurants FROM anon, authenticated;

GRANT SELECT (
  id, owner_id, name, slug, description, logo_url, is_blocked,
  pix_enabled, pix_recipient_name, pix_city,
  created_at, updated_at
) ON public.restaurants TO anon, authenticated;

-- Owners need full-row read for their own restaurant via SECURITY DEFINER RPCs (already in place).
-- Allow owners to UPDATE sensitive columns explicitly (already-existing grants preserved):
GRANT UPDATE (
  name, slug, description, logo_url,
  pix_enabled, pix_key, pix_key_type, pix_recipient_name, pix_city,
  pix_password, trash_password
) ON public.restaurants TO authenticated;

GRANT INSERT, DELETE ON public.restaurants TO authenticated;

-- 2) Storage: drop broad + broken policies, recreate correct ownership-scoped ones.
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete their product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update their product images" ON storage.objects;

CREATE POLICY "Restaurant owners can upload their product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Restaurant owners can update their product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete their product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);
