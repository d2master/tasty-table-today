## Objetivo

1. A lanchonete define **quantas mesas** existem no local.
2. No cardápio público, o cliente **só seleciona mesas disponíveis** (não pode digitar número livre).
3. O cliente **acompanha o status do seu pedido** dentro do cardápio em tempo real.
4. Uma mesa fica **ocupada** enquanto houver pedido ativo, e só é liberada quando a lanchonete **finaliza** (status `done` ou `cancelled`) — o cliente NÃO finaliza.

---

## Mudanças no banco

**Nova coluna em `restaurants`:**
- `table_count integer NOT NULL DEFAULT 0` — quantidade total de mesas configuradas pela lanchonete.

**Função pública `get_available_tables(_slug text)`** (SECURITY DEFINER, executável por anon):
- Retorna a lista de números de mesa de 1 até `table_count` com flag `is_occupied`.
- Uma mesa é considerada ocupada se existe um pedido com `order_type='table'`, `deleted_at IS NULL` e `status IN ('pending','preparing')` para aquela mesa.

**Função pública `get_order_status(_order_id uuid)`** (SECURITY DEFINER, anon):
- Retorna `{ status, payment_status, created_at, updated_at, table_number }` para que o cliente acompanhe sem expor dados sensíveis de outros pedidos. Apenas a linha do `_order_id` informado.

**Realtime:** `orders` já está em uso via realtime para o dashboard. Não exporemos realtime para anon — o cliente fará polling leve a cada 5s via `get_order_status` (mais seguro, sem precisar abrir RLS de SELECT em `orders` para anon).

**Edge function `place-order`:** validar que, para `order_type='table'`, o `table_number` enviado:
- é um inteiro entre 1 e `restaurants.table_count`;
- a mesa não está ocupada por outro pedido ativo.
Se ocupada → retorna 409 com mensagem clara.

---

## Mudanças na lanchonete (Dashboard)

**Aba "Configurações" (ou seção no topo da aba Pedidos):**
- Campo "Quantidade de mesas no local" + botão Salvar (atualiza `restaurants.table_count`).
- Texto explicativo: "As mesas serão numeradas de 1 a N. Uma mesa só fica disponível para novo pedido após você marcar o pedido atual como Finalizado."

**Aba Pedidos:**
- Já existe botão para mudar status para "Finalizado". Manteremos. Reforço visual: pedidos `pending`/`preparing` mostram badge "Mesa X ocupada".
- O botão **"Mover para lixeira"** continuará disponível, mas só liberará a mesa quando o status for `done` ou `cancelled` (lixeira por si só também libera, pois `deleted_at` deixa de ser NULL — ajustaremos a query de ocupação para considerar `deleted_at IS NULL` apenas como filtro de existência; um pedido na lixeira não ocupa).

---

## Mudanças no Cardápio Público (PublicMenu)

**Seleção de mesa:**
- Substituir o `Input` livre de número de mesa por um **grid de botões** com as mesas 1..N.
- Mesas ocupadas aparecem desabilitadas com badge "Ocupada".
- Carrega via `supabase.rpc('get_available_tables', { _slug })` no mount e refaz polling a cada 10s enquanto o carrinho está aberto.
- Se `table_count = 0`, exibe aviso: "A lanchonete ainda não configurou mesas. Faça pedido por delivery."

**Acompanhamento do pedido:**
- Após `place-order` retornar sucesso, salvar `order_id` em `localStorage` (chave `active_order_<slug>`) junto com `table_number`.
- Adicionar componente `OrderTracker` fixo (rodapé/topo) que aparece sempre que existir pedido ativo no localStorage.
- Polling a cada 5s em `get_order_status`. Mostra timeline:
  - Pendente → Em preparo → Finalizado
  - Quando status == `done` ou `cancelled`: mostra mensagem final ("Pedido finalizado pela lanchonete — obrigado!" / "Pedido cancelado") e oferece botão "Fechar acompanhamento" que limpa o localStorage.
- O cliente **não** tem botão para finalizar — apenas a lanchonete.

---

## Segurança

- Novas funções `get_available_tables` e `get_order_status` são `SECURITY DEFINER`, retornam apenas o estritamente necessário e não expõem dados de outros pedidos / clientes.
- `GRANT EXECUTE ... TO anon, authenticated` em ambas.
- RLS de `orders` continua restrita a donos — o anon só vê via RPC pelo `order_id` que ele próprio possui.
- `place-order` valida atomicamente a ocupação da mesa antes de inserir, evitando colisão.
- Atualização do `@security-memory` listando as duas novas funções públicas e o motivo (UX de mesas e tracking de pedido).

---

## Detalhes técnicos

**Migration SQL (resumo):**
```sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS table_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_available_tables(_slug text)
RETURNS TABLE(table_number integer, is_occupied boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH r AS (SELECT id, table_count FROM restaurants WHERE slug = _slug LIMIT 1),
  occ AS (
    SELECT DISTINCT o.table_number
    FROM orders o JOIN r ON o.restaurant_id = r.id
    WHERE o.order_type = 'table'
      AND o.deleted_at IS NULL
      AND o.status IN ('pending','preparing')
  )
  SELECT gs::int, EXISTS(SELECT 1 FROM occ WHERE occ.table_number = gs::text)
  FROM r, generate_series(1, r.table_count) gs;
$$;

CREATE OR REPLACE FUNCTION public.get_order_status(_order_id uuid)
RETURNS TABLE(status text, payment_status text, table_number text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT status, payment_status, table_number, created_at, updated_at
  FROM orders WHERE id = _order_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_tables(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated;
```

**Arquivos a alterar:**
- `supabase/migrations/<novo>.sql` — alterações acima.
- `supabase/functions/place-order/index.ts` — validar mesa contra `table_count` + ocupação.
- `src/pages/Dashboard.tsx` — campo "Quantidade de mesas" + salvar via update em `restaurants` (RLS de owner já cobre).
- `src/pages/PublicMenu.tsx` — grid de mesas + componente `OrderTracker` com polling + persistência no localStorage.
- `src/hooks/useRestaurant.ts` — incluir `table_count` no select e mutation `updateTableCount`.
