
## Plano: Opção de Delivery no Carrinho

Adicionar modalidade **Delivery** no checkout do cardápio público, mantendo o fluxo atual de "Mesa" como alternativa.

### 1. Banco de dados (migration)
Adicionar colunas em `orders`:
- `order_type` text default `'table'` ('table' | 'delivery')
- `payment_method` text nullable ('pix' | 'debito' | 'credito' | 'dinheiro')
- `delivery_address` text nullable
- `delivery_lat` numeric nullable
- `delivery_lng` numeric nullable
- `delivery_maps_url` text nullable

`table_number` continua existindo, mas fica vazio quando for delivery.

### 2. Checkout no `PublicMenu.tsx`
No modal de finalização do pedido, adicionar um seletor (botões/tabs nativos, sem Radix Portal — respeitando a constraint de UI) para escolher:
- **Mesa** (fluxo atual: nome + telefone + nº mesa)
- **Delivery** (novos campos abaixo)

Campos do delivery:
- Nome (obrigatório)
- Telefone (obrigatório, com validação já existente)
- Forma de pagamento — 4 botões (Pix / Débito / Crédito / Dinheiro), seleção única
- Endereço — duas abas:
  - **Digitar endereço**: textarea livre
  - **Google Maps**: campo de busca com autocomplete + visualização do pin selecionado, salvando endereço formatado, lat/lng e link do maps

Validação com zod (regra do projeto): nome ≤100, telefone formato válido, pagamento obrigatório, endereço não vazio.

### 3. Integração Google Maps
Usar **Google Places Autocomplete + Map**. Requer chave da Google Maps Platform (Places API + Maps JavaScript API habilitadas).

A chave do Maps é **publishable** (restrita por domínio no console Google), então pode ficar no front via variável. Vou pedir a chave através do fluxo de secrets para uso seguro e a injeto no carregamento do script.

Fallback: se o usuário não fornecer chave agora, o modo "Google Maps" fica desabilitado com aviso "Configure a chave do Google Maps", e o modo "Digitar endereço" funciona normalmente.

### 4. Dashboard do dono (`Dashboard.tsx`)
Nos cards de pedido exibir:
- Badge "Delivery" ou "Mesa nº X"
- Quando delivery: endereço completo, link "Abrir no Maps" (usa `delivery_maps_url` ou monta com lat/lng), forma de pagamento

### 5. Hook `useOrders.ts` e tipos
Estender `Order` com os novos campos opcionais.

### Perguntas antes de implementar

<lov-questions>
<lov-question header="Google Maps" question="Como quer tratar a integração com Google Maps?" multiSelect="false">
<lov-option label="Já tenho chave da Google Maps Platform">Vou fornecer agora; habilita autocomplete + pin no mapa.</lov-option>
<lov-option label="Implementar sem mapa por enquanto">Só campo de endereço escrito; deixo o modo Maps desabilitado até eu fornecer a chave.</lov-option>
<lov-option label="Usar link manual do Google Maps">Cliente cola o link do Maps no campo, sem autocomplete (sem necessidade de API key).</lov-option>
</lov-questions>
