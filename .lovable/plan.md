## Objetivo

Criar um sistema de garçons onde:
- A lanchonete cadastra usuário/senha de cada garçom.
- O garçom entra em `/garcom/login`, escolhe mesas livres para atender, cria pedidos e acompanha em tempo real.
- A lanchonete tem uma nova aba **"Garçom"** com CRUD de garçons e histórico completo (com filtro por período) das mesas atendidas e gorjetas.

## Modelo de dados (migration)

Nova tabela `waiters` (por lanchonete):
- `restaurant_id`, `username` (único por lanchonete), `password_hash`, `name`, `is_active`

Alterações em `orders`:
- `waiter_id` (uuid, nullable) — garçom que atendeu (só para pedidos de mesa).

Nova tabela `waiter_sessions` para o login com token opaco (usuário+senha simples, sem Supabase Auth):
- `id`, `waiter_id`, `token` (uuid), `expires_at`.

Grants + RLS: dados só acessíveis via RPCs `SECURITY DEFINER` (nenhum acesso direto do anon). Owner da lanchonete pode ler/gerenciar via policies com `is_restaurant_owner`.

## Edge functions

- `waiter-auth` — login (usuário+senha por slug da lanchonete), retorna `token`. Também `logout`, `me`.
- `waiter-claim-table` — garçom assume mesa livre; grava vínculo em memória de sessão + próximo pedido daquela mesa recebe `waiter_id`.
- `waiter-place-order` — cria pedido em nome do cliente na mesa atendida (reaproveita lógica do `place-order`, marca `waiter_id`).
- `waiter-update-status` — permite mover pedido para `ready` / `done` (só nas mesas do garçom).
- Ajuste em `place-order`: aceita `waiter_id` quando pedido vem via garçom.

Autenticação: header `x-waiter-token` validado contra `waiter_sessions`.

## Frontend

Rotas novas em `src/App.tsx`:
- `/garcom/login` → `WaiterLogin.tsx` (input usuário, senha, slug da lanchonete).
- `/garcom` → `WaiterDashboard.tsx` (protegido por token no `localStorage`).

**WaiterDashboard** (mobile-first):
- Aba "Mesas": grid das mesas — livres (assumir), minhas (abrir), ocupadas por outro garçom (bloqueadas).
- Ao abrir uma mesa: lista de pedidos com status, botão "Marcar pronto/entregue", botão "Adicionar itens" (abre mini-cardápio com categorias/produtos e envia via `waiter-place-order`).
- Notificação sonora + toast quando pedido de uma mesa dele muda para `ready` (realtime).

**Aba "Garçom" no Dashboard da lanchonete** (`src/pages/Dashboard.tsx`):
- Lista de garçons com criar/editar/ativar/desativar/resetar senha.
- Cada garçom: mesas ativas agora (tempo real), total de vendas e gorjetas.
- Filtro por período (data início/fim) mostrando histórico de mesas atendidas, valor total e gorjetas.

## Segurança

- Senha do garçom armazenada com hash (pgcrypto `crypt` + `gen_salt('bf')`).
- Nenhum grant direto em `waiters`/`waiter_sessions` para `anon`/`authenticated`; tudo passa por RPC ou edge function usando service role.
- Token de sessão do garçom expira em 12h e é renovado a cada requisição.
- Owner só enxerga/gerencia garçons da própria lanchonete (policies via `is_restaurant_owner`).

## Detalhes técnicos

```text
Fluxo login garçom:
[/garcom/login] --(slug, user, senha)--> waiter-auth
   -> valida hash, cria waiter_sessions row
   -> retorna { token, waiter: {id, name, restaurant_id, slug} }
   -> client salva em localStorage e vai para /garcom
```

- `waiter_id` em `orders` também aparece no dashboard atual da lanchonete (badge "Garçom: X") sem quebrar layouts existentes.
- Realtime já habilitado em `orders`; painel do garçom usa mesmo canal filtrando por `waiter_id`.

## Entregáveis por etapa

1. Migration: tabelas `waiters`, `waiter_sessions`, coluna `orders.waiter_id`, RPCs `waiter_login`, `waiter_validate_token`, policies e grants.
2. Edge functions: `waiter-auth`, `waiter-claim-table`, `waiter-place-order`, `waiter-update-status`; ajuste em `place-order`.
3. Frontend garçom: `WaiterLogin.tsx`, `WaiterDashboard.tsx`, hook `useWaiterSession`.
4. Frontend lanchonete: nova aba "Garçom" em `Dashboard.tsx` com CRUD + histórico filtrável.
5. Link visível em `/login` (ou na Home) para "Entrar como garçom".