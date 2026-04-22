-- Restore SELECT grants on safe columns of restaurants for anon and authenticated.
-- RLS policies already restrict row visibility; column grants control which columns can be read.
-- Sensitive columns (trash_password, pix_key, pix_key_type) are intentionally excluded.

GRANT SELECT (
  id,
  owner_id,
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

-- Owners also need to write these columns through the table (RLS still applies).
GRANT INSERT, UPDATE ON public.restaurants TO authenticated;
GRANT DELETE ON public.restaurants TO authenticated;

-- Allow owners to write sensitive columns via UPDATE (RLS restricts to owner).
GRANT UPDATE (trash_password, pix_key, pix_key_type, pix_enabled, pix_recipient_name, pix_city) ON public.restaurants TO authenticated;