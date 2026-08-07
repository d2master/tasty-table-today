## Objetivo

Transformar a aba **"Mesas"** do painel da lanchonete em um mapa visual do salão, com todas as mesas em ícones quadrados coloridos por status, ocupadas em cima e livres embaixo, mostrando garçom, cliente e pedidos de cada mesa.

## Como o painel vai funcionar

Duas seções, na ordem:

1. **Mesas ocupadas** — mesas com pedido ativo (pendente, em preparo ou pronto).
2. **Mesas livres** — todas as demais mesas até a quantidade configurada.

Cada mesa é um card quadrado com o número grande, o status e a cor correspondente:

| Situação do pedido da mesa | Rótulo no card | Cor |
| --- | --- | --- |
| Pedido recém-criado | Pendente | âmbar/aviso |
| Marcado "Em preparo" | Em preparo | azul/info |
| Marcado "Pronto" | Ocupada | laranja/destaque |
| Finalizado ou cancelado (ou sem pedido) | Livre | verde suave / neutro |

A mesa volta a ficar **Livre** automaticamente quando o pedido é finalizado ou cancelado — tanto pelo painel da lanchonete quanto pelo "Fechar conta" do garçom (que já marca o pedido como finalizado).

## Informações de cada mesa

No card ocupado: número da mesa, status, nome do cliente, nome do garçom que está atendendo (quando houver), horário de abertura e total.

Ao clicar na mesa, abre um painel de detalhes com:
- Cliente e garçom
- Lista de pedidos ativos daquela mesa com status e total
- Itens de cada pedido (quantidade, nome, preço)
- Indicação de gorjeta de 10%, quando aplicada

A configuração atual de "Quantidade de mesas" continua na mesma aba, abaixo do mapa.

## Atualização em tempo real

O painel escuta as mudanças da tabela de pedidos e recalcula o mapa imediatamente, sem recarregar a página.

## Detalhes técnicos

- Novo componente `src/components/dashboard/TablesTab.tsx`, usado na aba `tables` do `Dashboard.tsx`; o bloco de quantidade de mesas é movido para dentro dele (props: `restaurantId`, `tableCount`, e os handlers de salvar quantidade já existentes).
- Sem alterações no banco: usa `orders` (colunas `table_number`, `status`, `customer_name`, `waiter_id`, `total`, `tip_amount`, `created_at`, `deleted_at`) e `waiters` (`id`, `name`), ambos já legíveis pelo dono via RLS; itens via `order_items` (policy de dono já existente).
- Mesas ocupadas = pedidos com `order_type = 'table'`, `deleted_at is null` e `status in ('pending','preparing','ready')`, agrupados por `table_number`. Quando uma mesa tem vários pedidos ativos, o status exibido é o mais avançado.
- Cores via tokens semânticos já definidos (`warning`, `info`, `accent`, `success`, `muted`) — sem cores hardcoded.
- Realtime: canal `postgres_changes` em `orders` filtrado por `restaurant_id`, criado dentro de `useEffect` com cleanup via `supabase.removeChannel`.

```text
[ Mesas ocupadas ]
 ┌────┐ ┌────┐ ┌────┐
 │ 3  │ │ 7  │ │ 12 │   3 = Em preparo (azul)
 │Prep│ │Ocup│ │Pend│   7 = Ocupada (laranja)
 └────┘ └────┘ └────┘  12 = Pendente (âmbar)

[ Mesas livres ]
 ┌────┐ ┌────┐ ┌────┐ ...
 │ 1  │ │ 2  │ │ 4  │
 └────┘ └────┘ └────┘
```
