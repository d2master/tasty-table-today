
-- Add trash password to restaurants
ALTER TABLE public.restaurants ADD COLUMN trash_password text DEFAULT null;

-- Add soft delete column to orders
ALTER TABLE public.orders ADD COLUMN deleted_at timestamp with time zone DEFAULT null;

-- Allow owners to delete orders permanently
CREATE POLICY "Owners can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (is_restaurant_owner(restaurant_id));
