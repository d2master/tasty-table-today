REVOKE EXECUTE ON FUNCTION public.restore_order_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_restore_stock_on_cancel() FROM PUBLIC, anon, authenticated;