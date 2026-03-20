
ALTER TABLE public.orders ADD COLUMN table_number text NOT NULL DEFAULT '';
ALTER TABLE public.orders ALTER COLUMN customer_name SET DEFAULT '';
ALTER TABLE public.orders ALTER COLUMN customer_phone SET DEFAULT '';
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;
