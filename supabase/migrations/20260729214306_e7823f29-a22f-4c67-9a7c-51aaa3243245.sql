REVOKE ALL ON FUNCTION public.waiter_login(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiter_login(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.waiter_login(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_login(text, text, text) TO service_role;