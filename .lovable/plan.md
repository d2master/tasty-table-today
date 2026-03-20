

## Plano: Corrigir tela branca ao selecionar categoria no formulário de produto

### Problema
Ao abrir o dropdown de seleção de categoria no formulário de novo produto, a tela fica branca. Isso é causado pelo componente Radix Select que usa um Portal para renderizar o dropdown fora da árvore de componentes, o que pode causar conflitos no ambiente de preview (iframe).

### Solução
Duas alterações para resolver o problema:

1. **Dashboard.tsx** — Substituir o componente `Select` do Radix UI por um `<select>` nativo do HTML para o campo de categoria do produto. Isso elimina o uso de Portal e evita o crash. O estilo será mantido consistente com o resto do formulário usando classes Tailwind.

2. **App.tsx** — Corrigir os warnings de "Function components cannot be given refs" que aparecem no console, pois podem contribuir para instabilidade. Isso não é a causa principal, mas é uma boa prática.

### Detalhes técnicos
- No `Dashboard.tsx`, linhas ~347-352: trocar `<Select>/<SelectContent>/<SelectItem>` por um `<select>` HTML nativo com a mesma lógica de `onChange` e `value`
- O `<select>` nativo funciona sem Portal, eliminando o problema de renderização
- Visual será ajustado com classes Tailwind para manter a aparência moderna (bordas arredondadas, altura, cores)

