# Impressão de cupom em impressora térmica (80mm)

Objetivo: quando a lanchonete recebe um pedido, sair no papel um cupom com todas as informações — manualmente por botão e, opcionalmente, de forma automática.

## Como vai funcionar

- **Botão "Imprimir"** em cada pedido no painel (aba Pedidos, Pedidos anteriores e no mapa de Mesas), para reimprimir a qualquer momento.
- **Impressão automática** (interruptor na aba Expediente, com estado salvo no navegador): quando um pedido novo chega em tempo real, o cupom é enviado direto para a impressora, sem clique.
  - Cada pedido é impresso uma única vez por dispositivo (registro dos IDs já impressos), então abrir o painel em dois celulares/computadores não duplica.
  - Aviso na tela explicando que o navegador precisa ter a impressora térmica como padrão e a caixa de diálogo de impressão desativada para sair sozinho.
- **Layout 80mm**: fonte monoespaçada, sem margens, quebras de linha adequadas à bobina, corte no fim.

## O que sai no papel

- Nome da lanchonete
- Nº do pedido (curto, últimos dígitos) e data/hora
- Tipo: MESA nº X (com nome do garçom, quando houver) ou DELIVERY
- Nome do cliente e telefone
- Itens: quantidade, nome, preço unitário e subtotal da linha
- Observação do pedido
- Subtotal, taxa de 10% do garçom (quando aceita), TOTAL
- Forma de pagamento e situação (ex.: aguardando Pix / pago)
- Endereço de entrega e link do mapa (delivery)
- Rodapé de agradecimento

## Ajuste necessário nos dados

Hoje a observação do pedido de mesa é gravada no campo de telefone do cliente e, no delivery, é concatenada no endereço. Para o cupom sair correto, vou criar uma coluna própria `observation` na tabela de pedidos, gravá-la no fluxo de criação de pedido (cliente e garçom) e passar a exibi-la separadamente no painel e no cupom. O telefone volta a conter só telefone.

## Detalhes técnicos

- `src/lib/printReceipt.ts`: monta o HTML do cupom (largura 80mm, `@media print` com `@page { size: 80mm auto; margin: 0 }`) e imprime via `iframe` oculto — sem abrir aba nova, funciona em desktop e Android.
- `src/hooks/usePrintOrder.ts`: busca os itens do pedido (`get_order_items_public` / `order_items`) e chama a impressão; usado pelo botão e pelo automático.
- `src/pages/Dashboard.tsx`: botão de impressão nos cartões de pedido; hook de auto-impressão ligado ao canal realtime existente de `orders` (dispara em INSERT), com `localStorage` para IDs já impressos e para a preferência ligado/desligado.
- `src/components/dashboard/TablesTab.tsx`: botão "Imprimir" no diálogo de detalhes da mesa.
- Migração: adiciona `observation text` em `public.orders`; `place-order` e `waiter-api` passam a gravar o campo; `PublicMenu.tsx` deixa de usar `customer_phone`/`delivery_address` para a observação.
