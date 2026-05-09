ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.restore_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET stock_quantity = p.stock_quantity + oi.quantity
  FROM public.order_items oi
  WHERE oi.order_id = _order_id
    AND oi.product_id = p.id
    AND p.track_stock = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    PERFORM public.restore_order_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_restore_stock_on_cancel ON public.orders;
CREATE TRIGGER orders_restore_stock_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_restore_stock_on_cancel();