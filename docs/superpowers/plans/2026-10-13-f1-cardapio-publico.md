# F1 Cardápio Público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública `/{slug}` de cada loja mostrando cardápio (categorias, tamanhos, preços, esgotados), tema da loja e status aberto/fechado, alimentada pelos módulos `stores` e `catalog` e por uma loja "Pizzaria Demo" criada via seed.

**Architecture:** Dois módulos novos de domínio (`stores`, `catalog`) com schema Drizzle, validação Zod e serviços de leitura/escrita mínima (escrita só o necessário para seed e testes: `createStore`, `replaceStoreHours`, `importCatalog`). Regras puras (`getOpenStatus`, `themeCssVariables`, `startingPriceCents`) testadas por unidade. A página usa Next 16 `cacheComponents`: dados da loja/cardápio em função `"use cache"` com `cacheTag`, status aberto/fechado dinâmico em `<Suspense>` com `connection()`.

**Tech Stack:** Next.js 16.4 (cacheComponents), React 19, Drizzle 0.45 + Postgres 17, Zod 4, Tailwind 4, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md` (seções 5 e 6.1; fase F1 da seção 12)

## Global Constraints

- Dinheiro sempre inteiro em centavos (`*_cents`, tipo `Cents`); nunca float. Exibição só via `formatBRL`.
- Timestamps no banco em UTC; cálculo de horário no `timezone` da loja (padrão `America/Sao_Paulo`).
- Textos de interface em português do Brasil.
- `src/app/` nunca acessa o banco diretamente; só chama módulos.
- Módulos importados apenas por `@/modules/<nome>` ou `@/modules/<nome>/client`. Dentro do módulo, só `./`. Imports `../` proibidos em `src/` — **única exceção** (criada na Task 3): arquivos `src/modules/*/schema.ts` podem importar `../<outro>/schema` para chaves estrangeiras.
- Toda tabela de tenant tem `store_id` indexado; todo serviço de leitura filtra por `store_id`.
- Cores do tema validadas como `#RRGGBB` estrito antes de virarem CSS variables.
- Chaves dos `jsonb` de configuração em camelCase (`dineIn`, `halfAndHalf`, `minOrderCents`...). Diferença deliberada da grafia snake_case da spec.
- IDs das tabelas novas: `uuid` com `defaultRandom()`.
- Postgres local na porta 5434 (`.env.local`); CI na 5432.
- Commits terminam com linha em branco + trailer `Co-Authored-By:` do modelo que escreveu.
- Branch `f1-cardapio-publico`.

## Review Focus

1. Turno que vira a meia-noite e minuto exato do fechamento → aberto às 00:15 de sábado num turno de sexta 18:00–00:30; fechado às 00:30 e às 23:30 num turno que fecha 23:30. Teste: Task 2.
2. Slug inexistente → página "Loja não encontrada", não erro 500. Teste: Task 6 (E2E).
3. Cardápio da loja B nunca aparece na página da loja A. Teste: Task 3 (`getMenu` com duas lojas).
4. Cor de tema maliciosa (`#B91C1C;background:url(x)`, `red`) → criação recusada com `VALIDATION`. Teste: Task 1.
5. Produto esgotado aparece marcado "Esgotado"; produto ou categoria inativos não aparecem; categoria sem produto ativo some. Testes: Task 3 (integração) e Task 6 (E2E).

---

## File Structure

```
src/shared/
  validation.ts (+ validation.test.ts)     # zodIssuesToDomainError
  db/errors.ts (+ errors.test.ts)          # isUniqueViolation
src/modules/stores/
  settings.ts                              # schemas Zod: tema, features, regras, pagamento, criação, horários
  types.ts                                 # Store, StoreHour, ManualStatus
  schema.ts                                # tabelas stores, store_hours
  service.ts (+ service.int.test.ts)       # createStore, replaceStoreHours, getStoreBySlug, deleteStoreBySlug
  hours.ts (+ hours.test.ts)               # getOpenStatus, formatOpenStatus, localClock
  theme.ts (+ theme.test.ts)               # readableTextColor, themeCssVariables
  index.ts
src/modules/catalog/
  schema.ts                                # categorias, tamanhos, produtos, preços, adicionais
  definition.ts (+ definition.test.ts)     # catalogDefinitionSchema (import em lote)
  menu.ts (+ menu.test.ts)                 # tipos Menu*, startingPriceCents
  service.ts (+ service.int.test.ts)       # importCatalog, getMenu
  index.ts
scripts/
  seed-demo.ts                             # CLI: npm run seed:demo
  demo/pizzaria-demo.ts                    # dados da Pizzaria Demo
  demo/seed.ts                             # seedDemoStore()
tests/integration/seed-demo.int.test.ts
src/app/[slug]/
  page.tsx, data.ts, not-found.tsx
  _components/store-header.tsx, open-status.tsx, category-nav.tsx, product-card.tsx
e2e/menu.spec.ts
```

---

### Task 1: Módulo `stores` — schema, configurações e serviços

**Files:**
- Create: `src/shared/validation.ts`, `src/shared/validation.test.ts`, `src/shared/db/errors.ts`, `src/shared/db/errors.test.ts`
- Create: `src/modules/stores/settings.ts`, `types.ts`, `schema.ts`, `service.ts`, `service.int.test.ts`, `index.ts`
- Create: migration em `drizzle/` (gerada)

**Interfaces:**
- Consumes: `db`, `pool` (`@/shared/db/client`); `DomainError` (`@/shared/errors`).
- Produces:
  - `zodIssuesToDomainError(error: z.ZodError): DomainError` (`@/shared/validation`) — code `VALIDATION`, `details.issues: { path: string; message: string }[]`.
  - `isUniqueViolation(error: unknown): boolean` (`@/shared/db/errors`).
  - De `@/modules/stores`: `createStore(input: CreateStoreInput): Promise<{ id: string }>`, `replaceStoreHours(storeId: string, hours: StoreHourInput[]): Promise<void>`, `getStoreBySlug(slug: string): Promise<Store | null>`, `deleteStoreBySlug(slug: string): Promise<boolean>`; tipos `Store`, `StoreHour`, `ManualStatus`, `StoreTheme`, `StoreFeatures`, `StoreRules`, `StorePaymentMethods`, `CreateStoreInput`, `StoreHourInput`.
  - Tabelas `stores`, `storeHours` em `src/modules/stores/schema.ts` (a Task 3 referencia `stores` via `../stores/schema`).

- [ ] **Step 1: Criar branch**

```bash
cd /home/ryan/workspace/personalprojects/ecom-menu
git checkout -b f1-cardapio-publico
```

- [ ] **Step 2: Teste que falha para `zodIssuesToDomainError`**

`src/shared/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "./errors";
import { zodIssuesToDomainError } from "./validation";

describe("zodIssuesToDomainError", () => {
  it("converte issues do Zod em DomainError VALIDATION com caminho em texto", () => {
    const result = z.object({ theme: z.object({ primary: z.string().min(7, "curto") }) }).safeParse({ theme: { primary: "x" } });
    if (result.success) throw new Error("esperava falha");

    const error = zodIssuesToDomainError(result.error);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("VALIDATION");
    expect(error.details).toEqual({ issues: [{ path: "theme.primary", message: "curto" }] });
  });
});
```

Run: `npm test -- src/shared/validation.test.ts`
Expected: FAIL — `Failed to resolve import "./validation"`.

- [ ] **Step 3: Implementar `src/shared/validation.ts`**

```ts
import type { z } from "zod";
import { DomainError } from "./errors";

export function zodIssuesToDomainError(error: z.ZodError): DomainError {
  return new DomainError("VALIDATION", {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}
```

Run: `npm test -- src/shared/validation.test.ts`
Expected: PASS.

- [ ] **Step 4: Teste que falha para `isUniqueViolation`**

`src/shared/db/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors";

describe("isUniqueViolation", () => {
  it("reconhece erro do pg com code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("reconhece erro embrulhado em cause (Drizzle)", () => {
    expect(isUniqueViolation(new Error("query falhou", { cause: { code: "23505" } }))).toBe(true);
  });

  it.each([{ code: "23503" }, new Error("x"), null, undefined, "23505"])("false para %o", (error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
```

Run: `npm test -- src/shared/db/errors.test.ts`
Expected: FAIL — `Failed to resolve import "./errors"`.

- [ ] **Step 5: Implementar `src/shared/db/errors.ts`**

```ts
const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 5;

function readProperty(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current !== undefined; depth++) {
    if (readProperty(current, "code") === UNIQUE_VIOLATION) return true;
    current = readProperty(current, "cause");
  }
  return false;
}
```

Run: `npm test -- src/shared/db/errors.test.ts`
Expected: PASS.

- [ ] **Step 6: Schemas Zod de configuração — `src/modules/stores/settings.ts`**

```ts
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor deve estar no formato #RRGGBB");
const hourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário deve estar no formato HH:MM");
const cents = z.number().int().nonnegative();

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const storeThemeSchema = z.object({
  primary: hexColor.default("#B91C1C"),
  secondary: hexColor.default("#F59E0B"),
  font: z.enum(["sans", "serif"]).default("sans"),
});

export const storeFeaturesSchema = z.object({
  delivery: z.boolean().default(true),
  pickup: z.boolean().default(true),
  dineIn: z.boolean().default(false),
  halfAndHalf: z.boolean().default(true),
  addons: z.boolean().default(true),
  coupons: z.literal(false).default(false),
  scheduling: z.literal(false).default(false),
});

export const storeRulesSchema = z.object({
  minOrderCents: cents.default(0),
  prepTimeMin: z.number().int().positive().default(30),
  deliveryTimeMin: z.number().int().positive().default(45),
  halfPriceRule: z.enum(["highest", "average"]).default("highest"),
  autoPrintOnAccept: z.boolean().default(false),
  deliveryFee: z
    .discriminatedUnion("strategy", [
      z.object({ strategy: z.literal("fixed"), fixedCents: cents }),
      z.object({ strategy: z.literal("by_neighborhood") }),
    ])
    .default({ strategy: "fixed", fixedCents: 0 }),
});

export const storePaymentMethodsSchema = z.object({
  cash: z.boolean().default(true),
  cardOnDelivery: z.boolean().default(true),
  pixKey: z.string().trim().min(1).nullable().default(null),
});

export const createStoreInputSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug deve ter só letras minúsculas, números e hífens"),
  name: z.string().trim().min(1).max(120),
  whatsappPhone: z.string().regex(/^\+[1-9]\d{7,14}$/, "telefone deve estar no formato E.164 (+5511999999999)"),
  address: z.string().trim().min(1).max(300).nullable().default(null),
  timezone: z.string().refine(isValidTimeZone, "fuso horário inválido").default("America/Sao_Paulo"),
  logoUrl: z.url().nullable().default(null),
  bannerUrl: z.url().nullable().default(null),
  theme: storeThemeSchema.prefault({}),
  features: storeFeaturesSchema.prefault({}),
  rules: storeRulesSchema.prefault({}),
  paymentMethods: storePaymentMethodsSchema.prefault({}),
});

export const storeHourInputSchema = z
  .object({ weekday: z.number().int().min(0).max(6), opensAt: hourMinute, closesAt: hourMinute })
  .refine((hour) => hour.opensAt !== hour.closesAt, {
    message: "abertura e fechamento não podem ser iguais",
    path: ["closesAt"],
  });

export const storeHoursInputSchema = z.array(storeHourInputSchema).max(21);

export type StoreTheme = z.infer<typeof storeThemeSchema>;
export type StoreFeatures = z.infer<typeof storeFeaturesSchema>;
export type StoreRules = z.infer<typeof storeRulesSchema>;
export type StorePaymentMethods = z.infer<typeof storePaymentMethodsSchema>;
export type CreateStoreInput = z.input<typeof createStoreInputSchema>;
export type StoreHourInput = z.input<typeof storeHourInputSchema>;
```

(`prefault` no Zod 4 aplica os defaults internos quando o campo vem ausente; `default({})` não aplicaria.)

- [ ] **Step 7: Tipos — `src/modules/stores/types.ts`**

```ts
import type { StoreFeatures, StorePaymentMethods, StoreRules, StoreTheme } from "./settings";

export type ManualStatus = "auto" | "force_open" | "force_closed";

/** Turno de funcionamento. Horários "HH:MM"; closesAt < opensAt = vira a meia-noite. weekday: 0 = domingo. */
export type StoreHour = { weekday: number; opensAt: string; closesAt: string };

export type Store = {
  id: string;
  slug: string;
  name: string;
  whatsappPhone: string;
  address: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  timezone: string;
  theme: StoreTheme;
  features: StoreFeatures;
  rules: StoreRules;
  paymentMethods: StorePaymentMethods;
  manualStatus: ManualStatus;
  hours: StoreHour[];
};
```

- [ ] **Step 8: Tabelas — `src/modules/stores/schema.ts`**

```ts
import { sql } from "drizzle-orm";
import { check, doublePrecision, index, integer, jsonb, pgTable, smallint, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import type { StoreFeatures, StorePaymentMethods, StoreRules, StoreTheme } from "./settings";

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  whatsappPhone: text("whatsapp_phone").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  orderSeq: integer("order_seq").notNull().default(0),
  theme: jsonb("theme").$type<StoreTheme>().notNull(),
  features: jsonb("features").$type<StoreFeatures>().notNull(),
  rules: jsonb("rules").$type<StoreRules>().notNull(),
  paymentMethods: jsonb("payment_methods").$type<StorePaymentMethods>().notNull(),
  manualStatus: text("manual_status", { enum: ["auto", "force_open", "force_closed"] }).notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeHours = pgTable(
  "store_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
  },
  (t) => [
    index("store_hours_store_id_idx").on(t.storeId),
    check("store_hours_weekday_check", sql`${t.weekday} between 0 and 6`),
  ],
);
```

- [ ] **Step 9: Gerar migration**

Run: `npm run db:generate`
Expected: novo `drizzle/0002_*.sql` com `CREATE TABLE "stores"` e `"store_hours"`, FK com `ON DELETE cascade`, índice e check.

- [ ] **Step 10: Teste de integração que falha — `src/modules/stores/service.int.test.ts`**

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/shared/db/client";
import { storeHours, stores } from "./schema";
import { createStore, deleteStoreBySlug, getStoreBySlug, replaceStoreHours } from "./service";

const base = { slug: "pizzaria-teste", name: "Pizzaria Teste", whatsappPhone: "+5511988887777" };

describe("stores service", () => {
  beforeEach(async () => {
    await db.delete(stores);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria loja com configurações padrão", async () => {
    await createStore(base);

    const store = await getStoreBySlug("pizzaria-teste");

    expect(store).toMatchObject({
      slug: "pizzaria-teste",
      name: "Pizzaria Teste",
      whatsappPhone: "+5511988887777",
      address: null,
      timezone: "America/Sao_Paulo",
      manualStatus: "auto",
      hours: [],
    });
    expect(store?.theme).toEqual({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" });
    expect(store?.features).toMatchObject({ delivery: true, pickup: true, dineIn: false, halfAndHalf: true });
    expect(store?.rules).toMatchObject({ minOrderCents: 0, halfPriceRule: "highest", deliveryFee: { strategy: "fixed", fixedCents: 0 } });
    expect(store?.paymentMethods).toEqual({ cash: true, cardOnDelivery: true, pixKey: null });
  });

  it("retorna null para slug inexistente", async () => {
    expect(await getStoreBySlug("nao-existe")).toBeNull();
  });

  it("recusa slug duplicado com VALIDATION", async () => {
    await createStore(base);
    await expect(createStore({ ...base, name: "Outra" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "slug", message: "slug já está em uso" }] },
    });
  });

  it.each(["red", "#FFF", "#B91C1C;background:url(x)", "url(javascript:alert(1))"])(
    "recusa cor de tema inválida %s",
    async (primary) => {
      await expect(createStore({ ...base, theme: { primary } })).rejects.toMatchObject({ code: "VALIDATION" });
    },
  );

  it.each(["Pizzaria Teste", "pizzaria_teste", "-pizzaria", "ab"])("recusa slug inválido %s", async (slug) => {
    await expect(createStore({ ...base, slug })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("recusa telefone fora do E.164 e fuso inválido", async () => {
    await expect(createStore({ ...base, whatsappPhone: "11988887777" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createStore({ ...base, timezone: "Marte/Olimpo" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("substitui horários (sem duplicar) e devolve HH:MM ordenados", async () => {
    const { id } = await createStore(base);
    const hours = [
      { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
      { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
      { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
    ];

    await replaceStoreHours(id, hours);
    await replaceStoreHours(id, hours);

    const store = await getStoreBySlug("pizzaria-teste");
    expect(store?.hours).toEqual([
      { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
      { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
      { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
    ]);
  });

  it.each([
    [{ weekday: 7, opensAt: "18:00", closesAt: "23:00" }],
    [{ weekday: 1, opensAt: "25:00", closesAt: "23:00" }],
    [{ weekday: 1, opensAt: "18:00", closesAt: "18:00" }],
  ])("recusa horário inválido %o", async (hour) => {
    const { id } = await createStore(base);
    await expect(replaceStoreHours(id, [hour])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("deleteStoreBySlug remove loja e horários em cascata", async () => {
    const { id } = await createStore(base);
    await replaceStoreHours(id, [{ weekday: 1, opensAt: "18:00", closesAt: "23:00" }]);

    expect(await deleteStoreBySlug("pizzaria-teste")).toBe(true);
    expect(await deleteStoreBySlug("pizzaria-teste")).toBe(false);
    expect(await db.select().from(storeHours).where(eq(storeHours.storeId, id))).toEqual([]);
  });
});
```

Run: `npm run test:int -- src/modules/stores/service.int.test.ts`
Expected: FAIL — `Failed to resolve import "./service"`.

- [ ] **Step 11: Implementar `src/modules/stores/service.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { isUniqueViolation } from "@/shared/db/errors";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { storeHours, stores } from "./schema";
import {
  createStoreInputSchema,
  storeFeaturesSchema,
  storeHoursInputSchema,
  storePaymentMethodsSchema,
  storeRulesSchema,
  storeThemeSchema,
  type CreateStoreInput,
  type StoreHourInput,
} from "./settings";
import type { Store } from "./types";

export async function createStore(input: CreateStoreInput): Promise<{ id: string }> {
  const parsed = createStoreInputSchema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);

  try {
    const [row] = await db.insert(stores).values(parsed.data).returning({ id: stores.id });
    return { id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("VALIDATION", { issues: [{ path: "slug", message: "slug já está em uso" }] });
    }
    throw error;
  }
}

export async function replaceStoreHours(storeId: string, hours: StoreHourInput[]): Promise<void> {
  const parsed = storeHoursInputSchema.safeParse(hours);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);

  await db.transaction(async (tx) => {
    await tx.delete(storeHours).where(eq(storeHours.storeId, storeId));
    if (parsed.data.length > 0) {
      await tx.insert(storeHours).values(parsed.data.map((hour) => ({ storeId, ...hour })));
    }
  });
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const [row] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!row) return null;

  const hours = await db
    .select({ weekday: storeHours.weekday, opensAt: storeHours.opensAt, closesAt: storeHours.closesAt })
    .from(storeHours)
    .where(eq(storeHours.storeId, row.id))
    .orderBy(asc(storeHours.weekday), asc(storeHours.opensAt));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    whatsappPhone: row.whatsappPhone,
    address: row.address,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    timezone: row.timezone,
    theme: storeThemeSchema.parse(row.theme),
    features: storeFeaturesSchema.parse(row.features),
    rules: storeRulesSchema.parse(row.rules),
    paymentMethods: storePaymentMethodsSchema.parse(row.paymentMethods),
    manualStatus: row.manualStatus,
    // Postgres devolve "HH:MM:SS"; o domínio usa "HH:MM".
    hours: hours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt.slice(0, 5),
      closesAt: hour.closesAt.slice(0, 5),
    })),
  };
}

export async function deleteStoreBySlug(slug: string): Promise<boolean> {
  const deleted = await db.delete(stores).where(eq(stores.slug, slug)).returning({ id: stores.id });
  return deleted.length > 0;
}
```

- [ ] **Step 12: API pública — `src/modules/stores/index.ts`**

```ts
export { createStore, deleteStoreBySlug, getStoreBySlug, replaceStoreHours } from "./service";
export type {
  CreateStoreInput,
  StoreFeatures,
  StoreHourInput,
  StorePaymentMethods,
  StoreRules,
  StoreTheme,
} from "./settings";
export type { ManualStatus, Store, StoreHour } from "./types";
```

- [ ] **Step 13: Rodar tudo**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS (integração: testes anteriores + os novos de `stores`).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add stores module with settings validation and read/write services"
```

---

### Task 2: Horário de funcionamento — `getOpenStatus` e `formatOpenStatus`

**Files:**
- Create: `src/modules/stores/hours.ts`, `src/modules/stores/hours.test.ts`
- Modify: `src/modules/stores/index.ts`

**Interfaces:**
- Consumes: tipos `StoreHour`, `ManualStatus` de `./types` (Task 1).
- Produces (via `@/modules/stores`):
  - `type NextOpening = { dayOffset: number; weekday: number; time: string }`
  - `type OpenStatus = { isOpen: boolean; nextOpening: NextOpening | null }`
  - `localClock(now: Date, timeZone: string): { weekday: number; minutes: number }`
  - `getOpenStatus(input: { hours: StoreHour[]; manualStatus: ManualStatus; timeZone: string; now: Date }): OpenStatus`
  - `formatOpenStatus(status: OpenStatus): string`

- [ ] **Step 1: Testes que falham — `src/modules/stores/hours.test.ts`**

Datas de referência (São Paulo = UTC−3, sem horário de verão): 2026-10-13 é terça; 2026-10-16 sexta; 2026-10-17 sábado; 2026-10-18 domingo.

```ts
import { describe, expect, it } from "vitest";
import { formatOpenStatus, getOpenStatus, localClock } from "./hours";
import type { StoreHour } from "./types";

const timeZone = "America/Sao_Paulo";

const hours: StoreHour[] = [
  { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
  { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
  { weekday: 5, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 6, opensAt: "18:00", closesAt: "00:30" },
];

function statusAt(isoUtc: string, manualStatus: "auto" | "force_open" | "force_closed" = "auto") {
  return getOpenStatus({ hours, manualStatus, timeZone, now: new Date(isoUtc) });
}

describe("localClock", () => {
  it("converte o instante para dia e minutos no fuso da loja", () => {
    const instant = new Date("2026-10-17T02:30:00Z");
    expect(localClock(instant, timeZone)).toEqual({ weekday: 5, minutes: 23 * 60 + 30 });
    expect(localClock(instant, "UTC")).toEqual({ weekday: 6, minutes: 2 * 60 + 30 });
  });

  it("meia-noite vira minuto 0", () => {
    expect(localClock(new Date("2026-10-18T03:00:00Z"), timeZone)).toEqual({ weekday: 0, minutes: 0 });
  });
});

describe("getOpenStatus", () => {
  it("aberto dentro do turno (sexta 19:00)", () => {
    expect(statusAt("2026-10-16T22:00:00Z")).toEqual({ isOpen: true, nextOpening: null });
  });

  it("fechamento é exclusivo: sexta 23:30 fechado, próxima abertura amanhã 18:00", () => {
    expect(statusAt("2026-10-17T02:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" },
    });
  });

  it("turno que vira a meia-noite: domingo 00:15 ainda aberto pelo turno de sábado", () => {
    expect(statusAt("2026-10-18T03:15:00Z").isOpen).toBe(true);
  });

  it("turno que vira a meia-noite: domingo 00:30 fechado, próxima abertura terça 11:00", () => {
    expect(statusAt("2026-10-18T03:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" },
    });
  });

  it("entre dois turnos do mesmo dia: terça 15:00 abre hoje 18:00", () => {
    expect(statusAt("2026-10-13T18:00:00Z").nextOpening).toEqual({ dayOffset: 0, weekday: 2, time: "18:00" });
  });

  it("antes do primeiro turno: terça 10:00 abre hoje 11:00", () => {
    expect(statusAt("2026-10-13T13:00:00Z").nextOpening).toEqual({ dayOffset: 0, weekday: 2, time: "11:00" });
  });

  it("depois do último turno da semana volta para o mesmo dia da semana seguinte", () => {
    const onlyTuesday: StoreHour[] = [{ weekday: 2, opensAt: "11:00", closesAt: "14:00" }];
    const status = getOpenStatus({ hours: onlyTuesday, manualStatus: "auto", timeZone, now: new Date("2026-10-13T20:00:00Z") });
    expect(status.nextOpening).toEqual({ dayOffset: 7, weekday: 2, time: "11:00" });
  });

  it("force_open abre mesmo fora do horário (segunda)", () => {
    expect(statusAt("2026-10-12T22:00:00Z", "force_open")).toEqual({ isOpen: true, nextOpening: null });
  });

  it("force_closed fecha mesmo dentro do horário", () => {
    expect(statusAt("2026-10-16T22:00:00Z", "force_closed")).toEqual({ isOpen: false, nextOpening: null });
  });

  it("sem horários cadastrados: fechado sem próxima abertura", () => {
    expect(getOpenStatus({ hours: [], manualStatus: "auto", timeZone, now: new Date("2026-10-16T22:00:00Z") })).toEqual({
      isOpen: false,
      nextOpening: null,
    });
  });
});

describe("formatOpenStatus", () => {
  it.each([
    [{ isOpen: true, nextOpening: null }, "Aberto agora"],
    [{ isOpen: false, nextOpening: null }, "Fechado no momento"],
    [{ isOpen: false, nextOpening: { dayOffset: 0, weekday: 2, time: "18:00" } }, "Abre hoje às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" } }, "Abre amanhã às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" } }, "Abre terça às 11:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 7, weekday: 0, time: "11:00" } }, "Abre domingo às 11:00"],
  ])("%o → %s", (status, text) => {
    expect(formatOpenStatus(status)).toBe(text);
  });
});
```

Run: `npm test -- src/modules/stores/hours.test.ts`
Expected: FAIL — `Failed to resolve import "./hours"`.

- [ ] **Step 2: Implementar `src/modules/stores/hours.ts`**

```ts
import type { ManualStatus, StoreHour } from "./types";

export type NextOpening = { dayOffset: number; weekday: number; time: string };
export type OpenStatus = { isOpen: boolean; nextOpening: NextOpening | null };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;

function toMinutes(hourMinute: string): number {
  const [hour = 0, minute = 0] = hourMinute.split(":").map(Number);
  return hour * MINUTES_PER_HOUR + minute;
}

function formatMinutes(minutes: number): string {
  const hour = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0");
  const minute = String(minutes % MINUTES_PER_HOUR).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function localClock(now: Date, timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    weekday: WEEKDAY_INDEX[part("weekday")] ?? 0,
    minutes: Number(part("hour")) * MINUTES_PER_HOUR + Number(part("minute")),
  };
}

function isWithinShift(shift: StoreHour, weekday: number, minutes: number): boolean {
  const opens = toMinutes(shift.opensAt);
  const closes = toMinutes(shift.closesAt);

  if (opens < closes) {
    return shift.weekday === weekday && minutes >= opens && minutes < closes;
  }

  // Turno vira a meia-noite: parte da noite no próprio dia + madrugada do dia seguinte.
  const previousWeekday = (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return (shift.weekday === weekday && minutes >= opens) || (shift.weekday === previousWeekday && minutes < closes);
}

function findNextOpening(hours: StoreHour[], weekday: number, minutes: number): NextOpening | null {
  for (let dayOffset = 0; dayOffset <= DAYS_PER_WEEK; dayOffset++) {
    const day = (weekday + dayOffset) % DAYS_PER_WEEK;
    const opening = hours
      .filter((shift) => shift.weekday === day)
      .map((shift) => toMinutes(shift.opensAt))
      .filter((opens) => dayOffset > 0 || opens > minutes)
      .sort((a, b) => a - b)[0];

    if (opening !== undefined) return { dayOffset, weekday: day, time: formatMinutes(opening) };
  }
  return null;
}

export function getOpenStatus(input: {
  hours: StoreHour[];
  manualStatus: ManualStatus;
  timeZone: string;
  now: Date;
}): OpenStatus {
  if (input.manualStatus === "force_open") return { isOpen: true, nextOpening: null };
  if (input.manualStatus === "force_closed") return { isOpen: false, nextOpening: null };

  const { weekday, minutes } = localClock(input.now, input.timeZone);
  if (input.hours.some((shift) => isWithinShift(shift, weekday, minutes))) {
    return { isOpen: true, nextOpening: null };
  }
  return { isOpen: false, nextOpening: findNextOpening(input.hours, weekday, minutes) };
}

export function formatOpenStatus(status: OpenStatus): string {
  if (status.isOpen) return "Aberto agora";
  if (!status.nextOpening) return "Fechado no momento";

  const { dayOffset, weekday, time } = status.nextOpening;
  if (dayOffset === 0) return `Abre hoje às ${time}`;
  if (dayOffset === 1) return `Abre amanhã às ${time}`;
  return `Abre ${WEEKDAY_NAMES[weekday]} às ${time}`;
}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npm test -- src/modules/stores/hours.test.ts`
Expected: PASS.

- [ ] **Step 4: Exportar na API pública**

Acrescentar em `src/modules/stores/index.ts`:

```ts
export { formatOpenStatus, getOpenStatus, localClock, type NextOpening, type OpenStatus } from "./hours";
```

- [ ] **Step 5: Verificar e commitar**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add src/modules/stores/hours.ts src/modules/stores/hours.test.ts src/modules/stores/index.ts
git commit -m "feat: compute store open status across shifts and midnight"
```

---

### Task 3: Módulo `catalog` — schema, importação em lote e leitura do cardápio

**Files:**
- Modify: `eslint.config.mjs`, `tests/lint/boundaries.test.ts` (exceção para `schema.ts`)
- Create: `src/modules/catalog/schema.ts`, `definition.ts`, `definition.test.ts`, `menu.ts`, `menu.test.ts`, `service.ts`, `service.int.test.ts`, `index.ts`
- Create: migration em `drizzle/` (gerada)

**Interfaces:**
- Consumes: `stores` (tabela) de `../stores/schema`; `createStore` de `@/modules/stores` (só nos testes); `zodIssuesToDomainError` (`@/shared/validation`); `db`, `pool`.
- Produces (via `@/modules/catalog`):
  - `type CatalogDefinition` (entrada de `importCatalog`; formato no Step 6)
  - `importCatalog(storeId: string, definition: CatalogDefinition): Promise<void>` — transação única; erro `VALIDATION` sem gravar nada.
  - `getMenu(storeId: string): Promise<Menu>`
  - Tipos `Menu`, `MenuCategory`, `MenuSize`, `MenuProduct`, `MenuOptionGroup`, `MenuOption`
  - `startingPriceCents(product: Pick<MenuProduct, "priceCents" | "sizePrices">): number | null`

- [ ] **Step 1: Testes de lint que falham para a exceção de schema**

Em `tests/lint/boundaries.test.ts`, acrescentar à lista "pode importar":

```ts
    ["src/modules/catalog/schema.ts", "../stores/schema"],
```

e à lista "NÃO pode importar":

```ts
    ["src/modules/catalog/schema.ts", "../stores/service"],
    ["src/modules/catalog/schema.ts", "../stores"],
    ["src/modules/catalog/service.ts", "../stores/schema"],
```

Run: `npm test -- tests/lint/boundaries.test.ts`
Expected: FAIL — `src/modules/catalog/schema.ts pode importar ../stores/schema` retorna contagem > 0.

- [ ] **Step 2: Exceção no `eslint.config.mjs`**

Acrescentar, junto das outras constantes:

```js
const parentRelativeExceptSchema = {
  regex: "^\\.\\./(?![a-z0-9-]+/schema$)",
  message: "Em schema.ts, '../' só é permitido para '../<módulo>/schema' (chaves estrangeiras).",
};
```

e acrescentar ao **final** do array `boundaries` (depois do bloco de `src/modules/**`, para sobrescrevê-lo):

```js
  {
    files: ["src/modules/*/schema.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [moduleInternals, clientInternals, parentRelativeExceptSchema, appLayer] }],
    },
  },
```

Run: `npm test -- tests/lint/boundaries.test.ts && npm run lint`
Expected: PASS. Se o ESLint recusar a chave `regex` em `patterns`, trocar `parentRelativeExceptSchema` por `{ group: ["../*/*", "!../*/schema", "../*"], message: ... }`, rodar de novo e registrar no relatório.

- [ ] **Step 3: Tabelas — `src/modules/catalog/schema.ts`**

```ts
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { stores } from "../stores/schema";

const storeId = () =>
  uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" });

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("categories_store_id_idx").on(t.storeId)],
);

export const categorySizes = pgTable(
  "category_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    maxFlavors: smallint("max_flavors").notNull().default(1),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("category_sizes_store_id_idx").on(t.storeId),
    index("category_sizes_category_id_idx").on(t.categoryId),
    check("category_sizes_max_flavors_check", sql`${t.maxFlavors} between 1 and 2`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents"),
    allowsHalf: boolean("allows_half").notNull().default(false),
    active: boolean("active").notNull().default(true),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("products_store_id_idx").on(t.storeId),
    index("products_category_id_idx").on(t.categoryId),
    check("products_price_cents_check", sql`${t.priceCents} is null or ${t.priceCents} >= 0`),
  ],
);

export const productSizePrices = pgTable(
  "product_size_prices",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categorySizeId: uuid("category_size_id")
      .notNull()
      .references(() => categorySizes.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categorySizeId] }),
    check("product_size_prices_price_cents_check", sql`${t.priceCents} >= 0`),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    name: text("name").notNull(),
    minSelect: smallint("min_select").notNull().default(0),
    maxSelect: smallint("max_select").notNull().default(1),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("option_groups_store_id_idx").on(t.storeId),
    check("option_groups_select_check", sql`${t.minSelect} >= 0 and ${t.maxSelect} >= 1 and ${t.maxSelect} >= ${t.minSelect}`),
  ],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("options_store_id_idx").on(t.storeId),
    index("options_group_id_idx").on(t.groupId),
    check("options_price_cents_check", sql`${t.priceCents} >= 0`),
  ],
);

export const productOptionGroups = pgTable(
  "product_option_groups",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);
```

Run: `npm run db:generate`
Expected: novo `drizzle/0003_*.sql` com as 7 tabelas, FKs `ON DELETE cascade`, índices e checks.

- [ ] **Step 4: Tipos do cardápio e teste que falha para `startingPriceCents`**

`src/modules/catalog/menu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { startingPriceCents } from "./menu";

describe("startingPriceCents", () => {
  it("usa o menor preço entre os tamanhos", () => {
    expect(
      startingPriceCents({
        priceCents: null,
        sizePrices: [
          { sizeId: "g", priceCents: 5690 },
          { sizeId: "b", priceCents: 3490 },
          { sizeId: "m", priceCents: 4690 },
        ],
      }),
    ).toBe(3490);
  });

  it("usa priceCents quando não há tamanhos", () => {
    expect(startingPriceCents({ priceCents: 1400, sizePrices: [] })).toBe(1400);
  });

  it("null quando não há preço", () => {
    expect(startingPriceCents({ priceCents: null, sizePrices: [] })).toBeNull();
  });
});
```

Run: `npm test -- src/modules/catalog/menu.test.ts`
Expected: FAIL — `Failed to resolve import "./menu"`.

- [ ] **Step 5: Implementar `src/modules/catalog/menu.ts`**

```ts
export type MenuSize = { id: string; name: string; maxFlavors: number };

export type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  /** Preço por tamanho, na ordem dos tamanhos da categoria. */
  sizePrices: { sizeId: string; priceCents: number }[];
  allowsHalf: boolean;
  available: boolean;
  optionGroupIds: string[];
};

export type MenuCategory = { id: string; name: string; sizes: MenuSize[]; products: MenuProduct[] };

export type MenuOption = { id: string; name: string; priceCents: number; available: boolean };

export type MenuOptionGroup = { id: string; name: string; minSelect: number; maxSelect: number; options: MenuOption[] };

export type Menu = { categories: MenuCategory[]; optionGroups: MenuOptionGroup[] };

export function startingPriceCents(product: Pick<MenuProduct, "priceCents" | "sizePrices">): number | null {
  if (product.sizePrices.length > 0) return Math.min(...product.sizePrices.map((price) => price.priceCents));
  return product.priceCents;
}
```

Run: `npm test -- src/modules/catalog/menu.test.ts`
Expected: PASS.

- [ ] **Step 6: Testes que falham para a definição de importação — `src/modules/catalog/definition.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { catalogDefinitionSchema, type CatalogDefinition } from "./definition";

const valid: CatalogDefinition = {
  optionGroups: [{ key: "borda", name: "Borda", minSelect: 0, maxSelect: 1, options: [{ name: "Catupiry", priceCents: 800 }] }],
  categories: [
    {
      name: "Pizzas",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "grande", name: "Grande", maxFlavors: 2 },
      ],
      products: [{ name: "Calabresa", sizePrices: { broto: 3490, grande: 5690 }, allowsHalf: true, optionGroupKeys: ["borda"] }],
    },
    { name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] },
  ],
};

function messages(definition: unknown): string[] {
  const result = catalogDefinitionSchema.safeParse(definition);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("catalogDefinitionSchema", () => {
  it("aceita definição válida e aplica defaults", () => {
    const parsed = catalogDefinitionSchema.parse(valid);
    expect(parsed.categories[1]?.sizes).toEqual([]);
    expect(parsed.categories[1]?.products[0]).toMatchObject({ allowsHalf: false, available: true, optionGroupKeys: [] });
    expect(parsed.optionGroups[0]?.options[0]?.available).toBe(true);
  });

  it("exige preço para cada tamanho da categoria", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.sizePrices = { broto: 3490 };
    expect(messages(definition)).toContain("produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)");
  });

  it("recusa priceCents em categoria com tamanhos", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.priceCents = 1000;
    expect(messages(definition)).toContain("produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)");
  });

  it("exige priceCents em categoria sem tamanhos", () => {
    const definition = structuredClone(valid);
    delete definition.categories[1]!.products[0]!.priceCents;
    expect(messages(definition)).toContain("produto sem tamanhos precisa de priceCents");
  });

  it("meio a meio exige tamanho com 2 sabores", () => {
    const definition = structuredClone(valid);
    definition.categories[1]!.products[0]!.allowsHalf = true;
    expect(messages(definition)).toContain("meio a meio exige um tamanho com até 2 sabores");
  });

  it("recusa grupo de adicionais desconhecido", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.optionGroupKeys = ["molho"];
    expect(messages(definition)).toContain("grupo de adicionais desconhecido: molho");
  });

  it("recusa minSelect maior que maxSelect e preço negativo", () => {
    const definition = structuredClone(valid);
    definition.optionGroups[0]!.minSelect = 2;
    definition.optionGroups[0]!.options[0]!.priceCents = -1;
    const result = messages(definition);
    expect(result).toContain("minSelect não pode ser maior que maxSelect");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
```

Run: `npm test -- src/modules/catalog/definition.test.ts`
Expected: FAIL — `Failed to resolve import "./definition"`.

- [ ] **Step 7: Implementar `src/modules/catalog/definition.ts`**

```ts
import { z } from "zod";

const cents = z.number().int().nonnegative();
const key = z.string().regex(/^[a-z0-9_-]+$/, "chave deve ter só letras minúsculas, números, '_' e '-'");
const name = z.string().trim().min(1);

const optionGroupSchema = z
  .object({
    key,
    name,
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(1),
    options: z.array(z.object({ name, priceCents: cents, available: z.boolean().default(true) })).min(1),
  })
  .refine((group) => group.minSelect <= group.maxSelect, {
    message: "minSelect não pode ser maior que maxSelect",
    path: ["minSelect"],
  });

const productSchema = z.object({
  name,
  description: name.optional(),
  imageUrl: z.url().optional(),
  priceCents: cents.optional(),
  sizePrices: z.record(key, cents).optional(),
  allowsHalf: z.boolean().default(false),
  available: z.boolean().default(true),
  optionGroupKeys: z.array(key).default([]),
});

const categorySchema = z.object({
  name,
  sizes: z.array(z.object({ key, name, maxFlavors: z.union([z.literal(1), z.literal(2)]) })).default([]),
  products: z.array(productSchema),
});

export const catalogDefinitionSchema = z
  .object({
    optionGroups: z.array(optionGroupSchema).default([]),
    categories: z.array(categorySchema),
  })
  .superRefine((definition, ctx) => {
    const groupKeys = new Set(definition.optionGroups.map((group) => group.key));
    if (groupKeys.size !== definition.optionGroups.length) {
      ctx.addIssue({ code: "custom", message: "chave de grupo de adicionais repetida", path: ["optionGroups"] });
    }

    definition.categories.forEach((category, categoryIndex) => {
      const sizeKeys = category.sizes.map((size) => size.key);
      if (new Set(sizeKeys).size !== sizeKeys.length) {
        ctx.addIssue({ code: "custom", message: "chave de tamanho repetida", path: ["categories", categoryIndex, "sizes"] });
      }

      category.products.forEach((product, productIndex) => {
        const path = ["categories", categoryIndex, "products", productIndex];

        if (sizeKeys.length > 0) {
          const pricedKeys = Object.keys(product.sizePrices ?? {});
          const pricesMatchSizes =
            product.priceCents === undefined &&
            pricedKeys.length === sizeKeys.length &&
            sizeKeys.every((sizeKey) => pricedKeys.includes(sizeKey));
          if (!pricesMatchSizes) {
            ctx.addIssue({
              code: "custom",
              message: "produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)",
              path,
            });
          }
        } else if (product.priceCents === undefined || product.sizePrices !== undefined) {
          ctx.addIssue({ code: "custom", message: "produto sem tamanhos precisa de priceCents", path });
        }

        if (product.allowsHalf && !category.sizes.some((size) => size.maxFlavors === 2)) {
          ctx.addIssue({ code: "custom", message: "meio a meio exige um tamanho com até 2 sabores", path });
        }

        for (const groupKey of product.optionGroupKeys) {
          if (!groupKeys.has(groupKey)) {
            ctx.addIssue({ code: "custom", message: `grupo de adicionais desconhecido: ${groupKey}`, path });
          }
        }
      });
    });
  });

export type CatalogDefinition = z.input<typeof catalogDefinitionSchema>;
```

Run: `npm test -- src/modules/catalog/definition.test.ts`
Expected: PASS.

- [ ] **Step 8: Teste de integração que falha — `src/modules/catalog/service.int.test.ts`**

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import type { CatalogDefinition } from "./definition";
import { categories, products } from "./schema";
import { getMenu, importCatalog } from "./service";

const pizzaria: CatalogDefinition = {
  optionGroups: [
    {
      key: "borda",
      name: "Borda",
      minSelect: 0,
      maxSelect: 1,
      options: [
        { name: "Catupiry", priceCents: 800 },
        { name: "Cheddar", priceCents: 800, available: false },
      ],
    },
  ],
  categories: [
    {
      name: "Pizzas",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "grande", name: "Grande", maxFlavors: 2 },
      ],
      products: [
        { name: "Mussarela", sizePrices: { grande: 5490, broto: 3290 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Calabresa", description: "Calabresa e cebola", sizePrices: { broto: 3490, grande: 5690 }, allowsHalf: true, available: false },
      ],
    },
    { name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] },
  ],
};

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("catalog service", () => {
  beforeEach(async () => {
    // Apagar a loja remove o catálogo em cascata.
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("importa e devolve o cardápio ordenado com preços por tamanho", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, pizzaria);

    const menu = await getMenu(storeId);

    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas", "Bebidas"]);
    const pizzas = menu.categories[0]!;
    expect(pizzas.sizes.map((s) => [s.name, s.maxFlavors])).toEqual([["Broto", 1], ["Grande", 2]]);
    expect(pizzas.products.map((p) => p.name)).toEqual(["Mussarela", "Calabresa"]);

    const mussarela = pizzas.products[0]!;
    expect(mussarela.sizePrices).toEqual([
      { sizeId: pizzas.sizes[0]!.id, priceCents: 3290 },
      { sizeId: pizzas.sizes[1]!.id, priceCents: 5490 },
    ]);
    expect(mussarela).toMatchObject({ priceCents: null, allowsHalf: true, available: true, description: null });
    expect(mussarela.optionGroupIds).toEqual([menu.optionGroups[0]!.id]);
    expect(pizzas.products[1]).toMatchObject({ available: false, description: "Calabresa e cebola" });

    expect(menu.categories[1]!.products[0]).toMatchObject({ name: "Coca-Cola 2L", priceCents: 1400, sizePrices: [] });
    expect(menu.optionGroups[0]).toMatchObject({ name: "Borda", minSelect: 0, maxSelect: 1 });
    expect(menu.optionGroups[0]!.options.map((o) => [o.name, o.available])).toEqual([["Catupiry", true], ["Cheddar", false]]);
  });

  it("nunca mistura cardápio de outra loja", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    await importCatalog(storeA, pizzaria);
    await importCatalog(storeB, { categories: [{ name: "Lanches", products: [{ name: "X-Burger", priceCents: 2500 }] }] });

    const menuA = await getMenu(storeA);
    const menuB = await getMenu(storeB);

    expect(menuA.categories.flatMap((c) => c.products.map((p) => p.name))).not.toContain("X-Burger");
    expect(menuB.categories.map((c) => c.name)).toEqual(["Lanches"]);
    expect(menuB.optionGroups).toEqual([]);
  });

  it("esconde produto inativo, categoria inativa e categoria sem produto ativo", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, pizzaria);

    await db.update(products).set({ active: false }).where(eq(products.name, "Coca-Cola 2L"));
    await db.update(products).set({ active: false }).where(eq(products.name, "Calabresa"));
    let menu = await getMenu(storeId);
    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas"]);
    expect(menu.categories[0]!.products.map((p) => p.name)).toEqual(["Mussarela"]);

    await db.update(categories).set({ active: false }).where(eq(categories.name, "Pizzas"));
    menu = await getMenu(storeId);
    expect(menu.categories).toEqual([]);
  });

  it("definição inválida não grava nada", async () => {
    const storeId = await newStore("loja-a");
    const invalid = structuredClone(pizzaria);
    invalid.categories[0]!.products[0]!.sizePrices = { broto: 3290 };

    await expect(importCatalog(storeId, invalid)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await getMenu(storeId)).categories).toEqual([]);
  });
});
```

Run: `npm run test:int -- src/modules/catalog/service.int.test.ts`
Expected: FAIL — `Failed to resolve import "./service"`.

- [ ] **Step 9: Implementar `src/modules/catalog/service.ts`**

```ts
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { zodIssuesToDomainError } from "@/shared/validation";
import { catalogDefinitionSchema, type CatalogDefinition } from "./definition";
import type { Menu, MenuCategory, MenuOptionGroup } from "./menu";
import { categories, categorySizes, optionGroups, options, productOptionGroups, products, productSizePrices } from "./schema";

export async function importCatalog(storeId: string, definition: CatalogDefinition): Promise<void> {
  const parsed = catalogDefinitionSchema.safeParse(definition);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  const catalog = parsed.data;

  await db.transaction(async (tx) => {
    const groupIds = new Map<string, string>();
    for (const [groupPosition, group] of catalog.optionGroups.entries()) {
      const [groupRow] = await tx
        .insert(optionGroups)
        .values({ storeId, name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, position: groupPosition })
        .returning({ id: optionGroups.id });
      groupIds.set(group.key, groupRow!.id);
      await tx.insert(options).values(
        group.options.map((option, position) => ({
          storeId,
          groupId: groupRow!.id,
          name: option.name,
          priceCents: option.priceCents,
          available: option.available,
          position,
        })),
      );
    }

    for (const [categoryPosition, category] of catalog.categories.entries()) {
      const [categoryRow] = await tx
        .insert(categories)
        .values({ storeId, name: category.name, position: categoryPosition })
        .returning({ id: categories.id });
      const categoryId = categoryRow!.id;

      const sizeIds = new Map<string, string>();
      for (const [sizePosition, size] of category.sizes.entries()) {
        const [sizeRow] = await tx
          .insert(categorySizes)
          .values({ storeId, categoryId, name: size.name, maxFlavors: size.maxFlavors, position: sizePosition })
          .returning({ id: categorySizes.id });
        sizeIds.set(size.key, sizeRow!.id);
      }

      for (const [productPosition, product] of category.products.entries()) {
        const [productRow] = await tx
          .insert(products)
          .values({
            storeId,
            categoryId,
            name: product.name,
            description: product.description ?? null,
            imageUrl: product.imageUrl ?? null,
            priceCents: product.priceCents ?? null,
            allowsHalf: product.allowsHalf,
            available: product.available,
            position: productPosition,
          })
          .returning({ id: products.id });
        const productId = productRow!.id;

        const prices = Object.entries(product.sizePrices ?? {}).map(([sizeKey, priceCents]) => ({
          productId,
          categorySizeId: sizeIds.get(sizeKey)!,
          priceCents,
        }));
        if (prices.length > 0) await tx.insert(productSizePrices).values(prices);

        const links = product.optionGroupKeys.map((groupKey, position) => ({
          productId,
          groupId: groupIds.get(groupKey)!,
          position,
        }));
        if (links.length > 0) await tx.insert(productOptionGroups).values(links);
      }
    }
  });
}

export async function getMenu(storeId: string): Promise<Menu> {
  const [categoryRows, sizeRows, productRows, priceRows, groupRows, optionRows, linkRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(and(eq(categories.storeId, storeId), eq(categories.active, true)))
      .orderBy(asc(categories.position)),
    db.select().from(categorySizes).where(eq(categorySizes.storeId, storeId)).orderBy(asc(categorySizes.position)),
    db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.active, true)))
      .orderBy(asc(products.position)),
    db
      .select({
        productId: productSizePrices.productId,
        sizeId: productSizePrices.categorySizeId,
        priceCents: productSizePrices.priceCents,
      })
      .from(productSizePrices)
      .innerJoin(products, eq(products.id, productSizePrices.productId))
      .where(eq(products.storeId, storeId)),
    db.select().from(optionGroups).where(eq(optionGroups.storeId, storeId)).orderBy(asc(optionGroups.position)),
    db.select().from(options).where(eq(options.storeId, storeId)).orderBy(asc(options.position)),
    db
      .select({ productId: productOptionGroups.productId, groupId: productOptionGroups.groupId })
      .from(productOptionGroups)
      .innerJoin(products, eq(products.id, productOptionGroups.productId))
      .where(eq(products.storeId, storeId))
      .orderBy(asc(productOptionGroups.position)),
  ]);

  const sizeOrder = new Map(sizeRows.map((size) => [size.id, size.position]));

  const menuCategories: MenuCategory[] = categoryRows
    .map((category) => ({
      id: category.id,
      name: category.name,
      sizes: sizeRows
        .filter((size) => size.categoryId === category.id)
        .map((size) => ({ id: size.id, name: size.name, maxFlavors: size.maxFlavors })),
      products: productRows
        .filter((product) => product.categoryId === category.id)
        .map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          priceCents: product.priceCents,
          sizePrices: priceRows
            .filter((price) => price.productId === product.id)
            .sort((a, b) => (sizeOrder.get(a.sizeId) ?? 0) - (sizeOrder.get(b.sizeId) ?? 0))
            .map((price) => ({ sizeId: price.sizeId, priceCents: price.priceCents })),
          allowsHalf: product.allowsHalf,
          available: product.available,
          optionGroupIds: linkRows.filter((link) => link.productId === product.id).map((link) => link.groupId),
        })),
    }))
    .filter((category) => category.products.length > 0);

  const menuOptionGroups: MenuOptionGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: optionRows
      .filter((option) => option.groupId === group.id)
      .map((option) => ({ id: option.id, name: option.name, priceCents: option.priceCents, available: option.available })),
  }));

  return { categories: menuCategories, optionGroups: menuOptionGroups };
}
```

- [ ] **Step 10: API pública — `src/modules/catalog/index.ts`**

```ts
export type { CatalogDefinition } from "./definition";
export {
  startingPriceCents,
  type Menu,
  type MenuCategory,
  type MenuOption,
  type MenuOptionGroup,
  type MenuProduct,
  type MenuSize,
} from "./menu";
export { getMenu, importCatalog } from "./service";
```

- [ ] **Step 11: Rodar tudo**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add catalog module with bulk import and tenant-scoped menu read"
```

---

### Task 4: Tema da loja — cor de texto legível e CSS variables

**Files:**
- Create: `src/modules/stores/theme.ts`, `src/modules/stores/theme.test.ts`
- Modify: `src/modules/stores/index.ts`

**Interfaces:**
- Consumes: tipo `StoreTheme` de `./settings` (Task 1).
- Produces (via `@/modules/stores`):
  - `readableTextColor(hex: string): "#000000" | "#FFFFFF"`
  - `themeCssVariables(theme: StoreTheme): Record<"--brand-primary" | "--brand-primary-foreground" | "--brand-secondary" | "--brand-secondary-foreground", string>`

- [ ] **Step 1: Teste que falha — `src/modules/stores/theme.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { readableTextColor, themeCssVariables } from "./theme";

describe("readableTextColor", () => {
  it.each([
    ["#FFFFFF", "#000000"],
    ["#000000", "#FFFFFF"],
    ["#B91C1C", "#FFFFFF"],
    ["#F59E0B", "#000000"],
    ["#ffff00", "#000000"],
    ["#1d4ed8", "#FFFFFF"],
  ])("%s → %s", (background, expected) => {
    expect(readableTextColor(background)).toBe(expected);
  });

  it("recusa cor fora do formato #RRGGBB", () => {
    expect(() => readableTextColor("red")).toThrow(RangeError);
  });
});

describe("themeCssVariables", () => {
  it("gera variáveis da marca com texto legível", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" })).toEqual({
      "--brand-primary": "#B91C1C",
      "--brand-primary-foreground": "#FFFFFF",
      "--brand-secondary": "#F59E0B",
      "--brand-secondary-foreground": "#000000",
    });
  });
});
```

Run: `npm test -- src/modules/stores/theme.test.ts`
Expected: FAIL — `Failed to resolve import "./theme"`.

- [ ] **Step 2: Implementar `src/modules/stores/theme.ts`**

```ts
import type { StoreTheme } from "./settings";

const HEX_COLOR = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const BLACK = "#000000";
const WHITE = "#FFFFFF";

// Luminância relativa da WCAG 2.x.
function relativeLuminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match) throw new RangeError(`Cor inválida: ${hex}`);

  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(hex: string): typeof BLACK | typeof WHITE {
  const luminance = relativeLuminance(hex);
  return contrastRatio(luminance, 0) >= contrastRatio(luminance, 1) ? BLACK : WHITE;
}

export function themeCssVariables(theme: StoreTheme) {
  return {
    "--brand-primary": theme.primary,
    "--brand-primary-foreground": readableTextColor(theme.primary),
    "--brand-secondary": theme.secondary,
    "--brand-secondary-foreground": readableTextColor(theme.secondary),
  };
}
```

Run: `npm test -- src/modules/stores/theme.test.ts`
Expected: PASS.

- [ ] **Step 3: Exportar e commitar**

Acrescentar em `src/modules/stores/index.ts`:

```ts
export { readableTextColor, themeCssVariables } from "./theme";
```

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add src/modules/stores/theme.ts src/modules/stores/theme.test.ts src/modules/stores/index.ts
git commit -m "feat: derive readable brand colors from store theme"
```

---

### Task 5: Seed da "Pizzaria Demo"

**Files:**
- Create: `scripts/demo/pizzaria-demo.ts`, `scripts/demo/seed.ts`, `scripts/seed-demo.ts`, `tests/integration/seed-demo.int.test.ts`
- Modify: `vitest.config.ts` (incluir `tests/integration/**/*.int.test.ts`), `package.json` (script `seed:demo`)

**Interfaces:**
- Consumes: `createStore`, `replaceStoreHours`, `deleteStoreBySlug`, `getStoreBySlug`, tipos `CreateStoreInput`, `StoreHourInput` (`@/modules/stores`); `importCatalog`, `getMenu`, tipo `CatalogDefinition` (`@/modules/catalog`); `pool`.
- Produces:
  - `DEMO_STORE_SLUG = "pizzaria-demo"`; `seedDemoStore(): Promise<{ storeId: string }>` (apaga a loja demo se existir e recria; idempotente).
  - Script `npm run seed:demo`.

- [ ] **Step 1: Dados — `scripts/demo/pizzaria-demo.ts`**

```ts
import type { CatalogDefinition } from "@/modules/catalog";
import type { CreateStoreInput, StoreHourInput } from "@/modules/stores";

export const DEMO_STORE_SLUG = "pizzaria-demo";

export const demoStore: CreateStoreInput = {
  slug: DEMO_STORE_SLUG,
  name: "Pizzaria Demo",
  whatsappPhone: "+5511999999999",
  address: "Rua das Flores, 123 - Centro",
  theme: { primary: "#B91C1C", secondary: "#F59E0B" },
  rules: { minOrderCents: 3000, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  paymentMethods: { cash: true, cardOnDelivery: true, pixKey: "pix@pizzariademo.com.br" },
};

// Segunda fechado; sexta e sábado viram a meia-noite.
export const demoHours: StoreHourInput[] = [
  { weekday: 0, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 2, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 3, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 4, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
  { weekday: 6, opensAt: "18:00", closesAt: "00:30" },
];

export const demoCatalog: CatalogDefinition = {
  optionGroups: [
    {
      key: "borda",
      name: "Borda recheada",
      minSelect: 0,
      maxSelect: 1,
      options: [
        { name: "Catupiry", priceCents: 800 },
        { name: "Cheddar", priceCents: 800 },
        { name: "Chocolate", priceCents: 1000 },
      ],
    },
  ],
  categories: [
    {
      name: "Pizzas Salgadas",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "media", name: "Média", maxFlavors: 2 },
        { key: "grande", name: "Grande", maxFlavors: 2 },
      ],
      products: [
        { name: "Mussarela", description: "Molho de tomate, mussarela e orégano.", sizePrices: { broto: 3290, media: 4490, grande: 5490 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Calabresa", description: "Calabresa fatiada, cebola e azeitonas.", sizePrices: { broto: 3490, media: 4690, grande: 5690 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Margherita", description: "Mussarela, tomate e manjericão fresco.", sizePrices: { broto: 3490, media: 4790, grande: 5890 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Portuguesa", description: "Presunto, ovos, cebola, ervilha e mussarela.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Frango com Catupiry", description: "Frango desfiado com catupiry original.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, available: false, optionGroupKeys: ["borda"] },
      ],
    },
    {
      name: "Pizzas Doces",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "media", name: "Média", maxFlavors: 2 },
      ],
      products: [
        { name: "Chocolate", description: "Chocolate ao leite com granulado.", sizePrices: { broto: 3490, media: 4690 }, allowsHalf: true },
        { name: "Romeu e Julieta", description: "Goiabada com mussarela.", sizePrices: { broto: 3490, media: 4690 }, allowsHalf: true },
      ],
    },
    {
      name: "Bebidas",
      products: [
        { name: "Coca-Cola 2L", priceCents: 1400 },
        { name: "Guaraná Antarctica 2L", priceCents: 1200 },
        { name: "Água sem gás 500ml", priceCents: 400 },
      ],
    },
    {
      name: "Sobremesas",
      products: [{ name: "Petit gâteau", description: "Com sorvete de creme.", priceCents: 1890 }],
    },
  ],
};
```

- [ ] **Step 2: Teste de integração que falha — `tests/integration/seed-demo.int.test.ts`**

Antes, em `vitest.config.ts`, no projeto `integration`, trocar `include` por:

```ts
include: ["src/**/*.int.test.ts", "tests/integration/**/*.int.test.ts"],
```

```ts
import { afterAll, describe, expect, it } from "vitest";
import { getMenu } from "@/modules/catalog";
import { getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { DEMO_STORE_SLUG } from "../../scripts/demo/pizzaria-demo";
import { seedDemoStore } from "../../scripts/demo/seed";

describe("seedDemoStore", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("cria a Pizzaria Demo completa e é idempotente", async () => {
    await seedDemoStore();
    const { storeId } = await seedDemoStore();

    const store = await getStoreBySlug(DEMO_STORE_SLUG);
    expect(store?.id).toBe(storeId);
    expect(store?.name).toBe("Pizzaria Demo");
    expect(store?.hours).toHaveLength(6);

    const menu = await getMenu(storeId);
    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"]);
    expect(menu.categories[0]?.sizes.map((s) => s.name)).toEqual(["Broto", "Média", "Grande"]);
    expect(menu.categories[0]?.products.find((p) => p.name === "Frango com Catupiry")?.available).toBe(false);
    expect(menu.optionGroups).toHaveLength(1);
  });
});
```

Run: `npm run test:int -- tests/integration/seed-demo.int.test.ts`
Expected: FAIL — `Failed to resolve import "../../scripts/demo/seed"`.

- [ ] **Step 3: Implementar `scripts/demo/seed.ts`**

```ts
import { importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, replaceStoreHours } from "@/modules/stores";
import { DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string }> {
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  return { storeId };
}
```

Run: `npm run test:int -- tests/integration/seed-demo.int.test.ts`
Expected: PASS.

- [ ] **Step 4: CLI — `scripts/seed-demo.ts`**

```ts
import { pool } from "@/shared/db/client";
import { DEMO_STORE_SLUG } from "./demo/pizzaria-demo";
import { seedDemoStore } from "./demo/seed";

seedDemoStore()
  .then(() => console.log(`Loja demo pronta: /${DEMO_STORE_SLUG}`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

No `package.json`, adicionar:

```json
"seed:demo": "node --env-file-if-exists=.env.local --import tsx scripts/seed-demo.ts"
```

- [ ] **Step 5: Verificar no banco local**

```bash
npm run db:up && npm run db:migrate && npm run seed:demo
```

Expected: `Loja demo pronta: /pizzaria-demo`. Rodar `npm run seed:demo` de novo: mesma saída, sem erro.

- [ ] **Step 6: Rodar tudo e commitar**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add idempotent Pizzaria Demo seed"
```

---

### Task 6: Página pública `/{slug}`, E2E e CI

**Files:**
- Create: `src/app/[slug]/data.ts`, `src/app/[slug]/page.tsx`, `src/app/[slug]/not-found.tsx`
- Create: `src/app/[slug]/_components/store-header.tsx`, `open-status.tsx`, `category-nav.tsx`, `product-card.tsx`
- Create: `e2e/menu.spec.ts`
- Modify: `src/app/globals.css`, `src/app/page.tsx`, `src/app/admin/page.tsx`, `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: `getStoreBySlug`, `getOpenStatus`, `formatOpenStatus`, `themeCssVariables`, tipo `Store` (`@/modules/stores`); `getMenu`, `startingPriceCents`, tipos `MenuCategory`, `MenuProduct` (`@/modules/catalog`); `formatBRL` (`@/shared/money`); script `seed:demo` (Task 5).
- Produces:
  - Rota `/{slug}`; título da aba `"<nome da loja> | Naquela Mesa"`; seções com `id="categoria-<id>"`; produto esgotado com texto "Esgotado"; slug desconhecido renderiza "Loja não encontrada".
  - `storeMenuTag(slug: string): string` (`src/app/[slug]/data.ts`) — tag de cache; a F2 chama `updateTag(storeMenuTag(slug))` depois de editar.

Regras do Next 16 com `cacheComponents: true` (doc em `node_modules/next/dist/docs/01-app/`):
- `params` é `Promise`: ler dentro de componente envolto em `<Suspense>`; passar só a string `slug` para funções `"use cache"`.
- `new Date()` só depois de `await connection()` (`next/server`), em componente dentro de `<Suspense>`.
- `notFound()` (`next/navigation`) chamado no caminho de render, sem `return`.
- Não usar `generateMetadata` (exigiria `"use cache"` com params); o título vai via `<title>` no componente (React 19 iça para o `<head>`).
- Não exportar `dynamicParams` (erro de build com cacheComponents).

- [ ] **Step 1: Escrever o E2E que falha — `e2e/menu.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("cardápio público da Pizzaria Demo", async ({ page }) => {
  await page.goto("/pizzaria-demo");

  await expect(page.getByRole("heading", { level: 1, name: "Pizzaria Demo" })).toBeVisible();
  await expect(page).toHaveTitle("Pizzaria Demo | Naquela Mesa");
  await expect(page.getByTestId("open-status")).toHaveText(/^(Aberto agora|Fechado no momento|Abre .+ às \d\d:\d\d)$/);

  const nav = page.getByRole("navigation", { name: "Categorias" });
  await expect(nav.getByRole("link")).toHaveText(["Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"]);

  const calabresa = page.getByRole("article").filter({ hasText: "Calabresa" });
  await expect(calabresa).toContainText(/a partir de R\$\s34,90/);

  const coca = page.getByRole("article").filter({ hasText: "Coca-Cola 2L" });
  await expect(coca).toContainText(/R\$\s14,00/);
  await expect(coca).not.toContainText("a partir de");

  const frango = page.getByRole("article").filter({ hasText: "Frango com Catupiry" });
  await expect(frango).toContainText("Esgotado");
  await expect(calabresa).not.toContainText("Esgotado");
});

test("link de categoria leva à seção", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Bebidas" }).click();
  await expect(page).toHaveURL(/#categoria-/);
  await expect(page.getByRole("heading", { level: 2, name: "Bebidas" })).toBeInViewport();
});

test("slug inexistente mostra loja não encontrada", async ({ page }) => {
  await page.goto("/loja-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
});
```

Run: `npm run db:up && npm run db:migrate && npm run seed:demo && npm run test:e2e -- e2e/menu.spec.ts`
Expected: FAIL — página `/pizzaria-demo` não existe.

- [ ] **Step 2: Dados cacheados — `src/app/[slug]/data.ts`**

```ts
import { cacheLife, cacheTag } from "next/cache";
import { getMenu } from "@/modules/catalog";
import { getStoreBySlug } from "@/modules/stores";

export function storeMenuTag(slug: string): string {
  return `store-menu:${slug}`;
}

export async function getStorePageData(slug: string) {
  "use cache";
  cacheTag(storeMenuTag(slug));
  cacheLife("hours");

  const store = await getStoreBySlug(slug);
  if (!store) return null;
  const menu = await getMenu(store.id);
  return { store, menu };
}
```

- [ ] **Step 3: Componentes — `src/app/[slug]/_components/`**

`open-status.tsx`:

```tsx
import { connection } from "next/server";
import { formatOpenStatus, getOpenStatus, type Store } from "@/modules/stores";

export async function OpenStatus({ store }: { store: Store }) {
  await connection();
  const status = getOpenStatus({
    hours: store.hours,
    manualStatus: store.manualStatus,
    timeZone: store.timezone,
    now: new Date(),
  });

  return (
    <span
      data-testid="open-status"
      className={
        status.isOpen
          ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-900"
          : "rounded-full bg-neutral-200 px-3 py-1 text-sm font-medium text-neutral-900"
      }
    >
      {formatOpenStatus(status)}
    </span>
  );
}
```

`store-header.tsx`:

```tsx
import Image from "next/image";
import type { ReactNode } from "react";
import type { Store } from "@/modules/stores";

export function StoreHeader({ store, status }: { store: Store; status: ReactNode }) {
  return (
    <header className="bg-(--brand-primary) text-(--brand-primary-foreground)">
      {store.bannerUrl && (
        <div className="relative h-32 w-full sm:h-48">
          <Image src={store.bannerUrl} alt="" fill unoptimized className="object-cover" />
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-5">
        {store.logoUrl && (
          <Image
            src={store.logoUrl}
            alt={`Logo de ${store.name}`}
            width={64}
            height={64}
            unoptimized
            className="size-16 rounded-full border-2 border-white object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          {store.address && <p className="text-sm opacity-90">{store.address}</p>}
          <div>{status}</div>
        </div>
      </div>
    </header>
  );
}
```

`category-nav.tsx`:

```tsx
import type { MenuCategory } from "@/modules/catalog";

export function categoryAnchor(categoryId: string): string {
  return `categoria-${categoryId}`;
}

export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  return (
    <nav aria-label="Categorias" className="sticky top-0 z-10 border-b border-neutral-200 bg-background dark:border-neutral-800">
      <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <a
              href={`#${categoryAnchor(category.id)}`}
              className="block rounded-full bg-(--brand-secondary) px-4 py-1.5 text-sm font-medium text-(--brand-secondary-foreground)"
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

`product-card.tsx`:

```tsx
import Image from "next/image";
import { startingPriceCents, type MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

function priceLabel(product: MenuProduct): string | null {
  const cents = startingPriceCents(product);
  if (cents === null) return null;
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}

export function ProductCard({ product }: { product: MenuProduct }) {
  const price = priceLabel(product);

  return (
    <article
      aria-disabled={!product.available}
      className={`flex gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 ${product.available ? "" : "opacity-60"}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && <p className="text-sm text-neutral-700 dark:text-neutral-300">{product.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {price && <span className="font-medium">{price}</span>}
          {!product.available && (
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
              Esgotado
            </span>
          )}
        </div>
      </div>
      {product.imageUrl && (
        <Image src={product.imageUrl} alt="" width={96} height={96} unoptimized className="size-24 shrink-0 rounded-md object-cover" />
      )}
    </article>
  );
}
```

- [ ] **Step 4: Página — `src/app/[slug]/page.tsx`**

```tsx
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { themeCssVariables } from "@/modules/stores";
import { CategoryNav, categoryAnchor } from "./_components/category-nav";
import { OpenStatus } from "./_components/open-status";
import { ProductCard } from "./_components/product-card";
import { StoreHeader } from "./_components/store-header";
import { getStorePageData } from "./data";

async function StoreMenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, menu } = data;

  return (
    <div style={themeCssVariables(store.theme) as CSSProperties} className="flex flex-1 flex-col">
      <title>{`${store.name} | Naquela Mesa`}</title>
      <StoreHeader
        store={store}
        status={
          <Suspense fallback={<span className="text-sm opacity-90">Verificando horário...</span>}>
            <OpenStatus store={store} />
          </Suspense>
        }
      />
      <CategoryNav categories={menu.categories} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
        {menu.categories.map((category) => (
          <section key={category.id} id={categoryAnchor(category.id)} className="scroll-mt-16">
            <h2 className="mb-3 text-xl font-bold">{category.name}</h2>
            <div className="flex flex-col gap-3">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-neutral-700 dark:text-neutral-300">Carregando cardápio...</p>}>
      <StoreMenu params={params} />
    </Suspense>
  );
}
```

`src/app/[slug]/not-found.tsx`:

```tsx
import Link from "next/link";

export default function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Loja não encontrada</h1>
      <p className="text-neutral-700 dark:text-neutral-300">Confira o link que você recebeu do restaurante.</p>
      <Link href="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Ajustes pendentes da F0 (contraste e fonte)**

Em `src/app/globals.css`, remover a linha `font-family: Arial, Helvetica, sans-serif;` do bloco `body` (o Tailwind já aplica `--font-sans` = Geist).

Em `src/app/page.tsx` e `src/app/admin/page.tsx`, trocar cada `text-neutral-600` por `text-neutral-700 dark:text-neutral-300`.

- [ ] **Step 6: Rodar o E2E e ver passar**

Run: `npm run test:e2e`
Expected: PASS — 3 testes de `menu.spec.ts` + 4 de `auth.spec.ts`.

Se o build/dev reclamar de acesso dinâmico fora de `<Suspense>` ("blocking-prerender" / "Uncached data"), consultar `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` e ajustar o componente apontado, mantendo `cacheComponents: true`.

- [ ] **Step 7: CI e README**

Em `.github/workflows/ci.yml`, job `e2e`, adicionar depois de `- run: npm run db:migrate`:

```yaml
      - run: npm run seed:demo
```

No `README.md`, em "Primeiros passos", adicionar `npm run seed:demo` depois de `npm run db:migrate`, e na tabela de scripts:

```markdown
| `npm run seed:demo` | cria/recria a loja "Pizzaria Demo" em `/pizzaria-demo` |
```

Na linha de `test:e2e` da tabela, trocar "requer banco migrado e super-admin" por "requer banco migrado, `seed:demo` e super-admin".

- [ ] **Step 8: Suíte completa e commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && npm run test:e2e`
Expected: tudo passa.

```bash
git add -A
git commit -m "feat: add public store menu page with theme and open status"
```
