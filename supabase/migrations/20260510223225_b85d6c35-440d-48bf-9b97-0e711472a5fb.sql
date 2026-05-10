ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS closed_message text NOT NULL DEFAULT 'Estamos fechados no momento. Volte em breve!';

DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
 RETURNS TABLE(id uuid, name text, slug text, description text, logo_url text, is_blocked boolean, table_count integer, pix_enabled boolean, pix_recipient_name text, pix_city text, is_open boolean, closed_message text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, slug, description, logo_url, is_blocked, table_count,
         pix_enabled, pix_recipient_name, pix_city, is_open, closed_message
  FROM public.restaurants
  WHERE slug = _slug
  LIMIT 1;
$function$;