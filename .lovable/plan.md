## Objetivo

Adicionar um novo status **"Pronto"** entre "Em Preparo" e "Finalizado". A mesa permanece ocupada nos status `pending`, `preparing` e `ready`, e só é liberada quando o pedido vai para `done` (Finalizado) ou `cancelled`. O cliente também vê esse novo passo ao acompanhar o pedido.

## Mudanças

### 1. Banco de dados (migration)
- Atualizar a função `get_available_tables(_slug)` para considerar a mesa ocupada também quando o status do pedido for `ready`:
  - `WHERE o.status IN ('pending','preparing','ready')`

Sem alterações em tabelas — a coluna `status` já é `text` e aceita o novo valor.

### 2. Dashboard (`src/pages/Dashboard.tsx`)
- Adicionar `ready` em `statusLabels`:
  - `ready: { label: "Pronto", color: "bg-accent text-accent-foreground" }` (token semântico já existente)
- Incluir `"ready"` no array de transições de status (linha ~550): `["pending", "preparing", "ready", "done", "cancelled"]`, para que o lojista possa marcar o pedido como Pronto e depois como Finalizado.
- Manter o cronômetro/timer atual ativo apenas durante `preparing` (sem mudança).

### 3. Acompanhamento do cliente (`src/pages/PublicMenu.tsx`)
- Adicionar o passo "Pronto" na timeline (linhas ~555-559):
  ```ts
  { key: "pending",   label: "Pendente",    desc: "Aguardando a lanchonete aceitar" },
  { key: "preparing", label: "Em preparo",  desc: "A lanchonete está preparando" },
  { key: "ready",     label: "Pronto",      desc: "Seu pedido está pronto" },
  { key: "done",      label: "Finalizado",  desc: "Pedido entregue / encerrado" },
  ```
  e atualizar a ordem: `["pending","preparing","ready","done"]`.

### 4. Comportamento da mesa
- Como a RPC `get_available_tables` passa a tratar `ready` como ocupado, a mesa só fica disponível no cardápio público quando o lojista marcar **Finalizado** (ou Cancelado). Nenhuma outra alteração necessária.

## Resumo do impacto
- 1 migration (atualiza função `get_available_tables`).
- 2 arquivos de frontend editados (Dashboard + PublicMenu).
- Sem mudanças em tipos do Supabase (status continua sendo `text`).