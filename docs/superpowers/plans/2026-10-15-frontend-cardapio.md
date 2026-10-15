# Reforma do frontend — Cardápio público: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer com shadcn/ui as telas públicas da loja (cardápio, item, checkout, acompanhamento) com a marca da loja, item em tela cheia com `?item=` e checkout em 4 etapas com `?etapa=`.

**Architecture:** `StoreShell` (servidor) aplica as variáveis do tema num wrapper e `StoreThemeRoot` (cliente) as replica no `<html>` para componentes em portal. Lógica pura (etapas, parâmetro do item, linha do tempo) fica em `.ts` com teste unitário. As telas são reescritas no lugar, quebrando `item-dialog.tsx` e `checkout.tsx` em componentes focados; carrinho, preço (`priceItem`), `quote`/`placeOrder`, idempotência e honeypot ficam intactos.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind v4, shadcn 4.21.5 (radix-nova), sonner, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-cardapio-design.md`

## Global Constraints

- Branch `frontend-shadcn`; commits com o email do repo (já no git config local); mensagens `feat:`/`fix:`/`refactor:`/`test:` em inglês terminando com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Next 16.4 tem mudanças incompatíveis: antes de escrever código Next, ler o guia relevante em `node_modules/next/dist/docs/`. URL sem navegação: `window.history.pushState`/`replaceState` integram com `useSearchParams` (`01-app/01-getting-started/04-linking-and-navigating.md`, seção "Native History API").
- Sem mudança de regra de negócio: não alterar `priceItem`, `cart-context`, `cart-storage`, `actions.ts`, `messages.ts`, schema de checkout nem banco. Única mudança de dados: `getOrderTracking` passa a devolver `logoUrl` e `theme` da loja.
- `src/components/ui/*` é gerado: não editar.
- Cardápio sempre claro: telas públicas sem classes `dark:` e sem cores fixas `neutral-*`/`red-*`/`green-*` (exceto o botão verde do WhatsApp, `bg-green-700 text-white`, mantido por ser a cor reconhecível do WhatsApp).
- **A cor da loja nunca é cor de texto sobre fundo claro** (primária amarela ficaria ilegível): usar `bg-primary text-primary-foreground` / `border-primary`; preços e rótulos ficam em `text-foreground`/`text-muted-foreground`. (Ajuste ao spec §3.3/§3.6, que pedia preço e etapa atual em `text-primary`.)
- Textos de interface em pt-BR. Nomes acessíveis usados pelos E2E são contrato: `Adicionar <produto>`, diálogo com nome do produto, `Diminuir/Aumentar quantidade`, `Ver sacola` (texto com `(N)`), `Seu nome`, `WhatsApp (com DDD)`, `Rua`, `Número`, `Bairro`, `Troco para (deixe vazio se não precisa)`, `Confirmar pedido`, `Revisar pedido`, `data-testid` `open-status`, `quote-total`, `checkout-error`, `item-error`, `order-status`.
- E2E: `make e2e` (sobe DB, migra, builda, roda Playwright na porta 3000). Um servidor de dev do usuário roda na porta 3001: nunca matar processos `node` em massa.
- Verificação por task: `npm run lint && npm run typecheck && npm test` e, quando a task mexe em tela, `make e2e`.

## Review Focus

- Link com `?item=` de produto esgotado ou inexistente: não abre nada e limpa o parâmetro — unit (`parseItemParam`, Task 1) + E2E (Task 3).
- Recarregar a página no meio do checkout (`?etapa=3`): volta para a etapa 1 sem quebrar — E2E (Task 5).
- Erro de campo devolvido pelo servidor na etapa 4 para um campo de etapa anterior: leva à etapa do campo — unit (`firstErrorStep`, Task 1).
- Loja com primária clara: preço, etapa atual da linha do tempo e textos continuam legíveis — regra global acima, conferida no review de cada task (sem `text-primary` em telas públicas: grep na Task 7).
- Botão voltar do celular com o item aberto: fecha o item e mantém o cardápio — E2E (Task 3).

---

### Task 1: Lógica pura (etapas, parâmetro do item, linha do tempo)

**Files:**
- Create: `src/app/[slug]/_lib/checkout-steps.ts`, `src/app/[slug]/_lib/checkout-steps.test.ts`
- Create: `src/app/[slug]/_lib/item-param.ts`, `src/app/[slug]/_lib/item-param.test.ts`
- Modify: `src/modules/orders/status.ts` (adicionar `timelineFor` no fim), `src/modules/orders/status.test.ts` (novo `describe` no fim)

**Interfaces:**
- Produces:
  - `CHECKOUT_STEPS: readonly ["Sua sacola", "Entrega", "Seus dados", "Pagamento"]`
  - `type CheckoutStep = 1 | 2 | 3 | 4`
  - `parseStepParam(value: string | null): CheckoutStep`
  - `stepForField(path: string): CheckoutStep`
  - `firstErrorStep(fieldErrors: Record<string, string>): CheckoutStep | null`
  - `ITEM_PARAM = "item"`; `parseItemParam(value: string | null, categories: MenuCategory[]): MenuProduct | null`
  - `type TimelineStep = { status: OrderStatus; state: "done" | "current" | "upcoming" }`; `timelineFor(fulfillment: Fulfillment, status: OrderStatus): TimelineStep[] | null` (exportado por `@/modules/orders` via `export * from "./status"` já existente)

- [ ] **Step 1: Testes que falham — etapas**

`src/app/[slug]/_lib/checkout-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { firstErrorStep, parseStepParam, stepForField } from "./checkout-steps";

describe("parseStepParam", () => {
  it.each([
    [null, 1],
    ["0", 1],
    ["1", 1],
    ["2", 2],
    ["4", 4],
    ["5", 1],
    ["abc", 1],
    ["2.5", 1],
  ])("%s → %s", (value, expected) => {
    expect(parseStepParam(value)).toBe(expected);
  });
});

describe("stepForField", () => {
  it.each([
    ["items", 1],
    ["items.0.optionIds", 1],
    ["fulfillment", 2],
    ["address", 2],
    ["address.street", 2],
    ["tableLabel", 2],
    ["customer.name", 3],
    ["customer.phone", 3],
    ["payment.changeForCents", 4],
    ["notes", 4],
    ["algo-desconhecido", 4],
  ])("%s → etapa %s", (path, expected) => {
    expect(stepForField(path)).toBe(expected);
  });
});

describe("firstErrorStep", () => {
  it("sem erros de campo devolve null", () => {
    expect(firstErrorStep({})).toBeNull();
  });

  it("devolve a menor etapa entre os campos com erro", () => {
    expect(firstErrorStep({ "payment.changeForCents": "x", "address.number": "y", "customer.name": "z" })).toBe(2);
  });
});
```

- [ ] **Step 2: Testes que falham — parâmetro do item**

`src/app/[slug]/_lib/item-param.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MenuCategory, MenuProduct } from "@/modules/catalog";
import { parseItemParam } from "./item-param";

function product(id: string, available = true): MenuProduct {
  return { id, name: id, description: null, imageUrl: null, priceCents: 1000, sizePrices: [], allowsHalf: false, available, optionGroupIds: [] };
}

const categories: MenuCategory[] = [
  { id: "c1", name: "Pizzas", sizes: [], products: [product("p1"), product("p2", false)] },
  { id: "c2", name: "Bebidas", sizes: [], products: [product("p3")] },
];

describe("parseItemParam", () => {
  it("devolve o produto disponível", () => {
    expect(parseItemParam("p3", categories)?.id).toBe("p3");
  });

  it("ignora produto esgotado", () => {
    expect(parseItemParam("p2", categories)).toBeNull();
  });

  it("ignora id inexistente", () => {
    expect(parseItemParam("nao-existe", categories)).toBeNull();
  });

  it("ignora parâmetro ausente", () => {
    expect(parseItemParam(null, categories)).toBeNull();
  });
});
```

Se o typecheck acusar campo faltando em `MenuProduct`/`MenuCategory` (tipos em `src/modules/catalog/menu.ts`), complete a fábrica com os campos do tipo real.

- [ ] **Step 3: Testes que falham — linha do tempo**

No fim de `src/modules/orders/status.test.ts` (ajuste o import existente para incluir `timelineFor`):

```ts
describe("timelineFor", () => {
  it("delivery em preparo: recebido feito, preparo atual, resto adiante", () => {
    expect(timelineFor("delivery", "preparing")).toEqual([
      { status: "received", state: "done" },
      { status: "preparing", state: "current" },
      { status: "out_for_delivery", state: "upcoming" },
      { status: "completed", state: "upcoming" },
    ]);
  });

  it("retirada pronta", () => {
    expect(timelineFor("pickup", "ready")?.map((step) => step.state)).toEqual(["done", "done", "current", "upcoming"]);
  });

  it("concluído marca tudo como feito", () => {
    expect(timelineFor("dine_in", "completed")?.every((step) => step.state === "done")).toBe(true);
  });

  it("cancelado não tem linha do tempo", () => {
    expect(timelineFor("delivery", "cancelled")).toBeNull();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run --project unit src/app/[slug]/_lib src/modules/orders/status.test.ts`
Expected: FAIL — módulos/funções inexistentes.

- [ ] **Step 5: Implementar**

`src/app/[slug]/_lib/checkout-steps.ts`:

```ts
export const CHECKOUT_STEPS = ["Sua sacola", "Entrega", "Seus dados", "Pagamento"] as const;

export type CheckoutStep = 1 | 2 | 3 | 4;

export function parseStepParam(value: string | null): CheckoutStep {
  const step = Number(value);
  return step === 2 || step === 3 || step === 4 ? step : 1;
}

// Caminho do erro de campo devolvido pelo servidor → etapa onde o campo está.
export function stepForField(path: string): CheckoutStep {
  const [root] = path.split(".");
  if (root === "items") return 1;
  if (root === "fulfillment" || root === "address" || root === "tableLabel") return 2;
  if (root === "customer") return 3;
  return 4;
}

export function firstErrorStep(fieldErrors: Record<string, string>): CheckoutStep | null {
  const paths = Object.keys(fieldErrors);
  if (paths.length === 0) return null;
  return Math.min(...paths.map(stepForField)) as CheckoutStep;
}
```

`src/app/[slug]/_lib/item-param.ts`:

```ts
import type { MenuCategory, MenuProduct } from "@/modules/catalog";

export const ITEM_PARAM = "item";

// ?item=<id> só abre produto que existe e está disponível.
export function parseItemParam(value: string | null, categories: MenuCategory[]): MenuProduct | null {
  if (!value) return null;
  for (const category of categories) {
    const product = category.products.find((item) => item.id === value);
    if (product) return product.available ? product : null;
  }
  return null;
}
```

No fim de `src/modules/orders/status.ts`:

```ts
export type TimelineStep = { status: OrderStatus; state: "done" | "current" | "upcoming" };

// Etapas do fluxo do pedido para o acompanhamento do cliente; cancelado não tem linha do tempo.
export function timelineFor(fulfillment: Fulfillment, status: OrderStatus): TimelineStep[] | null {
  if (status === "cancelled") return null;
  const flow = FLOWS[fulfillment];
  const index = flow.indexOf(status);
  return flow.map((step, position) => ({
    status: step,
    state: position < index || status === "completed" ? "done" : position === index ? "current" : "upcoming",
  }));
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run --project unit src/app/[slug]/_lib src/modules/orders/status.test.ts`
Expected: PASS.

- [ ] **Step 7: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm test`

```bash
git add src/app/[slug]/_lib src/modules/orders/status.ts src/modules/orders/status.test.ts
git commit -m "feat: pure helpers for checkout steps, item param and order timeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tema da loja no `<html>` (StoreShell) e limpeza de `--brand-primary`

**Files:**
- Create: `src/app/[slug]/_components/store-shell.tsx`, `src/app/[slug]/_components/store-theme-root.tsx`
- Modify: `src/modules/stores/theme.ts`, `src/modules/stores/theme.test.ts`
- Modify: `src/modules/orders/service.ts` (tipo `OrderTracking.store` e retorno de `getOrderTracking`)
- Modify: `src/app/[slug]/page.tsx`, `src/app/[slug]/sacola/page.tsx`, `src/app/[slug]/pedido/[token]/page.tsx`
- Modify (troca mecânica de classe): `src/app/[slug]/_components/cart-bar.tsx`, `add-to-cart-button.tsx`, `store-header.tsx`, `item-dialog.tsx`, `src/app/[slug]/sacola/_components/checkout.tsx`
- Modify: `e2e/painel.spec.ts:86`, `e2e/menu.spec.ts` (novo teste)

**Interfaces:**
- Consumes: `themeCssVariables(theme)` (Fundação).
- Produces: `StoreShell({ theme: Store["theme"]; children: ReactNode })`; `StoreThemeRoot({ vars: Record<string, string> })`; `OrderTracking.store` com `logoUrl: string | null` e `theme: Store["theme"]`; `themeCssVariables` sem `--brand-primary*`.

- [ ] **Step 1: Teste do tema sem `--brand-primary` (falha)**

Em `src/modules/stores/theme.test.ts`, no teste "gera variáveis da marca e sobrescreve os tokens do shadcn", remover as linhas `"--brand-primary": ...` e `"--brand-primary-foreground": ...` do objeto esperado. No teste "primária clara ganha texto preto nos botões", remover `expect(vars["--brand-primary-foreground"]).toBe("#000000");`.

Run: `npx vitest run --project unit src/modules/stores/theme.test.ts` → FAIL (objeto tem chaves a mais).

- [ ] **Step 2: Implementar**

Em `src/modules/stores/theme.ts`, remover as duas chaves `--brand-primary` e `--brand-primary-foreground` do objeto devolvido por `themeCssVariables` e atualizar o comentário acima da função para:

```ts
// --primary/--ring/--heading-font fazem os componentes shadcn e os títulos dentro da loja usarem a marca dela;
// --brand-secondary* atende acentos (selo de status, gradiente da capa).
```

Run o teste → PASS.

- [ ] **Step 3: StoreThemeRoot e StoreShell**

`src/app/[slug]/_components/store-theme-root.tsx`:

```tsx
"use client";

import { useEffect } from "react";

// Dialog, Sheet, Select e DropdownMenu do shadcn abrem em portal no <body>, fora do wrapper da loja:
// enquanto a loja está na tela, as mesmas variáveis também valem no <html>.
export function StoreThemeRoot({ vars }: { vars: Record<string, string> }) {
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(vars);
    for (const [name, value] of entries) root.style.setProperty(name, value);
    return () => {
      for (const [name] of entries) root.style.removeProperty(name);
    };
  }, [vars]);

  return null;
}
```

`src/app/[slug]/_components/store-shell.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";
import { themeCssVariables, type Store } from "@/modules/stores";
import { StoreThemeRoot } from "./store-theme-root";

export function StoreShell({ theme, children }: { theme: Store["theme"]; children: ReactNode }) {
  const vars = themeCssVariables(theme);
  return (
    <div style={vars as CSSProperties} className="flex flex-1 flex-col bg-background">
      <StoreThemeRoot vars={vars} />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Usar StoreShell nas páginas**

- `src/app/[slug]/page.tsx`: trocar `<div style={themeCssVariables(store.theme) as CSSProperties} className="flex flex-1 flex-col">` … `</div>` por `<StoreShell theme={store.theme}>` … `</StoreShell>`; remover os imports agora sem uso (`CSSProperties`, `themeCssVariables`); importar `StoreShell` de `./_components/store-shell`.
- `src/app/[slug]/sacola/page.tsx`: mesma troca; importar de `@/app/[slug]/_components/store-shell`.
- `src/modules/orders/service.ts`: no tipo `OrderTracking`, trocar `store: StoreRef & { timezone: string };` por `store: StoreRef & { timezone: string; logoUrl: string | null; theme: Store["theme"] };` (importar `type Store` de `@/modules/stores` junto dos imports existentes desse módulo) e, em `getOrderTracking`, o objeto `store` passa a ser `{ slug: store.slug, name: store.name, whatsappPhone: store.whatsappPhone, timezone: store.timezone, logoUrl: store.logoUrl, theme: store.theme }`.
- `src/app/[slug]/pedido/[token]/page.tsx`: envolver o `<main>` devolvido por `Tracking` com `<StoreShell theme={order.store.theme}>…</StoreShell>`.

- [ ] **Step 5: Troca mecânica de classes**

Run: `grep -rln "brand-primary" src/app` e, em cada arquivo listado, trocar `bg-(--brand-primary)` por `bg-primary` e `text-(--brand-primary-foreground)` por `text-primary-foreground`. Depois `grep -rn "brand-primary" src` deve voltar vazio (o teste e o tema já não usam).

- [ ] **Step 6: E2E**

`e2e/painel.spec.ts:86`: trocar o seletor por `'[style*="--primary:#1d4ed8"]'` (continua `toHaveCount(1)`: o `<html>` recebe `--primary: #1d4ed8` com espaço via `setProperty`, que não casa com o seletor).

No fim de `e2e/menu.spec.ts`:

```ts
test("tema da loja vale no <html> (componentes em portal) e sai ao deixar a loja", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const html = page.locator("html");
  const primary = () => html.evaluate((element) => element.style.getPropertyValue("--primary"));
  await expect.poll(primary).not.toBe("");

  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect.poll(primary).toBe("");
});
```

- [ ] **Step 7: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: tudo verde (37 E2E).

```bash
git add -A src/app/[slug] src/modules/stores/theme.ts src/modules/stores/theme.test.ts src/modules/orders/service.ts e2e/painel.spec.ts e2e/menu.spec.ts
git commit -m "feat: StoreShell applies store theme to <html> for portals; drop --brand-primary

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Item em tela cheia com `?item=`

**Files:**
- Create: `src/app/[slug]/_components/item-url.ts` (cliente: abrir/fechar via History API)
- Create: `src/app/[slug]/_components/item-param-controller.tsx`
- Create: `src/app/[slug]/_components/item-sheet.tsx`, `src/app/[slug]/_components/item-options.tsx`
- Delete: `src/app/[slug]/_components/item-dialog.tsx`
- Modify: `src/app/[slug]/_components/add-to-cart-button.tsx` (passa a chamar `openItem`; a Task 4 o substitui)
- Modify: `src/app/[slug]/page.tsx` (renderizar `<ItemParamController />` dentro de `CartProvider`)
- Modify: `e2e/pedido.spec.ts` (segundo sabor vira radio), `e2e/menu.spec.ts` (novos testes)

**Interfaces:**
- Consumes: `ITEM_PARAM`, `parseItemParam` (Task 1); `usePricingContext()`; `useCart()`; `priceItem`, `describeLine`, `MAX_ITEM_QUANTITY` de `@/modules/orders/client`.
- Produces: `openItem(productId: string): void`, `closeItem(): void` (de `./item-url`); `ItemSheet({ productId, onClose })`; `ItemParamController()`.

- [ ] **Step 1: E2E que falham**

No fim de `e2e/menu.spec.ts`:

```ts
test("item abre com ?item= na URL e o voltar do navegador fecha", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
  const dialog = page.getByRole("dialog", { name: "Coca-Cola 2L" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\?item=/);
  const itemUrl = page.url();

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pizzaria Demo" })).toBeVisible();

  await page.goto(itemUrl);
  await expect(page.getByRole("dialog", { name: "Coca-Cola 2L" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao cardápio" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
});

test("?item= de produto inexistente não abre nada e limpa a URL", async ({ page }) => {
  await page.goto("/pizzaria-demo?item=nao-existe");
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
```

Em `e2e/pedido.spec.ts`, no primeiro teste, trocar

```ts
  await dialog.getByLabel("Segundo sabor (opcional)").selectOption({ label: "Mussarela" });
```

por

```ts
  await dialog.getByRole("radio", { name: "Mussarela", exact: true }).check();
```

Run: `make e2e` → FAIL nos testes novos e no de meio a meio.

- [ ] **Step 2: Abrir/fechar pela URL**

`src/app/[slug]/_components/item-url.ts`:

```ts
"use client";

import { ITEM_PARAM } from "../_lib/item-param";

// true quando a entrada atual do histórico foi criada por openItem: fechar volta uma entrada
// (o mesmo que o botão voltar do celular). Aberto por link direto, fechar só limpa o parâmetro.
let pushedByMenu = false;

function urlWithItem(productId: string | null): string {
  const url = new URL(window.location.href);
  if (productId) url.searchParams.set(ITEM_PARAM, productId);
  else url.searchParams.delete(ITEM_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openItem(productId: string): void {
  pushedByMenu = true;
  window.history.pushState(null, "", urlWithItem(productId));
}

export function closeItem(): void {
  if (pushedByMenu) {
    pushedByMenu = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", urlWithItem(null));
}
```

`src/app/[slug]/_components/item-param-controller.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ITEM_PARAM, parseItemParam } from "../_lib/item-param";
import { ItemSheet } from "./item-sheet";
import { closeItem } from "./item-url";
import { usePricingContext } from "./menu-provider";

export function ItemParamController() {
  const searchParams = useSearchParams();
  const { menu } = usePricingContext();
  const value = searchParams.get(ITEM_PARAM);
  const product = parseItemParam(value, menu.categories);

  useEffect(() => {
    if (value && !product) closeItem();
  }, [value, product]);

  if (!product) return null;
  return <ItemSheet key={product.id} productId={product.id} onClose={closeItem} />;
}
```

- [ ] **Step 3: Seções de opções**

`src/app/[slug]/_components/item-options.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

const SINGLE_FLAVOR = "single";
const NO_OPTION = "none";

function SectionTitle({ id, title, rule }: { id: string; title: string; rule: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      <Badge variant="secondary">{rule}</Badge>
    </div>
  );
}

function OptionRow({ id, label, price, disabled, children }: { id: string; label: string; price?: string; disabled?: boolean; children: ReactNode }) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5",
        disabled && "text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-3">
        {children}
        <span>{label}</span>
      </span>
      {price && <span className="text-sm text-muted-foreground">{price}</span>}
    </Label>
  );
}

export function SizeSection({
  sizes,
  product,
  value,
  onChange,
}: {
  sizes: MenuCategory["sizes"];
  product: MenuProduct;
  value: string;
  onChange: (sizeId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle id="item-size-title" title="Tamanho" rule="Obrigatório" />
      <RadioGroup value={value} onValueChange={onChange} aria-labelledby="item-size-title">
        {sizes.map((size) => {
          const price = product.sizePrices.find((candidate) => candidate.sizeId === size.id)!.priceCents;
          const id = `size-${size.id}`;
          return (
            <OptionRow key={size.id} id={id} label={size.name} price={formatBRL(price)}>
              <RadioGroupItem id={id} value={size.id} />
            </OptionRow>
          );
        })}
      </RadioGroup>
    </section>
  );
}

export function FlavorSection({ flavors, value, onChange }: { flavors: MenuProduct[]; value: string; onChange: (flavorId: string) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle id="item-flavor-title" title="Meio a meio" rule="Opcional" />
      <RadioGroup
        value={value || SINGLE_FLAVOR}
        onValueChange={(next) => onChange(next === SINGLE_FLAVOR ? "" : next)}
        aria-labelledby="item-flavor-title"
      >
        <OptionRow id="flavor-single" label="Só este sabor">
          <RadioGroupItem id="flavor-single" value={SINGLE_FLAVOR} />
        </OptionRow>
        {flavors.map((flavor) => (
          <OptionRow key={flavor.id} id={`flavor-${flavor.id}`} label={flavor.name}>
            <RadioGroupItem id={`flavor-${flavor.id}`} value={flavor.id} />
          </OptionRow>
        ))}
      </RadioGroup>
    </section>
  );
}

export function AddonGroupSection({
  group,
  selected,
  onToggle,
}: {
  group: MenuOptionGroup;
  selected: string[];
  onToggle: (optionId: string, checked: boolean) => void;
}) {
  const titleId = `group-${group.id}-title`;
  const rule = group.minSelect > 0 ? (group.maxSelect === 1 ? "Obrigatório" : `Obrigatório · até ${group.maxSelect}`) : `Até ${group.maxSelect}`;
  const selectedInGroup = group.options.filter((option) => selected.includes(option.id));
  const label = (option: MenuOptionGroup["options"][number]) => `${option.name}${option.available ? "" : " (esgotado)"}`;
  const price = (option: MenuOptionGroup["options"][number]) => (option.priceCents > 0 ? `+ ${formatBRL(option.priceCents)}` : undefined);

  if (group.maxSelect === 1) {
    return (
      <section className="flex flex-col gap-3">
        <SectionTitle id={titleId} title={group.name} rule={rule} />
        <RadioGroup
          value={selectedInGroup[0]?.id ?? NO_OPTION}
          onValueChange={(next) => onToggle(next === NO_OPTION ? "" : next, next !== NO_OPTION)}
          aria-labelledby={titleId}
        >
          {group.minSelect === 0 && (
            <OptionRow id={`${titleId}-none`} label="Nenhuma">
              <RadioGroupItem id={`${titleId}-none`} value={NO_OPTION} />
            </OptionRow>
          )}
          {group.options.map((option) => (
            <OptionRow key={option.id} id={`option-${option.id}`} label={label(option)} price={price(option)} disabled={!option.available}>
              <RadioGroupItem id={`option-${option.id}`} value={option.id} disabled={!option.available} />
            </OptionRow>
          ))}
        </RadioGroup>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={titleId}>
      <SectionTitle id={titleId} title={group.name} rule={rule} />
      {group.options.map((option) => {
        const checked = selected.includes(option.id);
        const disabled = !option.available || (!checked && selectedInGroup.length >= group.maxSelect);
        return (
          <OptionRow key={option.id} id={`option-${option.id}`} label={label(option)} price={price(option)} disabled={disabled}>
            <Checkbox
              id={`option-${option.id}`}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => onToggle(option.id, next === true)}
            />
          </OptionRow>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 4: ItemSheet**

`src/app/[slug]/_components/item-sheet.tsx` — porta a lógica de `item-dialog.tsx` (derivações de `sizes`, `halfAllowed`, `secondFlavors`, `flavorIds`, `groups`, `activeOptionIds`, `input`, `priced`, `toggleOption` **sem mudança**) para a nova tela:

```tsx
"use client";

import Image from "next/image";
import { ArrowLeftIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { describeLine, MAX_ITEM_QUANTITY, priceItem, type CartItemInput, type PricedLine } from "@/modules/orders/client";
import { isDomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";
import { useCart } from "./cart-context";
import { AddonGroupSection, FlavorSection, SizeSection } from "./item-options";
import { usePricingContext } from "./menu-provider";

function errorText(error: unknown): string {
  if (!isDomainError(error)) return "Não foi possível calcular o preço.";
  if (error.code === "INVALID_OPTIONS") return String(error.details.reason ?? "Revise as opções.");
  if (error.code === "ITEM_UNAVAILABLE") return `${String(error.details.name ?? "Item")} está esgotado.`;
  return "Revise as opções.";
}

export function ItemSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const ctx = usePricingContext();
  const cart = useCart();

  const category = ctx.menu.categories.find((item) => item.products.some((product) => product.id === productId))!;
  const product = category.products.find((item) => item.id === productId)!;
  const sizes = category.sizes.filter((size) => product.sizePrices.some((price) => price.sizeId === size.id));

  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [secondFlavorId, setSecondFlavorId] = useState("");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const size = sizes.find((item) => item.id === sizeId);
  const halfAllowed = Boolean(size && size.maxFlavors > 1 && product.allowsHalf && ctx.halfAndHalfEnabled);
  const secondFlavors: MenuProduct[] = halfAllowed
    ? category.products.filter(
        (item) => item.id !== product.id && item.allowsHalf && item.available && item.sizePrices.some((price) => price.sizeId === sizeId),
      )
    : [];
  const flavorIds = halfAllowed && secondFlavorId ? [product.id, secondFlavorId] : [product.id];

  const groups: MenuOptionGroup[] = ctx.addonsEnabled
    ? [...new Set(flavorIds.flatMap((id) => category.products.find((item) => item.id === id)?.optionGroupIds ?? []))]
        .map((groupId) => ctx.menu.optionGroups.find((group) => group.id === groupId))
        .filter((group): group is MenuOptionGroup => group !== undefined)
    : [];

  const visibleOptionIds = new Set(groups.flatMap((group) => group.options.map((option) => option.id)));
  const activeOptionIds = optionIds.filter((id) => visibleOptionIds.has(id));

  const input: CartItemInput =
    sizes.length > 0
      ? { kind: "sized", sizeId, flavorIds, optionIds: activeOptionIds, quantity, notes: notes.trim() || null }
      : { kind: "simple", productId: product.id, optionIds: activeOptionIds, quantity, notes: notes.trim() || null };

  const priced = useMemo<{ line: PricedLine } | { error: string }>(() => {
    try {
      return { line: priceItem(ctx, input, 0) };
    } catch (error) {
      return { error: errorText(error) };
    }
    // input é derivado dos estados abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, sizeId, secondFlavorId, optionIds, quantity, notes]);

  function toggleOption(group: MenuOptionGroup, optionId: string, checked: boolean) {
    setOptionIds((current) => {
      const groupOptionIds = new Set(group.options.map((option) => option.id));
      if (group.maxSelect === 1) return [...current.filter((id) => !groupOptionIds.has(id)), ...(checked && optionId ? [optionId] : [])];
      return checked ? [...current, optionId] : current.filter((id) => id !== optionId);
    });
  }

  function addToCart() {
    if (!("line" in priced)) return;
    cart.add({ input, label: describeLine(priced.line), unitPriceCents: priced.line.unitPriceCents });
    toast.success(`${product.name} adicionado à sacola`);
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="relative shrink-0">
          {product.imageUrl ? (
            <div className="relative aspect-video w-full bg-muted">
              <Image src={product.imageUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div aria-hidden="true" className="flex h-24 items-end bg-primary px-4 pb-3 text-primary-foreground">
              <span className="text-xl font-bold [font-family:var(--heading-font)]">{product.name}</span>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Voltar ao cardápio"
            onClick={onClose}
            className="absolute top-3 left-3 rounded-full shadow-md"
          >
            <ArrowLeftIcon />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className={product.imageUrl ? "text-xl font-bold" : "sr-only"}>{product.name}</DialogTitle>
            <DialogDescription className={product.description ? undefined : "sr-only"}>
              {product.description ?? "Monte o item e adicione à sacola."}
            </DialogDescription>
          </div>

          {sizes.length > 0 && (
            <SizeSection
              sizes={sizes}
              product={product}
              value={sizeId}
              onChange={(id) => {
                setSizeId(id);
                setSecondFlavorId("");
              }}
            />
          )}

          {halfAllowed && secondFlavors.length > 0 && <FlavorSection flavors={secondFlavors} value={secondFlavorId} onChange={setSecondFlavorId} />}

          {groups.map((group) => (
            <AddonGroupSection
              key={group.id}
              group={group}
              selected={optionIds}
              onToggle={(optionId, checked) => toggleOption(group, optionId, checked)}
            />
          ))}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`notes-${product.id}`}>Observações</Label>
            <Textarea
              id={`notes-${product.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Ex.: sem cebola"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-4">
          {"error" in priced && (
            <p data-testid="item-error" className="text-sm text-destructive">
              {priced.error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Diminuir quantidade" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <MinusIcon />
              </Button>
              <output aria-label="Quantidade" className="min-w-6 text-center font-medium">
                {quantity}
              </output>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((q) => Math.min(MAX_ITEM_QUANTITY, q + 1))}
              >
                <PlusIcon />
              </Button>
            </div>
            <Button type="button" size="lg" className="flex-1" onClick={addToCart} disabled={!("line" in priced)}>
              {"line" in priced ? `Adicionar · ${formatBRL(priced.line.totalCents)}` : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Ligar no cardápio**

`src/app/[slug]/_components/add-to-cart-button.tsx` (provisório até a Task 4):

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { openItem } from "./item-url";

export function AddToCartButton({ productId, productName }: { productId: string; productName: string }) {
  return (
    <Button type="button" size="sm" className="rounded-full" aria-label={`Adicionar ${productName}`} onClick={() => openItem(productId)}>
      Adicionar
    </Button>
  );
}
```

`src/app/[slug]/page.tsx`: importar `ItemParamController` de `./_components/item-param-controller` e renderizar `<ItemParamController />` logo antes de `<CartBar slug={store.slug} />` (dentro de `CartProvider`). Apagar `src/app/[slug]/_components/item-dialog.tsx` (`git rm`).

- [ ] **Step 6: Verificar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: verde, incluindo os 2 testes novos do `menu.spec.ts` e o fluxo meio a meio do `pedido.spec.ts` (total R$ 64,90 no item).

- [ ] **Step 7: Commit**

```bash
git add -A src/app/[slug] e2e/menu.spec.ts e2e/pedido.spec.ts
git commit -m "feat: full-screen item sheet with ?item= URL state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Topo com capa, categorias e lista de produtos

**Files:**
- Create: `src/app/[slug]/_lib/anchors.ts`, `src/app/[slug]/_lib/price-label.ts`
- Create: `src/app/[slug]/_components/product-row.tsx`
- Delete: `src/app/[slug]/_components/product-card.tsx`, `src/app/[slug]/_components/add-to-cart-button.tsx`
- Modify: `src/app/[slug]/_components/store-header.tsx`, `category-nav.tsx`, `open-status.tsx`, `cart-bar.tsx`, `store-footer.tsx`, `src/app/[slug]/not-found.tsx`, `src/app/[slug]/page.tsx`
- Modify: `e2e/menu.spec.ts` (teste da capa)

**Interfaces:**
- Consumes: `openItem` (Task 3); `StoreShell` (Task 2).
- Produces: `categoryAnchor(categoryId: string): string` em `_lib/anchors.ts` (antes em `category-nav.tsx`); `priceLabel(product: MenuProduct): string | null` em `_lib/price-label.ts`; `ProductRow({ product, price })`.

- [ ] **Step 1: E2E da capa (falha)**

No fim de `e2e/menu.spec.ts`:

```ts
test("loja sem foto de capa mostra o topo em gradiente", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await expect(page.getByTestId("cover-fallback")).toBeVisible();
});
```

(A Pizzaria Demo do seed não tem `bannerUrl`.) Run `make e2e` → FAIL.

- [ ] **Step 2: Helpers server-side**

`src/app/[slug]/_lib/anchors.ts`:

```ts
export function categoryAnchor(categoryId: string): string {
  return `categoria-${categoryId}`;
}
```

`src/app/[slug]/_lib/price-label.ts` (mesma regra do `priceLabel` atual de `product-card.tsx`):

```ts
import { startingPriceCents, type MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

export function priceLabel(product: MenuProduct): string | null {
  const cents = startingPriceCents(product);
  if (cents === null) return null;
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}
```

- [ ] **Step 3: Topo**

`src/app/[slug]/_components/store-header.tsx`:

```tsx
import Image from "next/image";
import type { ReactNode } from "react";
import type { Store } from "@/modules/stores";

export function StoreHeader({ store, status }: { store: Store; status: ReactNode }) {
  return (
    <header className="bg-background">
      <div className="relative mx-auto aspect-[3/1] max-h-56 w-full max-w-3xl overflow-hidden sm:rounded-b-2xl">
        {store.bannerUrl ? (
          <Image src={store.bannerUrl} alt="" fill unoptimized priority className="object-cover" />
        ) : (
          <div data-testid="cover-fallback" className="size-full bg-linear-to-br from-primary to-brand-secondary" />
        )}
      </div>
      <div className="mx-auto flex max-w-3xl items-end gap-4 px-4">
        <div className="-mt-10 size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-primary shadow-md">
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={`Logo de ${store.name}`} width={80} height={80} unoptimized className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-full place-items-center text-3xl font-bold text-primary-foreground [font-family:var(--heading-font)]">
              {store.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 py-3">
          <h1 className="truncate text-2xl font-bold">{store.name}</h1>
          {store.address && <p className="truncate text-sm text-muted-foreground">{store.address}</p>}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-3">{status}</div>
    </header>
  );
}
```

`src/app/[slug]/_components/open-status.tsx`: manter a lógica; trocar o `<span>` por:

```tsx
    <Badge
      data-testid="open-status"
      variant="secondary"
      className={status.isOpen ? "bg-brand-secondary text-brand-secondary-foreground" : undefined}
    >
      {formatOpenStatus(status)}
    </Badge>
```

(importar `Badge` de `@/components/ui/badge`). No `page.tsx`, o fallback do Suspense do status vira `<Badge variant="secondary">Verificando horário...</Badge>`.

- [ ] **Step 4: Abas de categoria**

`src/app/[slug]/_components/category-nav.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryAnchor } from "../_lib/anchors";

type NavCategory = { id: string; name: string };

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? null);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(categoryAnchor(category.id)))
      .filter((element): element is HTMLElement => element !== null);
    // A seção mais alta que cruza a faixa logo abaixo das abas é a ativa.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace(categoryAnchor(""), ""));
      },
      { rootMargin: "-64px 0px -60% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (!active) return;
    document.querySelector(`[data-category-tab="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="Categorias" className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <a
              href={`#${categoryAnchor(category.id)}`}
              data-category-tab={category.id}
              aria-current={active === category.id ? "true" : undefined}
              className={cn(
                "block rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active === category.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted",
              )}
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

(Ruling do plano: o clique usa o salto nativo da âncora — o E2E depende do `#categoria-` na URL; a rolagem suave do spec fica de fora.)

- [ ] **Step 5: Linha de produto**

`src/app/[slug]/_components/product-row.tsx`:

```tsx
"use client";

import Image from "next/image";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MenuProduct } from "@/modules/catalog";
import { openItem } from "./item-url";

export function ProductRow({ product, price }: { product: MenuProduct; price: string | null }) {
  const open = product.available ? () => openItem(product.id) : undefined;

  return (
    <article onClick={open} className={cn("flex gap-3 py-4", product.available && "cursor-pointer")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {price && <span className="font-semibold">{price}</span>}
          {!product.available && <Badge variant="secondary">Esgotado</Badge>}
        </div>
      </div>
      <div className="relative flex shrink-0 items-end">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt=""
            width={80}
            height={80}
            unoptimized
            className={cn("size-20 rounded-lg object-cover", !product.available && "grayscale")}
          />
        )}
        {product.available && (
          <Button
            type="button"
            size="icon"
            aria-label={`Adicionar ${product.name}`}
            onClick={(event) => {
              event.stopPropagation();
              openItem(product.id);
            }}
            className={cn("rounded-full shadow-md", product.imageUrl && "absolute -right-2 -bottom-2")}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Página, barra da sacola, rodapé, não encontrada**

`src/app/[slug]/page.tsx`: importar `categoryAnchor` de `./_lib/anchors`, `priceLabel` de `./_lib/price-label`, `ProductRow` de `./_components/product-row`; o `<main>` passa a ser:

```tsx
          <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4">
            {menu.categories.map((category) => (
              <section key={category.id} id={categoryAnchor(category.id)} aria-labelledby={`${categoryAnchor(category.id)}-title`} className="scroll-mt-16">
                <h2 id={`${categoryAnchor(category.id)}-title`} className="text-xl font-bold">
                  {category.name}
                </h2>
                <div className="divide-y">
                  {category.products.map((product) => (
                    <ProductRow key={product.id} product={product} price={priceLabel(product)} />
                  ))}
                </div>
              </section>
            ))}
          </main>
```

e `<CategoryNav categories={menu.categories.map(({ id, name }) => ({ id, name }))} />`. O fallback de carregamento da página vira `<p className="p-6 text-muted-foreground">Carregando cardápio...</p>`. Apagar `product-card.tsx` e `add-to-cart-button.tsx` (`git rm`).

`src/app/[slug]/_components/cart-bar.tsx` — o `Link` vira:

```tsx
      <Link
        href={`/${slug}/sacola`}
        aria-label="Ver sacola"
        className="mx-auto flex max-w-3xl items-center justify-between rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg"
      >
        <span className="flex items-center gap-2">
          <ShoppingBagIcon className="size-5" aria-hidden="true" />
          Ver sacola ({cart.count})
        </span>
        <span>{formatBRL(cart.estimatedSubtotalCents)}</span>
      </Link>
```

(`import { ShoppingBagIcon } from "lucide-react";`; o texto mantém `(N)` por ser contrato dos E2E.)

`src/app/[slug]/_components/store-footer.tsx`: trocar a classe do `<footer>` por `"mx-auto w-full max-w-3xl px-4 pt-6 pb-28 text-sm text-muted-foreground"` (sem `dark:`).

`src/app/[slug]/not-found.tsx`: o parágrafo usa `text-muted-foreground`; o link vira `<Button asChild variant="outline"><Link href="/">Voltar ao início</Link></Button>` (importar `Button`).

- [ ] **Step 7: Verificar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: verde (incluindo "cardápio público da Pizzaria Demo", "link de categoria leva à seção", "produto esgotado não tem botão de adicionar" e o teste novo da capa).

Run: `grep -rnE "dark:|neutral-|brand-primary" src/app/[slug]/page.tsx src/app/[slug]/not-found.tsx src/app/[slug]/_components`
Expected: só ocorrências em arquivos da sacola/pedido ainda não reescritos (nenhuma nos arquivos desta task).

- [ ] **Step 8: Commit**

```bash
git add -A src/app/[slug] e2e/menu.spec.ts
git commit -m "feat: menu with cover header, active category tabs and product rows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Checkout em etapas

**Files:**
- Modify (reescrita): `src/app/[slug]/sacola/_components/checkout.tsx`
- Create: `src/app/[slug]/sacola/_components/text-field.tsx`, `cart-step.tsx`, `delivery-step.tsx`, `customer-step.tsx`, `payment-step.tsx`, `order-placed.tsx`
- Modify: `src/app/[slug]/sacola/page.tsx`
- Modify: `e2e/pedido.spec.ts`, `e2e/helpers.ts` (`placePickupOrder`)

**Interfaces:**
- Consumes: `CHECKOUT_STEPS`, `CheckoutStep`, `parseStepParam`, `firstErrorStep` (Task 1); `useCart()`; `quoteOrderAction`, `placeOrderAction`; `CheckoutError` (`{ code; message; fieldErrors: Record<string,string>; quote? }`).
- Produces: `Checkout({ store: CheckoutStore })` com `CheckoutStore` ganhando `address: string | null`.

- [ ] **Step 1: E2E no novo fluxo (falha)**

`e2e/helpers.ts` — em `placePickupOrder`, trocar o trecho a partir de `await page.getByRole("link", { name: "Ver sacola" }).click();` até o clique em "Confirmar pedido" por:

```ts
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: "Pix" }).check();
  await expect(page.getByTestId("quote-total")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
```

`e2e/pedido.spec.ts`:

- Substituir `fillCustomer` por:

```ts
async function goToCheckout(page: Page) {
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await expect(page).toHaveURL(/\/pizzaria-demo\/sacola$/);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function fillCustomerAndReview(page: Page) {
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("button", { name: "Continuar" }).click();
}
```

- Primeiro teste, do clique em "Ver sacola" até `quote-total`:

```ts
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Delivery" }).check();
  await page.getByLabel("Rua").fill("Rua das Acácias");
  await page.getByLabel("Número").fill("45");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByRole("button", { name: "Continuar" }).click();
  await fillCustomerAndReview(page);
  await page.getByRole("radio", { name: "Dinheiro" }).check();
  await page.getByLabel("Troco para (deixe vazio se não precisa)").fill("100,00");
  await expect(page.getByTestId("quote-total")).toHaveText(/R\$\s84,90/);
```

(o restante do teste — confirmar, mensagem do WhatsApp, acompanhamento — não muda).

- Teste do mínimo:

```ts
test("pedido abaixo do mínimo mostra o valor mínimo e volta à sacola", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Água sem gás 500ml");
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await fillCustomerAndReview(page);
  await page.getByRole("radio", { name: "Pix" }).check();
  await expect(page.getByText("Chave Pix: pix@pizzariademo.com.br")).toBeVisible();
  await expect(page.getByTestId("checkout-error")).toHaveText(/Pedido mínimo de R\$\s30,00 \(sem a entrega\)\./);
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toHaveCount(0);

  await page.getByRole("button", { name: "Voltar à sacola" }).click();
  await expect(page).not.toHaveURL(/etapa=/);
  await page.getByRole("button", { name: "Remover Água sem gás 500ml" }).click();
  await expect(page.getByText("Sua sacola está vazia.")).toBeVisible();
});
```

- Teste da loja fechada: do clique em "Ver sacola" em diante:

```ts
    await goToCheckout(page);
    await page.getByRole("radio", { name: "Retirada no balcão" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillCustomerAndReview(page);
    await expect(page.getByTestId("checkout-error")).toContainText("A loja está fechada agora.");
```

- Testes novos (antes de "link de pedido inválido"):

```ts
test("voltar do navegador volta uma etapa do checkout sem perder os dados", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Coca-Cola 2L");
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await expect(page).toHaveURL(/etapa=3/);

  await page.goBack();
  await expect(page).toHaveURL(/etapa=2/);
  await expect(page.getByRole("radio", { name: "Retirada no balcão" })).toBeChecked();
  await page.goForward();
  await expect(page.getByLabel("Seu nome")).toHaveValue("Maria Silva");
});

test("recarregar no meio do checkout volta para a primeira etapa", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Coca-Cola 2L");
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.reload();
  await expect(page).not.toHaveURL(/etapa=/);
  await expect(page.getByRole("heading", { level: 1, name: "Sua sacola" })).toBeVisible();
});
```

Run: `make e2e` → FAIL (botão "Continuar" inexistente).

- [ ] **Step 2: Campo de texto**

`src/app/[slug]/sacola/_components/text-field.tsx`:

```tsx
"use client";

import { type ComponentProps, useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function TextField({ label, error, ...props }: { label: string; error?: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
```

- [ ] **Step 3: Escolha em cartões (reaproveitada por entrega e pagamento)**

No mesmo arquivo `text-field.tsx`, exportar também:

```tsx
export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <RadioGroup value={value} onValueChange={(next) => onChange(next as T)} aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map(([optionValue, optionLabel]) => (
        <FieldLabel key={optionValue} htmlFor={`${id}-${optionValue}`}>
          <Field orientation="horizontal">
            <RadioGroupItem id={`${id}-${optionValue}`} value={optionValue} />
            <span className="font-medium">{optionLabel}</span>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
```

(acrescentar `import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";`).

- [ ] **Step 4: Etapas**

`src/app/[slug]/sacola/_components/cart-step.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/shared/money";
import { useCart } from "@/app/[slug]/_components/cart-context";

export function CartStep({ hidden, slug, onCartChange, ref }: { hidden: boolean; slug: string; onCartChange: () => void; ref: Ref<HTMLFieldSetElement> }) {
  const cart = useCart();

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-3">
      <legend className="sr-only">Itens da sacola</legend>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {cart.lines.map((line) => (
          <li key={line.key} className="flex flex-col gap-2 p-3">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{line.label}</span>
              <span className="font-semibold whitespace-nowrap">{formatBRL(line.unitPriceCents * line.input.quantity)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Diminuir ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.setQuantity(line.key, line.input.quantity - 1);
                }}
              >
                −
              </Button>
              <span className="min-w-6 text-center">{line.input.quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Aumentar ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.setQuantity(line.key, line.input.quantity + 1);
                }}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={`Remover ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.remove(line.key);
                }}
              >
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline">
        <Link href={`/${slug}`}>Adicionar mais itens</Link>
      </Button>
    </fieldset>
  );
}
```

`src/app/[slug]/sacola/_components/delivery-step.tsx` (o auto-preenchimento por CEP é o `fillFromZipCode` atual, lendo o formulário por `event.currentTarget.form`):

```tsx
"use client";

import { type FocusEvent, type Ref, useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Fulfillment } from "@/modules/orders/client";
import { formatBRL } from "@/shared/money";
import type { CheckoutStore } from "./checkout";
import { ChoiceCards, TextField } from "./text-field";

async function fillFromZipCode(event: FocusEvent<HTMLInputElement>) {
  const digits = event.target.value.replace(/\D/g, "");
  const form = event.currentTarget.form;
  if (digits.length !== 8 || !form) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await response.json()) as { logradouro?: string; bairro?: string; localidade?: string; erro?: boolean };
    if (data.erro) return;
    const fill = (name: string, value?: string) => {
      const field = form.elements.namedItem(name);
      if (value && field instanceof HTMLInputElement && !field.value) field.value = value;
    };
    fill("street", data.logradouro);
    fill("neighborhood", data.bairro);
    fill("city", data.localidade);
  } catch {
    // CEP é só conveniência; o cliente pode digitar o endereço.
  }
}

export function DeliveryStep({
  hidden,
  store,
  fulfillments,
  fulfillment,
  onFulfillmentChange,
  fieldError,
  ref,
}: {
  hidden: boolean;
  store: CheckoutStore;
  fulfillments: readonly (readonly [Fulfillment, string])[];
  fulfillment: Fulfillment;
  onFulfillmentChange: (value: Fulfillment) => void;
  fieldError: (path: string) => string | undefined;
  ref: Ref<HTMLFieldSetElement>;
}) {
  const neighborhoodId = useId();
  const neighborhoodError = fieldError("address.neighborhood") ?? fieldError("address");

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-4">
      <legend className="mb-2 font-semibold">Como você quer receber?</legend>
      <ChoiceCards label="Como você quer receber?" value={fulfillment} options={fulfillments} onChange={onFulfillmentChange} />

      {fulfillment === "delivery" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <TextField label="CEP" name="zipCode" inputMode="numeric" onBlur={fillFromZipCode} error={fieldError("address.zipCode")} />
          <TextField label="Rua" name="street" required error={fieldError("address.street")} />
          <TextField label="Número" name="number" required error={fieldError("address.number")} />
          <TextField label="Complemento" name="complement" />
          {store.deliveryFee.strategy === "by_neighborhood" ? (
            <Field data-invalid={neighborhoodError ? true : undefined}>
              <FieldLabel htmlFor={neighborhoodId}>Bairro</FieldLabel>
              <Select name="neighborhood">
                <SelectTrigger id={neighborhoodId} className="w-full" aria-invalid={neighborhoodError ? true : undefined}>
                  <SelectValue placeholder="Escolha o bairro" />
                </SelectTrigger>
                <SelectContent>
                  {store.zones.map((zone) => (
                    <SelectItem key={zone.neighborhood} value={zone.neighborhood}>
                      {`${zone.neighborhood} — ${formatBRL(zone.feeCents)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {neighborhoodError && <FieldError>{neighborhoodError}</FieldError>}
            </Field>
          ) : (
            <TextField label="Bairro" name="neighborhood" required error={neighborhoodError} />
          )}
          <TextField label="Cidade" name="city" />
          <TextField label="Ponto de referência" name="reference" />
        </div>
      )}

      {fulfillment === "pickup" && store.address && (
        <p className="rounded-xl border bg-card p-4 text-sm">
          Retire em: <span className="font-medium">{store.address}</span>
        </p>
      )}

      {fulfillment === "dine_in" && <TextField label="Mesa" name="tableLabel" required error={fieldError("tableLabel")} />}
    </fieldset>
  );
}
```

`src/app/[slug]/sacola/_components/customer-step.tsx`:

```tsx
"use client";

import type { Ref } from "react";
import { TextField } from "./text-field";

export function CustomerStep({ hidden, fieldError, ref }: { hidden: boolean; fieldError: (path: string) => string | undefined; ref: Ref<HTMLFieldSetElement> }) {
  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-3">
      <legend className="sr-only">Seus dados</legend>
      <TextField label="Seu nome" name="name" autoComplete="name" required error={fieldError("customer.name")} />
      <TextField label="WhatsApp (com DDD)" name="phone" autoComplete="tel" inputMode="tel" required error={fieldError("customer.phone")} />
    </fieldset>
  );
}
```

`src/app/[slug]/sacola/_components/payment-step.tsx`:

```tsx
"use client";

import { type Ref, useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderQuote } from "@/modules/orders";
import type { PaymentMethod } from "@/modules/orders/client";
import { formatBRL } from "@/shared/money";
import { ChoiceCards, TextField } from "./text-field";

export function PaymentStep({
  hidden,
  payments,
  payment,
  onPaymentChange,
  pixKey,
  quote,
  fieldError,
  ref,
}: {
  hidden: boolean;
  payments: readonly (readonly [PaymentMethod, string])[];
  payment: PaymentMethod;
  onPaymentChange: (value: PaymentMethod) => void;
  pixKey: string | null;
  quote: OrderQuote | null;
  fieldError: (path: string) => string | undefined;
  ref: Ref<HTMLFieldSetElement>;
}) {
  const notesId = useId();

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-4">
      <legend className="mb-2 font-semibold">Forma de pagamento</legend>
      <ChoiceCards label="Forma de pagamento" value={payment} options={payments} onChange={onPaymentChange} />
      {payment === "pix" && pixKey && <p className="rounded-xl border bg-card p-4 text-sm">Chave Pix: {pixKey}</p>}
      {payment === "cash" && (
        <TextField label="Troco para (deixe vazio se não precisa)" name="changeFor" inputMode="decimal" error={fieldError("payment.changeForCents")} />
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={notesId}>Observações do pedido</Label>
        <Textarea id={notesId} name="notes" maxLength={300} rows={2} />
      </div>
      {quote && (
        <dl className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-4 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatBRL(quote.subtotalCents)}</dd>
          <dt className="text-muted-foreground">Entrega</dt>
          <dd className="text-right">{formatBRL(quote.deliveryFeeCents)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{formatBRL(quote.totalCents)}</dd>
        </dl>
      )}
    </fieldset>
  );
}
```

`src/app/[slug]/sacola/_components/order-placed.tsx`:

```tsx
import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Placed = { numberLabel: string; trackingPath: string; whatsappUrl: string };

export function OrderPlaced({ placed }: { placed: Placed }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
        <CircleCheckIcon className="size-8" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-bold">Pedido {placed.numberLabel} recebido!</h2>
      <p className="text-muted-foreground">Envie o pedido para a loja pelo WhatsApp para agilizar o atendimento.</p>
      <a
        href={placed.whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white"
      >
        Enviar pedido no WhatsApp
      </a>
      <Button asChild variant="outline" className="w-full">
        <Link href={placed.trackingPath}>Acompanhar pedido</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 5: Orquestração**

Reescrever `src/app/[slug]/sacola/_components/checkout.tsx`. Mantêm-se **exatamente** como hoje: o tipo `CheckoutStore` (acrescido de `address: string | null`), as listas `fulfillments` e `payments`, os estados `fulfillment`, `payment`, `idempotencyKey`, `quote`, `error`, `placed`, `pending`, `formRef`, a função `buildPayload` e o bloco do honeypot.

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderQuote } from "@/modules/orders";
import type { Fulfillment, PaymentMethod } from "@/modules/orders/client";
import { formatBRL, parseBRLToCents } from "@/shared/money";
import { uuid } from "@/shared/uuid";
import { useCart } from "@/app/[slug]/_components/cart-context";
import { CHECKOUT_STEPS, firstErrorStep, parseStepParam, type CheckoutStep } from "@/app/[slug]/_lib/checkout-steps";
import type { CheckoutError } from "@/app/[slug]/sacola/messages";
import { placeOrderAction, quoteOrderAction } from "@/app/[slug]/sacola/actions";
import { CartStep } from "./cart-step";
import { CustomerStep } from "./customer-step";
import { DeliveryStep } from "./delivery-step";
import { OrderPlaced, type Placed } from "./order-placed";
import { PaymentStep } from "./payment-step";

export type CheckoutStore = {
  slug: string;
  address: string | null;
  features: { delivery: boolean; pickup: boolean; dineIn: boolean };
  paymentMethods: { cash: boolean; cardOnDelivery: boolean; pixKey: string | null };
  deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" };
  zones: { neighborhood: string; feeCents: number }[];
};

// Só os campos da etapa atual precisam estar válidos para avançar; o servidor revalida tudo.
function validFieldset(fieldset: HTMLFieldSetElement | null): boolean {
  if (!fieldset) return true;
  for (const element of Array.from(fieldset.elements)) {
    if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && !element.reportValidity()) return false;
  }
  return true;
}

export function Checkout({ store }: { store: CheckoutStore }) {
  const cart = useCart();
  const searchParams = useSearchParams();
  const step = parseStepParam(searchParams.get("etapa"));
  const stepRef = useRef<CheckoutStep>(step);
  stepRef.current = step;
  const fieldsets = useRef<(HTMLFieldSetElement | null)[]>([]);

  // ... fulfillments, payments e estados exatamente como no arquivo atual ...

  // Recarregar no meio do checkout começa de novo: os campos das etapas anteriores estão vazios.
  useEffect(() => {
    if (parseStepParam(new URLSearchParams(window.location.search).get("etapa")) !== 1) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function goTo(target: CheckoutStep) {
    const current = stepRef.current;
    if (target === current) return;
    // Avançar empilha uma entrada (?etapa=N); voltar desempilha, então o voltar do celular anda junto.
    if (target > current) window.history.pushState(null, "", `?etapa=${target}`);
    else window.history.go(target - current);
  }

  function handleError(next: CheckoutError) {
    setError(next);
    const target = firstErrorStep(next.fieldErrors);
    if (target && target < stepRef.current) goTo(target);
  }

  // buildPayload exatamente como no arquivo atual.

  function review() {
    const built = buildPayload(null);
    if ("error" in built) return handleError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await quoteOrderAction(store.slug, built.payload);
      if (result.ok) setQuote(result.quote);
      else {
        setQuote(null);
        handleError(result.error);
      }
    });
  }

  function confirm() {
    if (!quote) return;
    const built = buildPayload(quote.totalCents);
    if ("error" in built) return handleError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await placeOrderAction(store.slug, built.payload);
      if (result.ok) {
        cart.clear();
        setPlaced(result.placed);
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        setQuote(result.error.quote ?? null);
        handleError(result.error);
      }
    });
  }

  function next() {
    if (step === 1 && cart.lines.length === 0) return;
    if (!validFieldset(fieldsets.current[step - 1] ?? null)) return;
    goTo((step + 1) as CheckoutStep);
    if (step === 3) review();
  }

  if (placed) return <OrderPlaced placed={placed} />;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Sua sacola</h1>
        <p className="text-muted-foreground">Sua sacola está vazia.</p>
        <Button asChild>
          <Link href={`/${store.slug}`}>Voltar ao cardápio</Link>
        </Button>
      </div>
    );
  }

  const fieldError = (path: string) => error?.fieldErrors[path];
  const invalidateQuote = () => setQuote(null);

  return (
    <form
      ref={formRef}
      onSubmit={(event: FormEvent) => event.preventDefault()}
      onChange={() => {
        // Na etapa 4 só mudam pagamento/troco/observação, que não alteram o total; confirmar revalida no servidor.
        if (stepRef.current < 4) setQuote(null);
      }}
      className="flex flex-1 flex-col"
    >
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          {step > 1 ? (
            <Button type="button" variant="ghost" size="icon" aria-label="Voltar" onClick={() => goTo((step - 1) as CheckoutStep)}>
              <ArrowLeftIcon />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon">
              <Link href={`/${store.slug}`} aria-label="Voltar ao cardápio">
                <ArrowLeftIcon />
              </Link>
            </Button>
          )}
          <h1 className="flex-1 text-lg font-semibold">{CHECKOUT_STEPS[step - 1]}</h1>
          <span className="text-sm text-muted-foreground">{step} de 4</span>
        </div>
        <div aria-hidden="true" className="mx-auto flex max-w-2xl gap-1 px-4 pb-3">
          {[1, 2, 3, 4].map((position) => (
            <span key={position} className={cn("h-1 flex-1 rounded-full", position <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        <CartStep ref={(element) => { fieldsets.current[0] = element; }} hidden={step !== 1} slug={store.slug} onCartChange={invalidateQuote} />
        <DeliveryStep
          ref={(element) => { fieldsets.current[1] = element; }}
          hidden={step !== 2}
          store={store}
          fulfillments={fulfillments}
          fulfillment={fulfillment}
          onFulfillmentChange={(value) => {
            invalidateQuote();
            setFulfillment(value);
          }}
          fieldError={fieldError}
        />
        <CustomerStep ref={(element) => { fieldsets.current[2] = element; }} hidden={step !== 3} fieldError={fieldError} />
        <PaymentStep
          ref={(element) => { fieldsets.current[3] = element; }}
          hidden={step !== 4}
          payments={payments}
          payment={payment}
          onPaymentChange={setPayment}
          pixKey={store.paymentMethods.pixKey}
          quote={quote}
          fieldError={fieldError}
        />

        {/* Honeypot: bloco atual, sem mudança. */}

        {error && (
          <Alert variant="destructive" data-testid="checkout-error">
            <AlertDescription className="flex flex-col gap-2">
              {error.message}
              {error.code === "BELOW_MIN_ORDER" && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => goTo(1)}>
                  Voltar à sacola
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <footer className="sticky bottom-0 border-t bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{quote ? "Total" : "Subtotal"}</span>
            <span data-testid={quote ? "quote-total" : undefined} className="font-semibold">
              {formatBRL(quote ? quote.totalCents : cart.estimatedSubtotalCents)}
            </span>
          </div>
          {step < 4 ? (
            <Button type="button" size="lg" className="flex-1" onClick={next} disabled={!cart.ready || cart.lines.length === 0}>
              Continuar
            </Button>
          ) : quote ? (
            <Button type="button" size="lg" className="flex-1" onClick={confirm} disabled={pending}>
              Confirmar pedido
            </Button>
          ) : (
            <Button type="button" size="lg" className="flex-1" onClick={review} disabled={pending || !cart.ready}>
              {pending ? "Calculando..." : "Revisar pedido"}
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}
```

Notas para o executor:
- `buildPayload`, as listas, os estados e o honeypot vêm do arquivo atual sem alteração (o honeypot fica entre `PaymentStep` e o `Alert`). O tipo `Placed` sai do arquivo e passa a vir de `./order-placed`.
- O `eslint-disable` não é necessário no `useEffect` de montagem (array vazio e nada de fora usado).
- Se `react-hooks` reclamar de `stepRef.current = step` durante o render, troque por `useEffect(() => { stepRef.current = step; }, [step]);` **e** mantenha `goTo` lendo `stepRef.current`.

- [ ] **Step 6: Página da sacola**

`src/app/[slug]/sacola/page.tsx`: dentro de `<StoreShell>`/`<CartProvider>`, remover o link "← Voltar ao cardápio", o `<h1>Sua sacola</h1>` e o `<main>` com padding (o `Checkout` agora desenha topo e rodapé); renderizar `<main className="flex flex-1 flex-col"><Checkout store={{ ...campos atuais, address: store.address }} /></main>`. O fallback do Suspense vira `<p className="p-6 text-muted-foreground">Carregando sacola...</p>`.

- [ ] **Step 7: Verificar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: verde; inclui os testes de etapas, mínimo com "Voltar à sacola", recarregar no meio, e os specs do painel que usam `placePickupOrder`.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/[slug]/sacola e2e/pedido.spec.ts e2e/helpers.ts
git commit -m "feat: four-step checkout with ?etapa= URL state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Acompanhamento do pedido com linha do tempo

**Files:**
- Create: `src/app/[slug]/pedido/[token]/_components/order-timeline.tsx`
- Modify: `src/app/[slug]/pedido/[token]/page.tsx`, `src/app/[slug]/pedido/[token]/not-found.tsx`

**Interfaces:**
- Consumes: `timelineFor`, `statusLabel` (`@/modules/orders`); `StoreShell` (Task 2); `OrderTracking.store.logoUrl` (Task 2).
- Produces: `OrderTimeline({ fulfillment, status })`.

- [ ] **Step 1: Linha do tempo**

`src/app/[slug]/pedido/[token]/_components/order-timeline.tsx`:

```tsx
import { CheckIcon, XCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { statusLabel, timelineFor, type Fulfillment, type OrderStatus } from "@/modules/orders";

export function OrderTimeline({ fulfillment, status }: { fulfillment: Fulfillment; status: OrderStatus }) {
  const steps = timelineFor(fulfillment, status);

  if (!steps) {
    return (
      <Alert variant="destructive">
        <XCircleIcon />
        <AlertTitle>Pedido cancelado</AlertTitle>
        <AlertDescription>Fale com a loja pelo WhatsApp se tiver dúvidas.</AlertDescription>
      </Alert>
    );
  }

  return (
    <ol className="flex flex-col rounded-xl border bg-card p-4">
      {steps.map((step, index) => (
        <li key={step.status} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" && "border-primary bg-background",
                step.state === "upcoming" && "border-muted bg-background",
              )}
            >
              {step.state === "done" ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <span className={cn("size-2 rounded-full", step.state === "current" ? "bg-primary" : "bg-muted")} />
              )}
            </span>
            {index < steps.length - 1 && <span className={cn("min-h-6 w-0.5 flex-1", step.state === "done" ? "bg-primary" : "bg-muted")} />}
          </div>
          <p
            className={cn(
              "pb-4 text-sm",
              step.state === "current" && "font-semibold text-foreground",
              step.state === "done" && "text-foreground",
              step.state === "upcoming" && "text-muted-foreground",
            )}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {statusLabel(step.status, fulfillment)}
          </p>
        </li>
      ))}
    </ol>
  );
}
```

(Se `Fulfillment`/`OrderStatus` não forem exportados por `@/modules/orders`, importe de onde `status.ts` os importa.)

- [ ] **Step 2: Página**

Em `src/app/[slug]/pedido/[token]/page.tsx`, manter a busca, `notFound`, `contactUrl`, `createdAt`, `<title>`, `<meta>`, `AutoRefresh` e `FINAL_STATUSES` como estão; o JSX devolvido por `Tracking` passa a ser:

```tsx
    <StoreShell theme={order.store.theme}>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
        <title>{`Pedido ${formatOrderNumber(order.number)} | ${order.store.name}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        {!FINAL_STATUSES.has(order.status) && <AutoRefresh intervalMs={10_000} />}

        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-primary">
            {order.store.logoUrl ? (
              <Image src={order.store.logoUrl} alt={`Logo de ${order.store.name}`} width={40} height={40} unoptimized className="size-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-full place-items-center font-bold text-primary-foreground">
                {order.store.name.charAt(0)}
              </span>
            )}
          </div>
          <span className="font-medium">{order.store.name}</span>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Pedido {formatOrderNumber(order.number)}</h1>
          <p>Olá, {order.customerFirstName}!</p>
          <p className="text-sm text-muted-foreground">
            {FULFILLMENT_LABELS[order.fulfillment]} · feito em {createdAt}
          </p>
        </div>

        <p data-testid="order-status" className="text-lg font-semibold">
          {statusLabel(order.status, order.fulfillment)}
        </p>
        <OrderTimeline fulfillment={order.fulfillment} status={order.status} />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col divide-y">
              {order.items.map((item, index) => (
                <li key={index} className="flex flex-col py-2">
                  <div className="flex justify-between gap-3">
                    <span>
                      {item.quantity}x {item.description}
                    </span>
                    <span>{formatBRL(item.totalCents)}</span>
                  </div>
                  {item.options.map((option) => (
                    <span key={option} className="text-sm text-muted-foreground">
                      + {option}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right">{formatBRL(order.subtotalCents)}</dd>
              <dt className="text-muted-foreground">Entrega</dt>
              <dd className="text-right">{formatBRL(order.deliveryFeeCents)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{formatBRL(order.totalCents)}</dd>
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd className="text-right">{PAYMENT_LABELS[order.paymentMethod]}</dd>
            </dl>
          </CardContent>
        </Card>

        <a href={contactUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-4 py-3 text-center font-semibold text-white">
          Falar com a loja no WhatsApp
        </a>
        <Button asChild variant="outline">
          <Link href={`/${slug}`}>Voltar ao cardápio</Link>
        </Button>
      </main>
    </StoreShell>
```

Imports novos: `Image` de `next/image`, `Button` de `@/components/ui/button`, `Card, CardContent` de `@/components/ui/card`, `StoreShell` de `@/app/[slug]/_components/store-shell`, `OrderTimeline` de `./_components/order-timeline`. O fallback do Suspense vira `<p className="p-6 text-muted-foreground">Carregando pedido...</p>`.

`src/app/[slug]/pedido/[token]/not-found.tsx`: trocar cores fixas/`dark:` por `text-muted-foreground` e links por `Button asChild variant="outline"` (mesmo padrão do `[slug]/not-found.tsx` da Task 4), mantendo o heading "Pedido não encontrado".

- [ ] **Step 3: Verificar**

Run: `npm run lint && npm run typecheck && npm test && make e2e`
Expected: verde (o primeiro teste do `pedido.spec.ts` checa `order-status` = "Recebido — aguardando a loja", "Olá, Maria!" e o heading `Pedido #NNNN`; os specs do painel que avançam status usam `placePickupOrder`).

- [ ] **Step 4: Commit**

```bash
git add -A src/app/[slug]/pedido
git commit -m "feat: order tracking with store theme and status timeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Smoke no celular e varredura final

**Files:**
- Create: `e2e/pedido-mobile.spec.ts`
- Modify: qualquer arquivo de `src/app/[slug]` que a varredura apontar (troca de classe apenas)

- [ ] **Step 1: E2E em viewport de celular**

`e2e/pedido-mobile.spec.ts` (casa com `**/pedido*.spec.ts`, roda no projeto "pedido"):

```ts
import { devices, expect, test } from "@playwright/test";
import { placePickupOrder, setStoreStatus } from "./helpers";

// defaultBrowserType não pode ser trocado por arquivo; o resto do perfil do Pixel 7 sim.
const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];
test.use(pixel7);

test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test.afterAll(async ({ browser }) => {
  await setStoreStatus(browser, "Automático");
});

test("pedido completo no celular até o acompanhamento", async ({ page }) => {
  const { orderLabel, trackingPath } = await placePickupOrder(page);
  await page.goto(trackingPath);
  await expect(page.getByRole("heading", { name: `Pedido ${orderLabel}`, exact: true })).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido — aguardando a loja");
});
```

(Confirme no `e2e/helpers.ts` o formato devolvido por `placePickupOrder` — `{ orderLabel, trackingPath }` — e ajuste se for diferente.)

- [ ] **Step 2: Varredura**

Run: `grep -rnE "dark:|neutral-|text-primary\b|brand-primary|red-[0-9]|green-[0-9]" src/app/[slug]`
Expected: só `bg-green-700` dos dois botões de WhatsApp. Qualquer outra ocorrência: trocar por token (`text-muted-foreground`, `text-destructive`, `bg-muted`, etc.) sem mudar comportamento.

- [ ] **Step 3: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm test && npm run test:int && make e2e`
Expected: tudo verde.

```bash
git add -A e2e/pedido-mobile.spec.ts src/app/[slug]
git commit -m "test: mobile smoke for the full order flow; token-only public screens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
