ALTER TABLE public.restaurants
ADD COLUMN pix_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN pix_key text,
ADD COLUMN pix_key_type text,
ADD COLUMN pix_recipient_name text,
ADD COLUMN pix_city text;

ALTER TABLE public.orders
ADD COLUMN payment_status text NOT NULL DEFAULT 'pending',
ADD COLUMN pix_copy_paste text,
ADD COLUMN pix_paid_at timestamptz;

ALTER TABLE public.restaurants
ADD CONSTRAINT restaurants_pix_key_type_check
CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random'));

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check
CHECK (payment_status IN ('pending', 'awaiting_pix', 'paid', 'failed'));

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_method = 'pix' THEN 'awaiting_pix'
  ELSE 'pending'
END
WHERE payment_status IS NULL OR payment_status = 'pending';