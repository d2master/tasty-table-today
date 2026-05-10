
CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  affected int;
  v_name text;
BEGIN
  -- Lock relevant product rows in a stable order to avoid deadlocks across concurrent calls.
  PERFORM 1
  FROM public.products
  WHERE id IN (
    SELECT (elem->>'product_id')::uuid
    FROM jsonb_array_elements(_items) elem
  )
  ORDER BY id
  FOR UPDATE;

  FOR rec IN
    SELECT (elem->>'product_id')::uuid AS pid,
           (elem->>'quantity')::int AS qty
    FROM jsonb_array_elements(_items) elem
  LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity - rec.qty
    WHERE id = rec.pid
      AND track_stock = true
      AND stock_quantity >= rec.qty;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
      -- Distinguish "untracked" (no-op, fine) from "insufficient stock" (fail).
      SELECT name INTO v_name FROM public.products
      WHERE id = rec.pid AND track_stock = true AND stock_quantity < rec.qty;
      IF FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_name;
      END IF;
      -- otherwise product is not tracked; skip silently
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_stock_for_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_stock_for_order(jsonb) TO service_role;
