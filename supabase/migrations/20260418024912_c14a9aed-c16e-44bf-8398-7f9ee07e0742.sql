-- Garantir que só existe 1 admin: índice único sobre presença
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_singleton_idx ON public.admin_users ((true));

-- Política: admins podem ver todos restaurantes (já existe RLS de SELECT public, mas reforçamos para garantir)
-- (já existem políticas de update p/ admin)

-- Política: admins podem ver todos os pedidos (opcional)
DROP POLICY IF EXISTS "Admins can view all restaurants update" ON public.restaurants;