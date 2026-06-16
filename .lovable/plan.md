# Acompanhamento de pedido com itens + adicionar mais (mesa)

Hoje a tela de acompanhamento mostra só o status. Vamos exibir também a lista do que foi pedido e, no caso de pedido na mesa, permitir adicionar mais itens ao mesmo pedido (sem remover o que já foi pedido). No delivery, fica só leitura.

## O que muda

### 1. Banco — nova função pública para listar itens
Criar RPC `get_order_items_public(_order_id uuid)` (SECURITY DEFINER) que devolve `product_name`, `quantity`, `price` do pedido. Hoje as policies de `order_items` só liberam leitura ao dono do restaurante; o cliente anônimo precisa dessa função para ver o que pediu.

### 2. Edge function `place-order` — modo "anexar itens"
Aceitar um campo opcional `append_to_order_id`. Quando vier:
- Carrega o pedido existente, valida que pertence ao mesmo restaurante (pelo slug), que `order_type = 'table'`, que `deleted_at IS NULL` e que `status` é `pending`, `preparing` ou `ready`.
- Pula a checagem de mesa ocupada (a mesa já é desse pedido).
- Insere os novos `order_items` com o mesmo `order_id`, chama `decrement_stock_for_order` normalmente.
- Atualiza `orders.total = total + valor_dos_novos_itens` e `updated_at = now()`.
- Não gera novo Pix nem cria pedido novo. Retorna `{ order_id, total }` (o já existente, agora com novo total).

Pedidos de delivery NÃO podem usar `append_to_order_id` — retorna erro.

### 3. `PublicMenu.tsx` — tela de acompanhamento
Dentro do drawer "Seu pedido", além do progresso atual:
- Buscar itens via `get_order_items_public` ao abrir e a cada poll de status (mesmo intervalo de 5s).
- Listar cada item com `quantidade × nome — R$ preço` e mostrar o `total` do pedido.
- **Pedido de mesa**, enquanto status estiver em `pending` / `preparing` / `ready`:
  - Botão **"Adicionar mais itens"** que fecha o tracker e volta ao cardápio em modo "anexar" (uma flag `appendMode` com o `order_id` alvo).
  - No carrinho, quando em `appendMode`: o cabeçalho vira "Adicionar ao pedido #XXXX — Mesa Y", esconde formulário de nome/mesa/observação/pagamento, e o botão de enviar chama `place-order` com `append_to_order_id`. Após sucesso, limpa o carrinho, sai do `appendMode` e reabre o tracker (que já vai recarregar itens).
  - Nenhum botão de remover itens já enviados (apenas leitura para o que existe).
- **Pedido de delivery**: lista de itens visível, sem botão de adicionar.
- Quando `status` é `done` ou `cancelled`: esconder botão de adicionar.

## Detalhes técnicos

- A RPC nova é `STABLE SECURITY DEFINER SET search_path = public`, retorna apenas campos não sensíveis (`product_name`, `quantity`, `price`).
- O insert dos novos `order_items` continua sendo feito pela edge function com `service_role`, mantendo a regra do projeto de não usar `.select()` após insert em fluxo público.
- `appendMode` é estado local em `PublicMenu` (`{ orderId: string; tableNumber: string } | null`); não persistir em localStorage (se o cliente recarregar, simplesmente volta ao tracker normal).
- Validação no front: antes de mostrar o botão "Adicionar mais itens", checar `activeOrder.order_type === 'table'` e que `orderStatus.status` ∈ {pending, preparing, ready}.
- A edge function precisa rejeitar com mensagem clara se o pedido alvo for de delivery, estiver finalizado/cancelado, deletado, ou pertencer a outro restaurante.

## Arquivos afetados

- Migração nova: cria `get_order_items_public`.
- `supabase/functions/place-order/index.ts`: suporte a `append_to_order_id`.
- `src/pages/PublicMenu.tsx`: fetch dos itens, render no tracker, modo "anexar" no carrinho, botão de adicionar mais.
- `src/integrations/supabase/types.ts`: regenerado após a migração.
