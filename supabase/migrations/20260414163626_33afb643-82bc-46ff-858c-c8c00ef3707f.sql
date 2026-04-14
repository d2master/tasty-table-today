
-- Table to track blocked customers by phone number
CREATE TABLE public.blocked_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  customer_phone text NOT NULL,
  reason text DEFAULT '',
  blocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_phone)
);

ALTER TABLE public.blocked_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view blocked customers"
ON public.blocked_customers FOR SELECT
TO authenticated
USING (is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can block customers"
ON public.blocked_customers FOR INSERT
TO authenticated
WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can unblock customers"
ON public.blocked_customers FOR DELETE
TO authenticated
USING (is_restaurant_owner(restaurant_id));

-- Function to check if a customer phone is blocked for a restaurant
CREATE OR REPLACE FUNCTION public.is_customer_blocked(_restaurant_id uuid, _phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_customers
    WHERE restaurant_id = _restaurant_id
      AND customer_phone = _phone
  )
$$;
