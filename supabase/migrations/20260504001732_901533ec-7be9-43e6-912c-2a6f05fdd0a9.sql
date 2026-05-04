-- Remove direct DELETE on orders so the trash password RPC is the only deletion path
DROP POLICY IF EXISTS "Owners can delete orders" ON public.orders;