

## Plano: Painel de Administração para Gerenciar Lanchonetes

### Objetivo
Criar uma página de administração protegida onde você (super admin) pode ver todas as lanchonetes cadastradas, com nome, email do dono, e pode bloquear/desbloquear qualquer uma.

### Alterações no Banco de Dados

1. **Adicionar coluna `is_blocked` na tabela `restaurants`** — booleano, default `false`
2. **Criar tabela `admin_users`** — armazena os IDs dos usuários que são administradores da plataforma (separado da tabela de perfis, seguindo boas práticas de segurança)
3. **Criar função `is_platform_admin()`** — security definer function para verificar se o usuário logado é admin
4. **Criar política RLS** na `restaurants` para permitir que admins vejam todas as lanchonetes
5. **Criar política RLS** na `admin_users` para leitura apenas por admins

### Alterações no Frontend

1. **Nova página `src/pages/Admin.tsx`** — tabela listando todas as lanchonetes com:
   - Nome da lanchonete
   - Email do dono (obtido via uma edge function que consulta `auth.users`)
   - Data de cadastro
   - Status (ativa/bloqueada)
   - Botão bloquear/desbloquear
2. **Nova rota `/admin`** em `App.tsx`
3. **Edge function `get-admin-data`** — necessária para buscar emails dos donos (a tabela `auth.users` não é acessível pelo client SDK)
4. **Bloqueio efetivo** — No `PublicMenu.tsx` e `Dashboard.tsx`, verificar se o restaurante está bloqueado e mostrar mensagem apropriada

### Segurança

- Apenas usuários na tabela `admin_users` terão acesso ao painel
- A edge function validará que o chamador é admin antes de retornar dados
- O campo `is_blocked` impedirá o cardápio público de funcionar e o dashboard do dono

### Fluxo
```text
Admin acessa /admin → Verifica se é admin → Lista lanchonetes com email/nome/status → Pode bloquear/desbloquear
```

### Inserção do primeiro admin
Após a migration, será necessário inserir manualmente seu user_id na tabela `admin_users` para ter acesso inicial.

