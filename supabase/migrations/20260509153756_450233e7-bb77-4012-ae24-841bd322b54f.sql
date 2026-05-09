
-- Remove the policy that allowed anyone to SELECT all columns of restaurants
DROP POLICY IF EXISTS "Public can view safe restaurant fields" ON public.restaurants;

-- Safe public accessor: returns only non-sensitive fields by slug
CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  is_blocked boolean,
  table_count integer,
  pix_enabled boolean,
  pix_recipient_name text,
  pix_city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, description, logo_url, is_blocked, table_count,
         pix_enabled, pix_recipient_name, pix_city
  FROM public.restaurants
  WHERE slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(text) TO anon, authenticated;
