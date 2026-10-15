# Reforma do frontend — Fundação (shadcn/ui)

- **Data:** 2026-10-15
- **Status:** aguardando revisão
- **Branch:** `frontend-shadcn`

## 1. Contexto

A reforma do frontend é um redesign completo de UX das três superfícies do app, usando shadcn/ui. As dores que motivam: visual amador, painel difícil de operar, cardápio sem identidade da loja. O fluxo do cliente no cardápio (categorias → item → sacola → checkout) não é dor e mantém a estrutura; muda o visual e a marca.

A reforma é dividida em quatro subprojetos, cada um com spec, plano e execução próprios, todos na branch `frontend-shadcn`:

1. **Fundação** (este documento): shadcn, tokens, tema da loja, modo escuro, componentes base.
2. **Cardápio público**: `[slug]`, item, sacola, checkout, acompanhamento; topo com foto de capa (campo novo `coverUrl` + upload no painel).
3. **Painel da loja**: navegação nova, fila de pedidos, cardápio, loja, métricas, disponibilidade.
4. **Admin + login**: admin, login, convite, sem-loja, privacidade; remove o código de estilo legado restante.

Sem mudança de regras de negócio ou backend, exceto o que a identidade da loja exigir (subprojeto 2).

## 2. Decisões já tomadas

- **Direção visual:** "neutro moderno" em todo o app: base zinc/neutral, raio médio, sans (Geist). É o padrão do shadcn; some atrás da marca da loja no cardápio.
- **Identidade da loja:** no cardápio, a cor primária da loja substitui a primária do tema; a secundária vira acento; `theme.font` (sans/serif) vale nos títulos. O topo com foto de capa é do subprojeto 2.
- **Modo escuro:** painel e admin com toggle claro/escuro/sistema; todas as outras rotas sempre claras.
- **Estratégia de migração:** a Fundação não altera as telas existentes (exceto o que o tema da loja aplica automaticamente e o toggle de modo). Cada subprojeto refaz suas telas com shadcn e remove o legado que deixar de usar.

## 3. Escopo da Fundação

### 3.1 Setup e tokens

- Antes de codar, ler os guias relevantes em `node_modules/next/dist/docs/` (fontes, layout raiz, `cacheComponents`, componentes cliente no layout) — Next 16.4 tem mudanças incompatíveis com versões anteriores.
- `npx shadcn init`: Tailwind v4, cor base **neutral**, primitivas Radix, `components.json`, componentes em `src/components/ui`, utilitário `cn` em `src/lib/utils.ts`, alias `@/` já existente.
- `src/app/globals.css` adota o formato do shadcn: variáveis OKLCH em `:root` e `.dark`, mapeadas em `@theme inline`; `@custom-variant dark (&:is(.dark *))`; raio base `--radius: 0.625rem`.
- Tokens adicionais em `@theme inline`:
  - `--color-brand-secondary` / `--color-brand-secondary-foreground` (padrão: `--secondary` / `--secondary-foreground`);
  - `--font-heading` (padrão: Geist sans).
- Fontes via `next/font/google` no layout raiz: Geist e Geist Mono (já existentes) e Lora (serif, só para títulos de lojas com `font: "serif"`).

### 3.2 Tema da loja

- **`src/shared/color.ts`**
  - `parseHex(value: string): { r: number; g: number; b: number } | null` — aceita `#RGB` e `#RRGGBB`.
  - `readableForeground(hex: string): string` — luminância relativa WCAG; retorna branco (`#ffffff`) ou quase-preto (`#0a0a0a`), o que der maior contraste. Com hex inválido, retorna o foreground padrão sem lançar.
- **`<StoreTheme theme={store.theme}>`** (`src/app/[slug]/_components/store-theme.tsx`, componente de servidor)
  - Renderiza uma `div` com `style` inline definindo:
    - `--primary: theme.primary`, `--primary-foreground: readableForeground(theme.primary)`, `--ring: theme.primary`;
    - `--brand-secondary: theme.secondary`, `--brand-secondary-foreground: readableForeground(theme.secondary)`;
    - `--font-heading`: variável da Geist se `sans`, da Lora se `serif`.
  - Como sobrescreve os tokens do próprio shadcn, todo componente (Button, Badge, anel de foco) dentro da loja já sai na cor dela.
- **Aplicação:** novo `src/app/[slug]/layout.tsx` busca a loja pelo slug reaproveitando `getStorePageData` de `data.ts` (mesma cache tag `storeMenuTag`, sem consulta extra) e envolve as páginas com `<StoreTheme>`. Slug inexistente segue o comportamento atual de `not-found`.
- Regra em `@layer base` do `globals.css`: `h1, h2, h3 { font-family: var(--font-heading) }` — sem editar telas. Fora da loja, `--font-heading` é Geist, então nada muda no painel. Classe utilitária `font-heading` também disponível para outros elementos.
- O `<StoreTheme>` é exportado de forma reaproveitável para a pré-visualização de tema no painel (tela fica para o subprojeto 3).

### 3.3 Modo escuro

- Dependência `next-themes`. `ThemeProvider` com `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. `<html suppressHydrationWarning>`.
- Um wrapper cliente (`src/components/theme-provider.tsx`) lê `usePathname()`:
  - `/painel/*` e `/admin/*`: tema livre;
  - `/painel/pedidos/[id]/imprimir`: `forcedTheme="light"`;
  - qualquer outra rota: `forcedTheme="light"`.
- Motivo: o `next-themes` aplica a classe no `<html>`; forçar por rota evita a classe `dark` vazar para o cardápio em navegação no cliente.
- Se a leitura dos docs mostrar que `usePathname` no layout raiz conflita com `cacheComponents`, plano B: provider apenas nos layouts de `painel` e `admin`, e o layout raiz sem classe de tema (claro).
- **`<ModeToggle>`** (`src/components/mode-toggle.tsx`): `DropdownMenu` com Claro / Escuro / Sistema, rótulos em pt-BR e `aria-label`. Colocado no header atual do painel e na página de admin.

### 3.4 Componentes base

Instalados via `npx shadcn add`: `button`, `input`, `label`, `textarea`, `select`, `checkbox`, `switch`, `radio-group`, `field`, `card`, `badge`, `separator`, `dialog`, `sheet`, `dropdown-menu`, `tabs`, `skeleton`, `alert`, `sonner`.

- Não usar o `form` do shadcn (depende de react-hook-form); formulários continuam em Server Actions + `useActionState`, compostos com `Field` + `Label`.
- `<Toaster>` (sonner) no layout raiz.
- Subprojetos adicionam outros componentes conforme a necessidade (`table`, `chart`, `sidebar`, etc.).
- `src/app/_components/styles.ts` e `form-controls.tsx` permanecem até os subprojetos os tornarem obsoletos; o subprojeto 4 remove o que sobrar.

## 4. Fora do escopo

- Redesign de qualquer tela (subprojetos 2–4).
- Campo `coverUrl`, upload de capa e migração de banco (subprojeto 2).
- Tela de edição de tema com pré-visualização (subprojeto 3).
- Modo escuro no cardápio público.

## 5. Testes e verificação

- Unitários (Vitest) para `src/shared/color.ts`: `#RGB` e `#RRGGBB`, hex inválido, primária padrão `#B91C1C` → branco, secundária padrão `#F59E0B` → escuro, amarelo claro → escuro, preto → branco.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` verdes.
- `npm run test:int` e `npm run test:e2e` sem regressão (telas não mudam; ajustar seletores só se o wrapper de tema alterar algo).
- Smoke manual no `npm run dev`:
  - toggle no painel alterna claro/escuro/sistema e persiste após reload;
  - com o sistema em escuro, o cardápio, o login e a impressão continuam claros;
  - loja com primária amarela tem botão legível (texto escuro);
  - loja com `font: "serif"` mostra títulos em Lora no cardápio.

## 6. Critério de pronto

shadcn configurado; tokens e modo escuro funcionando conforme 3.3; `<StoreTheme>` aplicado no `[slug]` (cor e fonte da loja já visíveis nos botões e títulos atuais do cardápio); verificações da seção 5 verdes; commits na branch `frontend-shadcn` com o email do projeto.
