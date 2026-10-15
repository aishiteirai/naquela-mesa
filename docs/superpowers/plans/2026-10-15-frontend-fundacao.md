# Reforma do frontend — Fundação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar shadcn/ui com tokens neutros, tema da loja sobrescrevendo os tokens do shadcn no cardápio, e modo escuro só em painel/admin — sem redesenhar telas.

**Architecture:** `shadcn init` (preset `nova`, Radix) gera `components.json`, `src/lib/utils.ts`, `src/components/ui/*` e o `globals.css` com tokens OKLCH; ajustamos fontes, tokens extras e deixamos `dark` valer só na tela. `themeCssVariables` (já existente) passa a emitir `--primary`, `--primary-foreground`, `--ring` e `--heading-font`. `next-themes` entra só nos layouts de painel e admin via `PanelThemeProvider`, que limpa a classe do `<html>` ao desmontar.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind v4, shadcn 4.21.5 (preset nova, Radix), next-themes 0.4.6, sonner, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-fundacao-design.md`

## Global Constraints

- Branch `frontend-shadcn`; commits com o email do repo (`ryancorazzaalvarenga@gmail.com`, já no git config local); mensagens em inglês no padrão `feat:`/`fix:`/`chore:`/`test:` terminando com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Next 16.4 tem mudanças incompatíveis: antes de escrever código Next, ler o guia relevante em `node_modules/next/dist/docs/`.
- shadcn fixo em `4.21.5`: `npx -y shadcn@4.21.5 ...`.
- Nenhuma tela é redesenhada. Telas existentes só mudam por herança de tokens (cor da loja, fonte de título) e pelo toggle adicionado.
- Textos de interface em pt-BR.
- `src/components/ui/*` é código gerado: não reformatar, não editar à mão nesta fase.
- Não remover `src/app/_components/styles.ts` nem `form-controls.tsx`.
- Comandos de verificação: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; E2E via `make e2e` (sobe DB, migra, builda, roda Playwright).

## Review Focus

- Loja com primária clara (amarelo `#ffff00`): botão shadcn dentro da loja precisa de texto preto — teste em Task 2.
- Sistema operacional em modo escuro abrindo o cardápio: página tem que continuar clara (sem `.dark`, fundo branco) — E2E em Task 3.
- Dono com painel em escuro clica "Sair": `/login` não pode herdar `.dark` (navegação no cliente) — E2E em Task 3.
- Imprimir pedido com painel em escuro: impressão sai clara — E2E (`emulateMedia print`) em Task 3.
- Recarregar o painel após escolher "Escuro": escolha persiste (localStorage do next-themes) — E2E em Task 3.

---

### Task 1: shadcn init, tokens e componentes base

**Files:**
- Create (gerados): `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,input,label,textarea,select,checkbox,switch,radio-group,field,card,badge,separator,dialog,sheet,dropdown-menu,tabs,skeleton,alert,sonner}.tsx`
- Modify: `package.json`, `package-lock.json` (pelo CLI), `src/app/globals.css` (substituir pelo conteúdo abaixo)

**Interfaces:**
- Produces:
  - `cn(...inputs)` em `@/lib/utils`.
  - Componentes em `@/components/ui/*` (ex.: `Button` com `variant: "default" | "outline" | ...`, `size: "default" | "icon" | ...`, `asChild`; `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`; `Toaster` de `@/components/ui/sonner`).
  - CSS vars globais: tokens shadcn (`--primary`, `--ring`, ...), `--brand-secondary`, `--brand-secondary-foreground`, `--heading-font`; utilitários `bg-brand-secondary`, `text-brand-secondary-foreground`, `font-heading`.
  - Variante `dark:` e tokens `.dark` valem só em `@media screen`.

- [ ] **Step 1: Rodar o init**

```bash
npx -y shadcn@4.21.5 init -t next -b radix -p nova -y
```

Expected: "Project initialization completed."; cria `components.json` (`"style": "radix-nova"`, `"baseColor": "neutral"`), `src/lib/utils.ts` (`export { cn } from "cn"`), `src/components/ui/button.tsx`; adiciona deps `class-variance-authority`, `cn`, `lucide-react`, `radix-ui`, `shadcn`, `tw-animate-css`. Não deve alterar `src/app/layout.tsx` (`git status` para conferir; se alterar, reverta com `git checkout src/app/layout.tsx`).

- [ ] **Step 2: Adicionar componentes base**

```bash
npx -y shadcn@4.21.5 add -y input label textarea select checkbox switch radio-group field card badge separator dialog sheet dropdown-menu tabs skeleton alert sonner
```

Expected: "Created 18 files" e "Skipped 1 file" (`button.tsx`); deps novas `next-themes` e `sonner`.

- [ ] **Step 3: Substituir `src/app/globals.css`**

Conteúdo completo (parte do gerado pelo init com 4 ajustes: `--font-sans` apontando para Geist, tokens `--brand-secondary*` e `--heading-font`, regra de títulos, e `dark` só em tela):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Modo escuro só na tela: impressão (pedido, comanda) sai sempre clara. */
@custom-variant dark {
  @media screen {
    &:is(.dark *) {
      @slot;
    }
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--heading-font);
  --color-brand-secondary: var(--brand-secondary);
  --color-brand-secondary-foreground: var(--brand-secondary-foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  /* Padrões fora da loja; o wrapper do cardápio (themeCssVariables) sobrescreve. */
  --brand-secondary: var(--secondary);
  --brand-secondary-foreground: var(--secondary-foreground);
  --heading-font: var(--font-geist-sans);
}

@media screen {
  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
  h1,
  h2,
  h3 {
    font-family: var(--heading-font);
  }
}
```

Nota: a partir daqui, as classes `dark:` legadas das telas deixam de seguir `prefers-color-scheme` e passam a depender da classe `.dark` (que só aparece em painel/admin a partir da Task 3). Intencional: o cardápio fica claro.

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo verde; build lista as rotas como antes (`/[slug]` ◐, `/privacidade` ○ etc.).

- [ ] **Step 5: Smoke visual rápido**

Run: `npm run dev`, abrir `http://localhost:3000/login` e `/pizzaria-demo` (com `npm run db:up && npm run db:migrate && npm run seed:demo` se o banco local estiver vazio).
Expected: fundo branco, texto escuro, fonte Geist; nada quebrado visualmente além de bordas que agora usam `--border`.

- [ ] **Step 6: Commit**

```bash
git add components.json package.json package-lock.json src/lib src/components/ui src/app/globals.css
git commit -m "chore: set up shadcn/ui (radix-nova) with neutral tokens and base components

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tema da loja sobre os tokens do shadcn

**Files:**
- Modify: `src/modules/stores/theme.ts:30-37`
- Modify: `src/modules/stores/theme.test.ts:22-31`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `--heading-font`, `--primary`, `--ring` (Task 1); `readableTextColor(hex)` existente (`"#000000" | "#FFFFFF"`); `StoreTheme = { primary: string; secondary: string; font: "sans" | "serif" }`.
- Produces: `themeCssVariables(theme: StoreTheme)` retorna objeto com as chaves `--brand-primary`, `--brand-primary-foreground`, `--brand-secondary`, `--brand-secondary-foreground`, `--primary`, `--primary-foreground`, `--ring`, `--heading-font`. CSS var `--font-lora` disponível no `<html>`.

- [ ] **Step 1: Ler o guia de fontes do Next 16**

Run: `ls node_modules/next/dist/docs/01-app/01-getting-started/ | grep -i font` e ler o arquivo encontrado (opções `variable`, `preload`).

- [ ] **Step 2: Escrever os testes que falham**

Substituir o bloco `describe("themeCssVariables", ...)` em `src/modules/stores/theme.test.ts` por:

```ts
describe("themeCssVariables", () => {
  it("gera variáveis da marca e sobrescreve os tokens do shadcn", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" })).toEqual({
      "--brand-primary": "#B91C1C",
      "--brand-primary-foreground": "#FFFFFF",
      "--brand-secondary": "#F59E0B",
      "--brand-secondary-foreground": "#000000",
      "--primary": "#B91C1C",
      "--primary-foreground": "#FFFFFF",
      "--ring": "#B91C1C",
      "--heading-font": "var(--font-geist-sans)",
    });
  });

  it("usa Lora nos títulos quando a fonte é serif", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "serif" })["--heading-font"]).toBe(
      "var(--font-lora)",
    );
  });

  it("primária clara ganha texto preto nos botões", () => {
    const vars = themeCssVariables({ primary: "#ffff00", secondary: "#F59E0B", font: "sans" });
    expect(vars["--primary-foreground"]).toBe("#000000");
    expect(vars["--brand-primary-foreground"]).toBe("#000000");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run --project unit src/modules/stores/theme.test.ts`
Expected: FAIL — objeto sem `--primary`/`--heading-font`.

- [ ] **Step 4: Implementar**

Substituir `themeCssVariables` em `src/modules/stores/theme.ts` por:

```ts
// Fontes carregadas no layout raiz (next/font) e expostas como CSS vars no <html>.
const HEADING_FONTS: Record<StoreTheme["font"], string> = {
  sans: "var(--font-geist-sans)",
  serif: "var(--font-lora)",
};

// --brand-* atendem as telas atuais; --primary/--ring/--heading-font fazem os componentes shadcn
// e os títulos dentro da loja usarem a marca dela.
export function themeCssVariables(theme: StoreTheme) {
  const primaryForeground = readableTextColor(theme.primary);
  return {
    "--brand-primary": theme.primary,
    "--brand-primary-foreground": primaryForeground,
    "--brand-secondary": theme.secondary,
    "--brand-secondary-foreground": readableTextColor(theme.secondary),
    "--primary": theme.primary,
    "--primary-foreground": primaryForeground,
    "--ring": theme.primary,
    "--heading-font": HEADING_FONTS[theme.font],
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --project unit src/modules/stores/theme.test.ts`
Expected: PASS (todos os casos de `readableTextColor` e os 3 de `themeCssVariables`).

- [ ] **Step 6: Carregar Lora no layout raiz**

Em `src/app/layout.tsx`, trocar o import e adicionar a fonte e a classe:

```tsx
import { Geist, Geist_Mono, Lora } from "next/font/google";
```

Depois da declaração de `geistMono`:

```tsx
// Títulos de lojas com theme.font = "serif". Sem preload: a maioria das páginas não usa.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  preload: false,
});
```

E no `<html>`:

```tsx
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
```

- [ ] **Step 7: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: verde.

Smoke: `npm run dev`; em `/painel/loja` (dono `dono@pizzariademo.test` / `demo-senha-123`) não há campo de fonte, então testar via banco: `npm run db:studio`, editar `stores.theme` da `pizzaria-demo` para `{"primary":"#ffff00","secondary":"#F59E0B","font":"serif"}`, salvar, e rodar `npm run seed:demo` depois para restaurar. Em `/pizzaria-demo` (pode precisar reiniciar o dev para limpar o cache `"use cache"`): títulos de categoria em Lora; botão "Adicionar" amarelo com texto preto.

- [ ] **Step 8: Commit**

```bash
git add src/modules/stores/theme.ts src/modules/stores/theme.test.ts src/app/layout.tsx
git commit -m "feat: store theme overrides shadcn primary/ring tokens and heading font

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Modo escuro em painel e admin

**Files:**
- Create: `src/components/panel-theme-provider.tsx`
- Create: `src/components/mode-toggle.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `e2e/painel-tema.spec.ts`
- Modify: `src/app/painel/layout.tsx`
- Modify: `src/app/admin/page.tsx` (bloco do "Olá" com `SignOutButton`)
- Modify: `src/app/layout.tsx`
- Modify: `e2e/menu.spec.ts` (novo teste no fim)

**Interfaces:**
- Consumes: `Button`, `DropdownMenu*`, `Toaster` (Task 1); variante `dark` só em tela (Task 1).
- Produces: `PanelThemeProvider({ children })`, `ModeToggle()` (botão `aria-label="Alternar tema"`, itens de menu "Claro", "Escuro", "Sistema"). Subprojetos 3 e 4 reaproveitam ambos no header novo.

- [ ] **Step 1: Ler os guias do Next 16**

Ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` (layouts aninhados, `LayoutProps`) e a seção "Cache Components" de `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` (motivo de não usar `usePathname` no layout raiz).

- [ ] **Step 2: Escrever os E2E que falham**

Criar `e2e/painel-tema.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

const LIGHT_BACKGROUND = "oklch(1 0 0)";

test("tema escuro no painel persiste, imprime claro e não vaza para o login", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BACKGROUND);
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BACKGROUND);
});
```

Adicionar ao fim de `e2e/menu.spec.ts`:

```ts
test("cardápio continua claro com o sistema em modo escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/pizzaria-demo");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "oklch(1 0 0)");
});
```

(`e2e/painel-tema.spec.ts` casa com `**/painel*.spec.ts`, então roda no projeto "painel"; não altera dados da loja.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `make e2e`
Expected: `painel-tema.spec.ts` FAIL (botão "Alternar tema" não existe). O teste novo do `menu.spec.ts` já deve PASSAR (Task 1 tirou o `prefers-color-scheme`) — ele é guarda de regressão. Se o valor de `background-color` reportado pelo Chromium não for `oklch(1 0 0)`, leia o valor real na mensagem de falha, confirme que é branco, e use-o na constante (nos dois arquivos).

- [ ] **Step 4: Criar o provider**

`src/components/panel-theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

// Modo claro/escuro só no painel e no admin. O next-themes marca o <html> com a classe do tema;
// ao sair dessas áreas pelo cliente (ex.: "Sair" → /login), a marca é removida para o resto do app ficar claro.
export function PanelThemeProvider({ children }: { children: ReactNode }) {
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.style.colorScheme = "";
    },
    [],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 5: Criar o toggle**

`src/components/mode-toggle.tsx`:

```tsx
"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Alternar tema">
          <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MonitorIcon />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Ligar no painel**

Em `src/app/painel/layout.tsx`:

Imports (junto dos existentes):

```tsx
import { ModeToggle } from "@/components/mode-toggle";
import { PanelThemeProvider } from "@/components/panel-theme-provider";
```

Trocar

```tsx
        <div className="ml-auto">
          <SignOutButton />
        </div>
```

por

```tsx
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <SignOutButton />
        </div>
```

E envolver o retorno de `PainelLayout`:

```tsx
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <PanelThemeProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b print:hidden border-neutral-200 dark:border-neutral-800">
          <Suspense fallback={<div className="h-14" />}>
            <PainelHeader />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </div>
    </PanelThemeProvider>
  );
}
```

- [ ] **Step 7: Ligar no admin**

Criar `src/app/admin/layout.tsx`:

```tsx
import { PanelThemeProvider } from "@/components/panel-theme-provider";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <PanelThemeProvider>{children}</PanelThemeProvider>;
}
```

Em `src/app/admin/page.tsx`, adicionar `import { ModeToggle } from "@/components/mode-toggle";` e trocar

```tsx
        <SignOutButton />
      </div>
```

(o primeiro, logo após o parágrafo "Olá, {admin.name}.") por

```tsx
        <ModeToggle />
        <SignOutButton />
      </div>
```

- [ ] **Step 8: Layout raiz — hidratação e Toaster**

Em `src/app/layout.tsx`: adicionar `import { Toaster } from "@/components/ui/sonner";`, adicionar `suppressHydrationWarning` no `<html>` (o next-themes altera `class`/`style` antes da hidratação) e o Toaster no `<body>`:

```tsx
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Fora do provider de tema: cores vêm dos tokens (--popover etc.), que já seguem o modo escuro no painel. */}
        <Toaster theme="light" />
      </body>
    </html>
```

- [ ] **Step 9: Verificar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: tudo verde, incluindo `painel-tema.spec.ts` e o teste novo de `menu.spec.ts`. Nenhum E2E antigo quebra (o seletor `[style*="--brand-primary:#1d4ed8"]` continua com 1 elemento).

- [ ] **Step 10: Smoke manual**

`npm run dev`:
- `/painel`: toggle alterna Claro/Escuro/Sistema; "Sistema" segue o SO.
- Com o SO em escuro e tema "Sistema": `/painel` escuro; abrir "Ver cardápio" (nova aba) → claro; `/login` → claro.
- `/painel/pedidos/<id>/imprimir` em escuro → `Ctrl+P` mostra pré-visualização clara.
- Console do navegador sem erro de hidratação. (Aviso do React sobre `<script>` vindo do next-themes em dev é conhecido e aceitável; registrar no relatório se aparecer.)

- [ ] **Step 11: Commit**

```bash
git add src/components/panel-theme-provider.tsx src/components/mode-toggle.tsx src/app/admin/layout.tsx src/app/admin/page.tsx src/app/painel/layout.tsx src/app/layout.tsx e2e/painel-tema.spec.ts e2e/menu.spec.ts
git commit -m "feat: dark mode toggle for painel and admin; public routes and print stay light

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verificação final

**Files:** nenhum (só verificação; corrigir regressões na task de origem).

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && make e2e`
Expected: tudo verde.

- [ ] **Step 2: Conferir critério de pronto do spec (seção 6)**

Checklist:
- `components.json` com `radix-nova`/`neutral`; 19 componentes em `src/components/ui`.
- `themeCssVariables` emite `--primary`, `--primary-foreground`, `--ring`, `--heading-font`.
- Painel/admin com toggle; demais rotas claras; impressão clara.
- `styles.ts` e `form-controls.tsx` intactos.
- `git log --format='%ae' main..HEAD` mostra só `ryancorazzaalvarenga@gmail.com`.
