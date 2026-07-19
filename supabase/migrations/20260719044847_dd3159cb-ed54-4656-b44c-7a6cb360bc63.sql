ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS owner_phone text;
GRANT UPDATE (owner_phone) ON public.restaurants TO authenticated;