## Modo de atendimento (Mesas / Delivery / Ambos)

Adicionar uma configuração no painel para o dono escolher se a lanchonete aceita pedidos apenas de **Mesa**, apenas de **Delivery**, ou **Ambos**. O cardápio público respeita essa configuração e o backend valida para impedir burlas.

### Banco de dados
- Adicionar coluna `service_mode` (text, default `'both'`) em `restaurants`. Valores aceitos: `both`, `delivery`, `table`.
- Atualizar a função `get_public_restaurant_by_slug` para retornar `service_mode`.

### Dashboard (aba Expediente)
- Novo seletor "Modo de atendimento" com 3 opções: **Mesas e Delivery**, **Somente Mesas**, **Somente Delivery**.
- Salva via mutation no hook `useRestaurant`.

### Cardápio público (`PublicMenu.tsx`)
- Lê `service_mode` do restaurante.
- Se `delivery`: força modo delivery, oculta opção de mesa no checkout.
- Se `table`: força modo mesa, oculta opção de delivery.
- Se `both`: comportamento atual.

### Edge function `place-order`
- Valida que `order_type` recebido é compatível com o `service_mode` do restaurante. Caso contrário, retorna erro 403 com mensagem clara.

### Hook `useRestaurant.ts`
- Incluir `service_mode` no select e no tipo retornado.
- Nova mutation `updateServiceMode`.

Sem CHECK constraint — validação na aplicação + edge function (consistente com o padrão do projeto). Default `'both'` preserva comportamento atual de restaurantes existentes.
