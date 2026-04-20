
Implementar pagamento Pix no fechamento do pedido com QR Code e “copia e cola” gerados a partir de uma chave Pix fixa da lanchonete, mantendo a experiência alinhada ao design atual.

### O que será entregue
- No dashboard da lanchonete: configuração da chave Pix da loja.
- No checkout do cliente: quando selecionar **Pix**, após criar o pedido o sistema mostra:
  - QR Code Pix com o valor exato do pedido
  - código “copia e cola”
  - chave Pix da lanchonete
  - valor do pedido em destaque
- No dashboard: o pedido passa a exibir status de pagamento para o dono acompanhar.
- Confirmação de pagamento: como a opção escolhida foi **chave Pix fixa**, a confirmação não poderá ser automática pelo banco. O fluxo seguro será **manual pelo dono da lanchonete**.

### 1. Banco de dados
Criar uma migration para adicionar dados de Pix por lanchonete e status de pagamento por pedido.

**Tabela `restaurants`**
Adicionar colunas:
- `pix_enabled` boolean default false
- `pix_key` text nullable
- `pix_key_type` text nullable (`cpf`, `cnpj`, `email`, `phone`, `random`)
- `pix_recipient_name` text nullable
- `pix_city` text nullable

**Tabela `orders`**
Adicionar colunas:
- `payment_status` text default `'pending'` (`pending`, `awaiting_pix`, `paid`, `failed`)
- `pix_copy_paste` text nullable
- `pix_paid_at` timestamptz nullable

Também adicionar constraints simples de domínio para os enums textuais.

### 2. Dashboard da lanchonete
Adicionar uma área de configuração Pix no dashboard, usando inputs nativos e visual consistente com o painel atual:
- toggle “Aceitar Pix”
- tipo da chave
- chave Pix
- nome do recebedor
- cidade

Validações:
- nome do recebedor obrigatório quando Pix estiver ativo
- cidade obrigatória quando Pix estiver ativo
- chave obrigatória quando Pix estiver ativo
- validação por tipo de chave com zod

Salvar isso na própria lanchonete para que cada restaurante tenha sua configuração independente.

### 3. Checkout do cliente
Aproveitar o fluxo já existente em `PublicMenu.tsx`, onde `payment_method` já possui a opção `pix`.

Novo comportamento:
- cliente monta o pedido normalmente
- seleciona **Delivery** ou **Mesa**
- escolhe **Pix**
- ao clicar em “Finalizar Pedido”, o pedido é criado
- se a lanchonete tiver Pix ativo e configurado:
  - gerar payload Pix com valor do pedido
  - salvar o payload em `orders.pix_copy_paste`
  - abrir uma etapa/modal de pagamento mostrando QR Code + código
  - atualizar `payment_status` para `awaiting_pix`
- se a lanchonete não tiver Pix configurado:
  - bloquear a finalização em Pix com mensagem clara
  - manter as demais formas de pagamento funcionando

### 4. Geração do QR Code Pix
Usar o `QRCodeSVG` já presente no projeto para renderizar o QR.

Gerar no front um payload Pix EMV/BR Code com:
- chave Pix da lanchonete
- nome do recebedor
- cidade
- valor do pedido
- identificador do pedido

Também exibir:
- botão “Copiar código Pix”
- chave Pix em texto
- valor total

### 5. Confirmação de pagamento
Como foi definido **chave Pix fixa** e não integração com provedor/banco:
- não haverá confirmação automática real do pagamento
- o dono da lanchonete confirmará manualmente no dashboard

No dashboard, para pedidos com `payment_method = 'pix'`:
- mostrar badge de pagamento:
  - “Aguardando Pix”
  - “Pago”
- adicionar botão “Marcar como pago”
- ao marcar como pago, preencher `payment_status = 'paid'` e `pix_paid_at = now()`

Opcionalmente, o status operacional do pedido continua separado do status financeiro:
- pedido: `pending`, `preparing`, `done`, `cancelled`
- pagamento: `awaiting_pix`, `paid`

Isso evita misturar preparo com financeiro.

### 6. Ajustes visuais
Sem fugir do padrão atual:
- cartão de pagamento Pix com borda/sombra suave
- QR Code dentro de card claro
- valor em destaque com tipografia já usada no projeto
- badge discreta “Pix” e “Aguardando pagamento”
- manter componentes nativos, sem Select com Portal

### 7. Arquivos que serão ajustados
- `src/pages/PublicMenu.tsx`
  - etapa de pagamento Pix após finalizar pedido
  - QR Code, cópia do código e mensagens
- `src/pages/Dashboard.tsx`
  - configuração Pix da lanchonete
  - badge/status e ação “Marcar como pago”
- `src/hooks/useOrders.ts`
  - ampliar tipo `Order` com `payment_status`, `pix_copy_paste`, `pix_paid_at`
  - mutation para marcar pagamento
- `src/hooks/useRestaurant.ts`
  - mutation para salvar configuração Pix
- `src/integrations/supabase/types.ts`
  - refletirá as novas colunas automaticamente após a migration
- nova migration em `supabase/migrations/...`

### 8. Regras importantes
- Não usar `.select()` após insert do pedido público.
- Continuar gerando o UUID do pedido no client.
- Validar entradas no front com zod.
- Manter a UI sem componentes com Portal.
- Não prometer “pagamento confirmado automaticamente”, porque isso só seria possível com integração real com banco/provedor Pix.

### Detalhes técnicos
```text
Fluxo Pix com chave fixa

Cliente fecha pedido
  -> pedido é criado
  -> payment_method = pix
  -> payment_status = awaiting_pix
  -> sistema gera BR Code com valor do pedido
  -> cliente vê QR Code + copia e cola
  -> dono confere recebimento no banco
  -> dono marca "Pago" no dashboard
  -> payment_status = paid
```

### Limitação desta abordagem
Com **chave Pix fixa**, o sistema consegue:
- gerar QR Code com valor
- mostrar chave e código copia-e-cola
- organizar o pedido com status financeiro

Mas **não consegue validar sozinho se o dinheiro caiu**. Para confirmação automática de verdade, depois será necessário integrar um provedor Pix/API bancária.
