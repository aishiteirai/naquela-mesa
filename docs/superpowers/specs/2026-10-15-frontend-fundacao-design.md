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

- Antes de codar, ler os guias relevantes em `node_modules/next/dist/docs/` — Next 16.4 tem mudanças incompatíveis com versões anteriores.
- `npx shadcn@4.21.5 init -t next -b radix -p nova`: Tailwind v4, cor base **neutral**, primitivas Radix, ícones lucide, `components.json`, componentes em `src/components/ui`, `cn` em `src/lib/utils.ts` (pacote `cn`, oficial do shadcn). Validado numa cópia descartável: lint, typecheck e build verdes.
- `src/app/globals.css` adota o formato do shadcn: variáveis OKLCH em `:root` e `.dark`, mapeadas em `@theme inline`; raio base `--radius: 0.625rem`.
- O `init` gera `--font-sans: var(--font-sans)` (autorreferência); corrigir para `var(--font-geist-sans)`.
- Tokens adicionais:
  - `--brand-secondary` / `--brand-secondary-foreground` (padrão em `:root`: `--secondary` / `--secondary-foreground`), mapeados como `bg-brand-secondary` etc.;
  - `--heading-font` (padrão: Geist sans), usado por `font-heading` e pela regra base `h1, h2, h3 { font-family: var(--heading-font) }`.
- Fontes via `next/font/google` no layout raiz: Geist e Geist Mono (já existentes) e Lora (`--font-lora`, `preload: false`, só para títulos de lojas com `font: "serif"`).

### 3.2 Tema da loja

O código atual já tem a base: `src/modules/stores/theme.ts` exporta `readableTextColor(hex)` (luminância relativa WCAG, retorna `#000000`/`#FFFFFF`, testado) e `themeCssVariables(theme)`, aplicado por `style` inline num wrapper em `src/app/[slug]/page.tsx` e `src/app/[slug]/sacola/page.tsx`. As telas atuais usam `--brand-primary(-foreground)` e `--brand-secondary(-foreground)`. A Fundação estende isso em vez de criar módulo novo:

- `themeCssVariables(theme)` passa a emitir também:
  - `--primary: theme.primary`, `--primary-foreground: readableTextColor(theme.primary)`, `--ring: theme.primary`;
  - `--heading-font`: `var(--font-geist-sans)` se `sans`, `var(--font-lora)` se `serif`.
- As chaves `--brand-*` continuam (telas atuais e E2E dependem delas); o subprojeto 2 remove `--brand-primary*` quando as telas usarem `bg-primary`.
- Como o wrapper sobrescreve os tokens do próprio shadcn, todo componente (Button, Badge, anel de foco) dentro da loja sai na cor dela.
- Cor inválida: o schema (`hexColor`, `#RRGGBB`) já valida ao ler a loja; `readableTextColor` mantém o `RangeError` atual.
- Fica como está: wrapper por página (sem `[slug]/layout.tsx`, que exigiria Suspense extra por causa de `params` com `cacheComponents`). A página de acompanhamento do pedido não recebe tema agora — subprojeto 2.
- A pré-visualização de tema no painel reaproveita `themeCssVariables` (tela fica para o subprojeto 3).

### 3.3 Modo escuro

- Dependência `next-themes` (instalada pelo `shadcn add sonner`).
- **Não** usar provider no layout raiz com `usePathname`: com `cacheComponents`, `usePathname` suspende em rotas com params dinâmicos (`/[slug]`), o que exigiria Suspense em volta do app inteiro (docs: `use-pathname.md`, seção Cache Components).
- **`<PanelThemeProvider>`** (`src/components/panel-theme-provider.tsx`, cliente): `ThemeProvider` com `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Usado só em `src/app/painel/layout.tsx` e num novo `src/app/admin/layout.tsx`.
  - Ao desmontar (ex.: "Sair" faz `router.push("/login")` no cliente), remove `dark`/`light` e `color-scheme` do `<html>`, para a classe não vazar para rotas claras.
- Rotas fora de painel/admin nunca recebem `.dark`, logo ficam claras mesmo com o sistema em escuro.
- **Impressão sempre clara:** os tokens `.dark` e a variante `dark:` do Tailwind valem só em `@media screen`. A página `/painel/pedidos/[id]/imprimir` segue o tema na tela e imprime clara.
- `<html suppressHydrationWarning>` no layout raiz.
- **`<ModeToggle>`** (`src/components/mode-toggle.tsx`): `DropdownMenu` com Claro / Escuro / Sistema; botão com `aria-label="Alternar tema"`. Colocado no header atual do painel e na página de admin.

### 3.4 Componentes base

Instalados via `npx shadcn add`: `button`, `input`, `label`, `textarea`, `select`, `checkbox`, `switch`, `radio-group`, `field`, `card`, `badge`, `separator`, `dialog`, `sheet`, `dropdown-menu`, `tabs`, `skeleton`, `alert`, `sonner`.

- Não usar o `form` do shadcn (depende de react-hook-form); formulários continuam em Server Actions + `useActionState`, compostos com `Field` + `Label`.
- `<Toaster theme="light" />` (sonner) no layout raiz, fora do provider de tema; as cores do toast vêm dos tokens (`--popover` etc.), então seguem o modo escuro no painel.
- Subprojetos adicionam outros componentes conforme a necessidade (`table`, `chart`, `sidebar`, etc.).
- `src/app/_components/styles.ts` e `form-controls.tsx` permanecem até os subprojetos os tornarem obsoletos; o subprojeto 4 remove o que sobrar.

## 4. Fora do escopo

- Redesign de qualquer tela (subprojetos 2–4).
- Campo `coverUrl`, upload de capa e migração de banco (subprojeto 2).
- Tela de edição de tema com pré-visualização (subprojeto 3).
- Modo escuro no cardápio público.

## 5. Testes e verificação

- Unitários (Vitest) em `src/modules/stores/theme.test.ts`: `themeCssVariables` com fonte sans e serif, primária amarela → `--primary-foreground` preto.
- E2E: cardápio com sistema em escuro continua claro; no painel, tema escuro persiste após reload, impressão sai clara e "Sair" volta ao claro.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` verdes.
- `npm run test:int` e `npm run test:e2e` sem regressão (telas não mudam; ajustar seletores só se o wrapper de tema alterar algo).
- Smoke manual no `npm run dev`:
  - toggle no painel alterna claro/escuro/sistema e persiste após reload;
  - com o sistema em escuro, o cardápio, o login e a impressão continuam claros;
  - loja com primária amarela tem botão legível (texto escuro);
  - loja com `font: "serif"` mostra títulos em Lora no cardápio.

## 6. Critério de pronto

shadcn configurado; tokens e modo escuro funcionando conforme 3.3; `themeCssVariables` estendido (cor e fonte da loja já visíveis nos títulos atuais do cardápio e em qualquer componente shadcn dentro da loja); verificações da seção 5 verdes; commits na branch `frontend-shadcn` com o email do projeto.
