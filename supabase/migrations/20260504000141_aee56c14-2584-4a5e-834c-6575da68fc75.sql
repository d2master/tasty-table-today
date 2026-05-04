
-- Remove direct anonymous inserts; checkout now goes through place-order edge function (service role)
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create items for pending orders" ON public.order_items;

-- Drop helper that's no longer used by RLS
DROP FUNCTION IF EXISTS public.can_insert_order_item(uuid);

-- Lock down SECURITY DEFINER helpers that should only be called server-side / by owners
REVOKE EXECUTE ON FUNCTION public.is_restaurant_owner(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_customer_blocked(uuid, text) FROM anon, authenticated, public;

-- Owner-only RPCs: only authenticated users need execute
REVOKE EXECUTE ON FUNCTION public.update_pix_settings_with_password(text, boolean, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_pix_password(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_restaurant_sensitive() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.permanent_delete_order_with_password(uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.update_pix_settings_with_password(text, boolean, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pix_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_restaurant_sensitive() TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_order_with_password(uuid, text) TO authenticated;

-- Pix checkout RPC no longer needed by client (handled in edge function)
REVOKE EXECUTE ON FUNCTION public.get_restaurant_pix_for_checkout(text) FROM anon, authenticated, public;
