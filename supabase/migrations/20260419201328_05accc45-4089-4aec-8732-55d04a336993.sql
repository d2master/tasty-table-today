ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'table',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric,
  ADD COLUMN IF NOT EXISTS delivery_maps_url text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('table', 'delivery'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('pix', 'debito', 'credito', 'dinheiro'));