## Objetivo
Permitir que clientes de pedidos em **mesa** escolham adicionar 10% de gorjeta do garçom sobre o total do pedido. Delivery não terá essa opção.

## Comportamento
- No checkout de mesa, mostrar um toggle "Adicionar 10% do garçom" com o valor calculado exibido.
- Total exibido atualiza dinamicamente (subtotal + 10% se marcado).
- O valor da gorjeta é registrado no pedido e visível no dashboard da lanchonete e na tela de acompanhamento do cliente.
- Ao adicionar mais itens em um pedido de mesa existente (append), a gorjeta é recalculada sobre o novo subtotal se o pedido original tinha gorjeta ativa.
- Delivery: sem alteração — nenhuma opção de gorjeta aparece.

## Alterações

### Banco (migration)
- `orders`: adicionar
  - `tip_enabled boolean NOT NULL DEFAULT false`
  - `tip_amount numeric(10,2) NOT NULL DEFAULT 0`
- `total` continua sendo o valor final cobrado (subtotal + gorjeta), para não quebrar relatórios existentes.
- Atualizar `get_order_status` (RPC) para retornar `tip_enabled` e `tip_amount`.

### Edge function `place-order`
- Aceitar `tip_enabled: boolean` no schema Zod (opcional, default false).
- Só considerar `tip_enabled=true` quando `order_type === "table"`; ignorar em delivery.
- Calcular `subtotal = soma(items)`, `tip_amount = tip_enabled ? round(subtotal * 0.10, 2) : 0`, `total = subtotal + tip_amount`.
- Recalcular Pix payload com `total` incluindo gorjeta.
- Modo append: se o pedido existente tinha `tip_enabled=true`, recalcular gorjeta sobre o novo subtotal completo e atualizar `tip_amount` + `total`.

### Frontend

**`src/pages/PublicMenu.tsx`**
- No drawer de checkout, quando `order_type === "table"`, mostrar bloco:
  - Checkbox "Adicionar 10% do garçom (opcional)"
  - Linhas: Subtotal, 10% garçom (se marcado), Total
- Enviar `tip_enabled` para o edge function.
- Drawer de acompanhamento: exibir "10% garçom: R$ X,XX" quando aplicável, além do total.

**`src/pages/Dashboard.tsx`**
- Nos cards/listas de pedidos, quando `tip_amount > 0`, exibir uma linha "10% garçom: R$ X,XX" junto ao total.

**`src/hooks/useOrders.ts`**
- Adicionar `tip_enabled` e `tip_amount` ao tipo `Order`.

## Detalhes técnicos
- Arredondamento: `Math.round(subtotal * 10) / 100` no servidor (fonte da verdade). Cliente só exibe estimativa.
- Não confiar em valor de gorjeta enviado pelo cliente — sempre recalcular no edge function.
- Pedidos antigos (sem gorjeta) permanecem com `tip_enabled=false` e `tip_amount=0` via default.
