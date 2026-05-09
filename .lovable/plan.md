## Objetivo

Adicionar controle de estoque (quantidade disponível) por refeição. O lojista define a quantidade no cadastro/edição do produto; o cliente NÃO vê a quantidade, apenas vê o item como "indisponível" quando zerar. A cada pedido confirmado o estoque diminui automaticamente, e se o pedido for cancelado o estoque é reposto.

## Mudanças

### 1. Banco de dados (migration)
Na tabela `products`:
- `track_stock boolean NOT NULL DEFAULT false` — ativa o controle por produto.
- `stock_quantity integer NOT NULL DEFAULT 0` — quantidade atual disponível.

Na tabela `order_items`:
- (já existe `quantity` — usado para débito/crédito).

Funções/triggers:
- Atualizar a edge function `place-order` para, dentro da transação de criação do pedido, decrementar `stock_quantity` de cada produto com `track_stock = true`. Se algum item não tiver estoque suficiente, retorna erro 409 ("Produto X sem estoque suficiente") e nada é gravado.
- Criar função `restore_order_stock(_order_id uuid)` SECURITY DEFINER que soma de volta `quantity` no `stock_quantity` dos produtos com `track_stock = true`. 
- Criar trigger `AFTER UPDATE` em `orders`: se `status` mudou para `cancelled` (e o anterior não era `cancelled`), chama `restore_order_stock`. Garante reposição mesmo via dashboard.

### 2. Dashboard — formulário de produto (`src/pages/Dashboard.tsx` + `useProducts`)
- Adicionar no formulário de produto:
  - Switch "Controlar estoque deste item".
  - Quando ativo, campo numérico "Quantidade disponível".
- Mostrar badge "Sem estoque" no card do produto quando `track_stock && stock_quantity === 0`.
- Atualizar a interface `Product` em `src/hooks/useProducts.ts` com os novos campos.

### 3. Cardápio público (`src/pages/PublicMenu.tsx`)
- Tratar produto como indisponível quando `is_available === false` OU (`track_stock === true && stock_quantity === 0`).
- Nunca exibir o número da quantidade — apenas o estado "Indisponível" (mesmo visual já existente).
- No carrinho, limitar a quantidade selecionável ao `stock_quantity` quando `track_stock` estiver ativo (evita pedir mais do que existe).

### 4. Edge function `place-order`
- Após validar mesa/cliente bloqueado, ler os produtos do pedido com `track_stock` e `stock_quantity`.
- Para cada item com `track_stock`: validar `stock_quantity >= quantity`. Se faltar, abortar com 409.
- Decrementar via `UPDATE products SET stock_quantity = stock_quantity - X WHERE id = ... AND stock_quantity >= X` (atômico). Se nenhuma linha afetada, abortar e reverter.
- Manter geração client-side do UUID do pedido (constraint do projeto).

### 5. Comportamento de cancelamento
- Trigger no banco repõe estoque automaticamente quando status vira `cancelled`. Não há lógica adicional no frontend.
- Excluir pedido (lixeira / soft delete) NÃO repõe estoque — apenas o status `cancelled` repõe, conforme escolhido.

## Detalhes técnicos

- Tipos do Supabase serão regenerados automaticamente após a migration.
- O campo `stock_quantity` é numérico inteiro ≥ 0; UI valida.
- O switch "controlar estoque" é opcional — produtos antigos continuam com `track_stock = false` e funcionam exatamente como hoje.
- A reposição usa `quantity` salvo em `order_items` no momento do pedido, então alterações posteriores no produto não afetam a reposição.

## Resumo do impacto
- 1 migration (2 colunas em `products`, função + trigger de reposição).
- 1 edge function alterada (`place-order`).
- 3 arquivos de frontend: `useProducts.ts`, `Dashboard.tsx`, `PublicMenu.tsx`.