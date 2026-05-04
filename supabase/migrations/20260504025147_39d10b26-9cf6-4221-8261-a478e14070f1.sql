GRANT EXECUTE ON FUNCTION public.is_restaurant_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_blocked(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;