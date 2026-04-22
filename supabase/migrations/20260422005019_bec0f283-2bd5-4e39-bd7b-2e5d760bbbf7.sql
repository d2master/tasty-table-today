-- Public-safe function to get Pix payment configuration for a restaurant by slug
CREATE OR REPLACE FUNCTION public.get_restaurant_pix_for_checkout(_slug text)
RETURNS TABLE (
  pix_enabled boolean,
  pix_key text,
  pix_key_type text,
  pix_recipient_name text,
  pix_city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.pix_enabled,
    CASE WHEN r.pix_enabled THEN r.pix_key ELSE NULL END,
    CASE WHEN r.pix_enabled THEN r.pix_key_type ELSE NULL END,
    CASE WHEN r.pix_enabled THEN r.pix_recipient_name ELSE NULL END,
    CASE WHEN r.pix_enabled THEN r.pix_city ELSE NULL END
  FROM public.restaurants r
  WHERE r.slug = _slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_pix_for_checkout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_pix_for_checkout(text) TO anon, authenticated;
