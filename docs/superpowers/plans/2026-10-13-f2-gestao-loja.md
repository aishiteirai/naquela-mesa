# F2 Gestão do Cardápio e da Loja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dono de loja entra em `/painel`, edita cardápio (categorias, tamanhos, produtos, preços, adicionais, disponibilidade) e configurações (aparência, horários, entrega, pagamento), sobe imagens, e o cardápio público reflete as mudanças na hora.

**Architecture:** Vínculo dono↔loja em `store_members`. `src/proxy.ts` faz checagem otimista de cookie (307 para `/login`); cada página e Server Action do painel chama `requireStoreAccess()` (camada app), que deriva o `storeId` **sempre da sessão**. Escritas ficam nos módulos (`catalog/editor.ts`, `stores/settings-service.ts`, novo módulo `media`), validadas com Zod e conferindo que todo id pai pertence ao `storeId`. Toda action que grava chama `updateTag(storeMenuTag(slug))`. Formulários usam Server Actions + `useActionState`.

**Tech Stack:** Next.js 16.4 (cacheComponents, Server Actions, `proxy.ts`), React 19, Better Auth 1.7, Drizzle 0.45 + Postgres 17, Zod 4, Tailwind 4, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md` (seções 7 "Cardápio" e "Configurações", 9, 10; fase F2 da seção 12)

## Global Constraints

- Dinheiro sempre inteiro em centavos; campos de preço na UI aceitam "34,90" e são convertidos com `parseBRLToCents`; exibição só via `formatBRL`.
- Textos de interface em português do Brasil.
- `src/app/` nunca acessa o banco; só chama módulos. Módulos só via `@/modules/<nome>` ou `@/modules/<nome>/client`; dentro do módulo `./`; `../` proibido em `src/` exceto `src/modules/*/schema.ts` → `../<mod>/schema`.
- **`storeId` do painel vem sempre da sessão** (`requireStoreAccess()`), nunca de campo de formulário ou URL. Todo serviço de escrita recebe `storeId` e confere que cada id recebido (categoria, tamanho, produto, grupo, opção) pertence a ele; caso contrário `DomainError("NOT_FOUND")` (ou `VALIDATION` para listas de ids).
- Server Actions são endpoints públicos: cada uma chama `requireStoreAccess()` primeiro e valida a entrada.
- Toda action que grava dados visíveis no cardápio chama `updateTag(storeMenuTag(store.slug))` (`next/cache`; `storeMenuTag` de `@/modules/stores`).
- Imagens: só jpeg/png/webp, máx. 5 MB, conferidas pelos bytes (não pela extensão); URLs aceitas: `https://...` ou `/uploads/<uuid>.<jpg|png|webp>`.
- Sem exclusão definitiva de categoria/produto/grupo/opção no F2 (usa `active`/`available`). Única exclusão: tamanho de categoria.
- Reordenação por botões "Subir"/"Descer" (deliberado: a spec cita arrastar; arrastar fica para depois).
- Slug da loja não é editável no F2.
- Next 16 com `cacheComponents`: leituras de sessão/`searchParams`/`params` dentro de `<Suspense>`; consultar `node_modules/next/dist/docs/01-app/` em dúvida.
- Postgres local na porta 5434; CI na 5432.
- Commits terminam com linha em branco + trailer `Co-Authored-By:` do modelo que escreveu.
- Branch `f2-gestao-loja`.

## Review Focus

1. Dono da loja A envia, numa Server Action, id de categoria/produto/tamanho/grupo da loja B → recusado (`NOT_FOUND`/`VALIDATION`), nada gravado. Testes: Tasks 4 e 5 (integração).
2. Visitante sem sessão em `/painel/...` → HTTP 307 para `/login?next=...`; `next` externo (`//evil.com`, `https://evil.com`) é ignorado no login. Testes: Task 2 (unidade + E2E).
3. Preço digitado "34,9", "1.234,56", "R$ 12" → centavos corretos; "12.50", "-1", "abc" → erro de campo, nada gravado. Testes: Task 3 (unidade).
4. Arquivo renomeado `.png` com conteúdo de texto, ou > 5 MB → recusado; nome de arquivo com `../` na rota `/uploads/` → 404. Testes: Task 9.
5. Turnos sobrepostos (terça 18:00–23:00 e 22:00–23:30; sexta 18:00–02:00 e sábado 01:00–03:00) → recusados. Teste: Task 8.

---

## File Structure

```
src/proxy.ts                                  # 307 otimista para /painel e /admin
src/modules/auth/users.ts                     # + ensureUser
src/modules/stores/
  schema.ts                                   # + store_members, delivery_zones
  members.ts (+ members.int.test.ts)          # addStoreMember, getMembershipStoreId
  cache-tags.ts                               # storeMenuTag (movido de app/[slug]/data.ts)
  service.ts                                  # + getStoreById; leitura tolerante de jsonb
  settings-service.ts (+ .int.test.ts)        # perfil, status manual, operação, bairros
  hours.ts                                    # + findHourConflict
src/modules/catalog/
  editor.ts (+ editor.int.test.ts)            # leitura p/ edição + escrita de categorias/tamanhos
  editor-products.ts (+ .int.test.ts)         # produtos, grupos e opções de adicionais
  ordering.ts (+ ordering.test.ts)            # swapOrder
src/modules/media/
  images.ts (+ images.test.ts, images.int.test.ts)  # detectImageType, saveImage, readImage
  index.ts
src/shared/money.ts                           # + parseBRLToCents, formatCentsForInput
src/shared/validation.ts                      # + imageUrlSchema
src/app/
  _components/form-controls.tsx, styles.ts, sign-out-button.tsx, image-upload-field.tsx
  _lib/action-state.ts (+ action-state.test.ts)
  login/next-path.ts (+ next-path.test.ts)
  sem-loja/page.tsx
  uploads/[file]/route.ts
  painel/_lib/access.ts
  painel/layout.tsx, page.tsx
  painel/cardapio/{page.tsx, actions.ts, _components/*}
  painel/cardapio/produtos/{novo/page.tsx, [id]/page.tsx}
  painel/cardapio/adicionais/{page.tsx, actions.ts}
  painel/disponibilidade/{page.tsx, actions.ts}
  painel/loja/{page.tsx, actions.ts, _components/*}
  painel/upload-action.ts
scripts/ensure-store-owner.ts
e2e/global-setup.ts, e2e/helpers.ts, e2e/painel-auth.spec.ts, e2e/painel.spec.ts, e2e/fixtures/logo.png
```

---

### Task 1: Vínculo dono↔loja, `ensureUser`, `getStoreById`, `storeMenuTag` no módulo

**Files:**
- Modify: `src/modules/auth/users.ts`, `src/modules/auth/index.ts`
- Modify: `src/modules/stores/schema.ts`, `src/modules/stores/service.ts`, `src/modules/stores/index.ts`, `src/modules/stores/service.int.test.ts`
- Create: `src/modules/stores/members.ts`, `src/modules/stores/members.int.test.ts`, `src/modules/stores/cache-tags.ts`
- Modify: `src/app/[slug]/data.ts`
- Create: `scripts/ensure-store-owner.ts`; Modify: `package.json`, `scripts/demo/pizzaria-demo.ts`, `scripts/demo/seed.ts`, `tests/integration/seed-demo.int.test.ts`, `README.md`
- Create: migration em `drizzle/` (gerada)

**Interfaces:**
- Consumes: `auth.api.createUser`, tabela `user` (`src/modules/auth/schema.ts`), `stores`, `storeHours`.
- Produces:
  - `@/modules/auth`: `ensureUser(input: { email: string; password: string; name: string }): Promise<{ id: string; created: boolean }>` (email normalizado; não muda papel); `ensureSuperAdmin` passa a usar `ensureUser`.
  - `@/modules/stores`: `addStoreMember(storeId: string, userId: string): Promise<void>` (idempotente), `getMembershipStoreId(userId: string): Promise<string | null>`, `getStoreById(id: string): Promise<Store | null>`, `storeMenuTag(slug: string): string`.
  - Tabela `storeMembers` (`store_members`: `store_id` uuid FK cascade, `user_id` text FK `user.id` cascade, `role` 'owner', `created_at`; PK composta; índice em `user_id`).
  - `DEMO_OWNER = { email: "dono@pizzariademo.test", password: "demo-senha-123", name: "Dono da Pizzaria Demo" }`; `seedDemoStore()` também garante o dono vinculado; retorna `{ storeId, ownerUserId }`.
  - Script `npm run owner:ensure -- <slug> <email> <senha> [nome]`.

- [ ] **Step 1: Branch**

```bash
cd /home/ryan/workspace/personalprojects/ecom-menu
git checkout -b f2-gestao-loja
```

- [ ] **Step 2: `ensureUser` — teste que falha**

Em `src/modules/auth/users.int.test.ts`, importar `ensureUser` de `./users` e acrescentar:

```ts
describe("ensureUser", () => {
  beforeEach(async () => {
    await db.delete(user);
  });

  it("cria usuário comum (sem papel de admin) e é idempotente", async () => {
    const first = await ensureUser({ email: " Dono@Loja.com ", password: "senha-forte-123", name: "Dono" });
    const second = await ensureUser({ email: "dono@loja.com", password: "outra-senha-123", name: "Dono" });

    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    const [row] = await db.select().from(user).where(eq(user.id, first.id));
    expect(row?.email).toBe("dono@loja.com");
    expect(row?.role).not.toBe("super_admin");

    const signIn = await auth.api.signInEmail({ body: { email: "dono@loja.com", password: "senha-forte-123" } });
    expect(signIn.user.id).toBe(first.id);
  });
});
```

Run: `npm run test:int -- src/modules/auth/users.int.test.ts`
Expected: FAIL — `ensureUser` não é exportado.

- [ ] **Step 3: Implementar `ensureUser` e reescrever `ensureSuperAdmin` sobre ele**

`src/modules/auth/users.ts` (substituir o conteúdo):

```ts
import { eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { auth } from "./auth";
import { SUPER_ADMIN_ROLE } from "./roles";
import { user } from "./schema";

export type EnsureUserInput = { email: string; password: string; name: string };
export type EnsureSuperAdminInput = EnsureUserInput;

export async function ensureUser(input: EnsureUserInput): Promise<{ id: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing) return { id: existing.id, created: false };

  const created = await auth.api.createUser({
    body: { email, password: input.password, name: input.name },
  });
  return { id: created.user.id, created: true };
}

export async function ensureSuperAdmin(input: EnsureSuperAdminInput): Promise<{ id: string; created: boolean }> {
  const result = await ensureUser(input);
  await db.update(user).set({ role: SUPER_ADMIN_ROLE, updatedAt: new Date() }).where(eq(user.id, result.id));
  return result;
}
```

Em `src/modules/auth/index.ts`, trocar a linha de `users` por:

```ts
export { ensureSuperAdmin, ensureUser, type EnsureSuperAdminInput, type EnsureUserInput } from "./users";
```

Run: `npm run test:int -- src/modules/auth/users.int.test.ts`
Expected: PASS (testes antigos de `ensureSuperAdmin` + o novo).

- [ ] **Step 4: Tabela `store_members`**

Em `src/modules/stores/schema.ts`: acrescentar `primaryKey` ao import de `drizzle-orm/pg-core`, `import { user } from "../auth/schema";` e:

```ts
export const storeMembers = pgTable(
  "store_members",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner"] }).notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.userId] }), index("store_members_user_id_idx").on(t.userId)],
);
```

Run: `npm run db:generate`
Expected: nova migration com `CREATE TABLE "store_members"`, duas FKs `ON DELETE cascade`, PK composta e índice.

- [ ] **Step 5: Teste de integração que falha — `src/modules/stores/members.int.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { pool } from "@/shared/db/client";
import { addStoreMember, getMembershipStoreId } from "./members";
import { createStore, deleteStoreBySlug, getStoreById } from "./service";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("store members", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("vincula dono à loja de forma idempotente", async () => {
    const storeId = await newStore("loja-a");
    const owner = await ensureUser({ email: "dono-a@exemplo.com", password: "senha-forte-123", name: "Dono A" });

    await addStoreMember(storeId, owner.id);
    await addStoreMember(storeId, owner.id);

    expect(await getMembershipStoreId(owner.id)).toBe(storeId);
  });

  it("usuário sem vínculo não tem loja", async () => {
    const stranger = await ensureUser({ email: "sem-loja@exemplo.com", password: "senha-forte-123", name: "Sem loja" });
    expect(await getMembershipStoreId(stranger.id)).toBeNull();
  });

  it("apagar a loja remove o vínculo", async () => {
    const storeId = await newStore("loja-b");
    const owner = await ensureUser({ email: "dono-b@exemplo.com", password: "senha-forte-123", name: "Dono B" });
    await addStoreMember(storeId, owner.id);

    await deleteStoreBySlug("loja-b");

    expect(await getMembershipStoreId(owner.id)).toBeNull();
  });

  it("getStoreById devolve a loja ou null", async () => {
    const storeId = await newStore("loja-a");
    expect((await getStoreById(storeId))?.slug).toBe("loja-a");
    expect(await getStoreById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
```

Run: `npm run test:int -- src/modules/stores/members.int.test.ts`
Expected: FAIL — `Failed to resolve import "./members"`.

- [ ] **Step 6: `members.ts`, `getStoreById` e leitura tolerante de jsonb**

`src/modules/stores/members.ts`:

```ts
import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { storeMembers } from "./schema";

export async function addStoreMember(storeId: string, userId: string): Promise<void> {
  await db.insert(storeMembers).values({ storeId, userId }).onConflictDoNothing();
}

export async function getMembershipStoreId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, userId))
    .orderBy(asc(storeMembers.createdAt))
    .limit(1);
  return row?.storeId ?? null;
}
```

Em `src/modules/stores/service.ts`, substituir `getStoreBySlug` por um carregador comum, com leitura tolerante (linha antiga inválida não derruba a página — cai nos defaults e registra aviso):

```ts
import { asc, eq, type SQL } from "drizzle-orm";
import type { z } from "zod";
// (manter os demais imports existentes)

function parseOrDefault<T extends z.ZodType>(schema: T, value: unknown, label: string): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.warn(`Configuração "${label}" inválida no banco; usando padrão.`, parsed.error.issues);
  return schema.parse({});
}

async function loadStore(condition: SQL): Promise<Store | null> {
  const [row] = await db.select().from(stores).where(condition).limit(1);
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
    theme: parseOrDefault(storeThemeSchema, row.theme, "theme"),
    features: parseOrDefault(storeFeaturesSchema, row.features, "features"),
    rules: parseOrDefault(storeRulesSchema, row.rules, "rules"),
    paymentMethods: parseOrDefault(storePaymentMethodsSchema, row.paymentMethods, "paymentMethods"),
    manualStatus: row.manualStatus,
    // Postgres devolve "HH:MM:SS"; o domínio usa "HH:MM".
    hours: hours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt.slice(0, 5),
      closesAt: hour.closesAt.slice(0, 5),
    })),
  };
}

export function getStoreBySlug(slug: string): Promise<Store | null> {
  return loadStore(eq(stores.slug, slug));
}

export function getStoreById(id: string): Promise<Store | null> {
  return loadStore(eq(stores.id, id));
}
```

Em `src/modules/stores/service.int.test.ts`, acrescentar (importando `eq` de `drizzle-orm` se ainda não estiver):

```ts
it("configuração inválida no banco cai no padrão em vez de quebrar", async () => {
  const { id } = await createStore(base);
  await db.update(stores).set({ theme: { primary: "bad" } as never }).where(eq(stores.id, id));

  const store = await getStoreBySlug("pizzaria-teste");

  expect(store?.theme).toEqual({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" });
});
```

`src/modules/stores/cache-tags.ts`:

```ts
/** Tag de cache do cardápio público de uma loja. Invalidar com `updateTag` após qualquer edição visível. */
export function storeMenuTag(slug: string): string {
  return `store-menu:${slug}`;
}
```

Em `src/modules/stores/index.ts`, trocar a linha de `./service` e acrescentar:

```ts
export { createStore, deleteStoreBySlug, getStoreById, getStoreBySlug, replaceStoreHours } from "./service";
export { addStoreMember, getMembershipStoreId } from "./members";
export { storeMenuTag } from "./cache-tags";
```

Em `src/app/[slug]/data.ts`: remover a função `storeMenuTag` local e importar `storeMenuTag` de `@/modules/stores` (junto com `getStoreBySlug`).

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Dono da Pizzaria Demo no seed**

Em `scripts/demo/pizzaria-demo.ts`, acrescentar:

```ts
export const DEMO_OWNER = {
  email: "dono@pizzariademo.test",
  password: "demo-senha-123",
  name: "Dono da Pizzaria Demo",
} as const;
```

`scripts/demo/seed.ts` (substituir):

```ts
import { ensureUser } from "@/modules/auth";
import { importCatalog } from "@/modules/catalog";
import { addStoreMember, createStore, deleteStoreBySlug, replaceStoreHours } from "@/modules/stores";
import { DEMO_OWNER, DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string; ownerUserId: string }> {
  if (process.env.NODE_ENV === "production") throw new Error("seed:demo não roda com NODE_ENV=production");
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  const owner = await ensureUser(DEMO_OWNER);
  await addStoreMember(storeId, owner.id);
  return { storeId, ownerUserId: owner.id };
}
```

Em `tests/integration/seed-demo.int.test.ts`: importar `getMembershipStoreId` de `@/modules/stores`, trocar `const { storeId } = await seedDemoStore();` por `const { storeId, ownerUserId } = await seedDemoStore();` e acrescentar no fim do teste:

```ts
    expect(await getMembershipStoreId(ownerUserId)).toBe(storeId);
```

- [ ] **Step 8: Script `owner:ensure`**

`scripts/ensure-store-owner.ts`:

```ts
import { ensureUser } from "@/modules/auth";
import { addStoreMember, getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";

async function main() {
  const [slug, email, password, name = "Dono da loja"] = process.argv.slice(2);
  if (!slug || !email || !password) {
    console.error("Uso: npm run owner:ensure -- <slug> <email> <senha> [nome]");
    process.exitCode = 1;
    return;
  }
  const store = await getStoreBySlug(slug);
  if (!store) {
    console.error(`Loja não encontrada: ${slug}`);
    process.exitCode = 1;
    return;
  }
  const owner = await ensureUser({ email, password, name });
  await addStoreMember(store.id, owner.id);
  console.log(`${email} agora é dono(a) de /${slug}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

`package.json`, em `scripts`:

```json
"owner:ensure": "node --env-file-if-exists=.env.local --import tsx scripts/ensure-store-owner.ts"
```

`README.md`: na tabela de scripts, acrescentar `| \`npm run owner:ensure -- <slug> <email> <senha> [nome]\` | cria usuário (se preciso) e o vincula como dono da loja |` e, abaixo de "Primeiros passos", a linha: "O seed cria o dono demo `dono@pizzariademo.test` / `demo-senha-123` (painel em `/painel`)."

- [ ] **Step 9: Verificar e commitar**

Run: `npm run db:migrate && npm run seed:demo && npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: tudo passa; seed imprime `Loja demo pronta: /pizzaria-demo`.

```bash
git add -A
git commit -m "feat: link store owners to stores and expose store lookup by id"
```

---

### Task 2: Acesso ao painel — `proxy.ts`, login com destino, layout do painel, E2E de acesso

**Files:**
- Create: `src/proxy.ts`, `src/app/login/next-path.ts`, `src/app/login/next-path.test.ts`, `src/app/sem-loja/page.tsx`
- Create: `src/app/painel/_lib/access.ts`, `src/app/painel/layout.tsx`, `src/app/painel/page.tsx`, `src/app/painel/cardapio/page.tsx` (provisória)
- Move: `src/app/admin/sign-out-button.tsx` → `src/app/_components/sign-out-button.tsx` (atualizar import em `src/app/admin/page.tsx`)
- Modify: `src/app/login/login-form.tsx`, `src/app/login/page.tsx`, `src/shared/env.ts`, `src/shared/env.test.ts`, `src/modules/auth/auth.ts`, `src/modules/stores/settings.ts` (slugs reservados)
- Modify: `playwright.config.ts`, `e2e/auth.spec.ts`, `.github/workflows/ci.yml`
- Create: `e2e/global-setup.ts`, `e2e/helpers.ts`, `e2e/painel-auth.spec.ts`

**Interfaces:**
- Consumes: `requireUser`, `isSuperAdmin`, `SessionUser` (`@/modules/auth`); `getMembershipStoreId`, `getStoreById`, `Store` (`@/modules/stores`); `getSessionCookie` (`better-auth/cookies`).
- Produces:
  - `requireStoreAccess(): Promise<{ user: SessionUser; store: Store }>` em `src/app/painel/_lib/access.ts` — sem sessão → `/login`; super-admin sem loja → `/admin`; outro sem loja → `/sem-loja`.
  - `safeNextPath(value: string | null): string | null` em `src/app/login/next-path.ts`.
  - Layout do painel com `<nav aria-label="Painel">` e links "Cardápio" (`/painel/cardapio`), "Adicionais" (`/painel/cardapio/adicionais`), "Disponibilidade" (`/painel/disponibilidade`), "Loja" (`/painel/loja`), "Ver cardápio" (`/<slug>`, nova aba) e botão "Sair"; nome da loja visível no topo.
  - Env opcional `E2E_DISABLE_AUTH_RATE_LIMIT` (`"1"` desliga o rate limit do Better Auth; usado só pelo servidor do Playwright).
  - `e2e/helpers.ts`: `OWNER_EMAIL`, `OWNER_PASSWORD`, `loginAsOwner(page: Page): Promise<void>` (termina em `/painel/cardapio`).
  - Playwright `globalSetup` roda `npm run seed:demo` antes dos testes.

- [ ] **Step 1: Teste que falha para `safeNextPath`**

`src/app/login/next-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each(["/painel", "/painel/loja?aba=horarios", "/admin"])("aceita caminho interno %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, "", "painel", "https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"])(
    "recusa %s",
    (value) => {
      expect(safeNextPath(value)).toBeNull();
    },
  );
});
```

Run: `npm test -- src/app/login/next-path.test.ts`
Expected: FAIL — `Failed to resolve import "./next-path"`.

- [ ] **Step 2: Implementar `src/app/login/next-path.ts`**

```ts
/** Aceita só caminhos internos ("/..."); bloqueia URLs externas e "//host" (open redirect). */
export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
```

Run: `npm test -- src/app/login/next-path.test.ts`
Expected: PASS.

- [ ] **Step 3: Env de E2E para desligar rate limit**

Em `src/shared/env.ts`, acrescentar ao `envSchema`:

```ts
  E2E_DISABLE_AUTH_RATE_LIMIT: z.literal("1").optional(),
```

Em `src/shared/env.test.ts`, acrescentar:

```ts
  it("aceita E2E_DISABLE_AUTH_RATE_LIMIT=1 e recusa outros valores", () => {
    expect(parseEnv({ ...valid, E2E_DISABLE_AUTH_RATE_LIMIT: "1" }).E2E_DISABLE_AUTH_RATE_LIMIT).toBe("1");
    expect(() => parseEnv({ ...valid, E2E_DISABLE_AUTH_RATE_LIMIT: "true" })).toThrow(/E2E_DISABLE_AUTH_RATE_LIMIT/);
  });
```

Ajustar o teste "aceita ambiente válido" se ele usar `toEqual(valid)` (continua igual: a chave opcional ausente não aparece).

Em `src/modules/auth/auth.ts`, dentro do objeto passado a `betterAuth({...})`, acrescentar:

```ts
  // Só o servidor dos testes E2E define isto (vários logins em sequência a partir do mesmo IP).
  ...(getEnv().E2E_DISABLE_AUTH_RATE_LIMIT === "1" ? { rateLimit: { enabled: false } } : {}),
```

Run: `npm test -- src/shared/env.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Slugs reservados novos**

Em `src/modules/stores/settings.ts`, trocar `RESERVED_SLUGS` por:

```ts
export const RESERVED_SLUGS = ["admin", "api", "login", "painel", "pedido", "sem-loja", "uploads", "_next", "favicon.ico"] as const;
```

- [ ] **Step 5: `proxy.ts`**

`src/proxy.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista (só presença do cookie). A validação real da sessão fica nas páginas e actions.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/painel/:path*", "/admin/:path*"],
};
```

- [ ] **Step 6: Login com destino**

`src/app/login/login-form.tsx` — mudanças:
- importar `useSearchParams` de `next/navigation` e `safeNextPath` de `./next-path`;
- `const searchParams = useSearchParams();` no topo do componente;
- trocar `const { error: signInError } = ...` por `const { data, error: signInError } = ...`;
- trocar `router.push("/admin");` por:

```ts
    const isSuperAdminUser = data?.user && "role" in data.user && data.user.role === "super_admin";
    router.push(safeNextPath(searchParams.get("next")) ?? (isSuperAdminUser ? "/admin" : "/painel"));
```

`src/app/login/page.tsx`: envolver `<LoginForm />` em `<Suspense fallback={null}>` (`useSearchParams` exige Suspense com cacheComponents).

- [ ] **Step 7: Acesso, layout e páginas do painel**

Mover `src/app/admin/sign-out-button.tsx` para `src/app/_components/sign-out-button.tsx` (conteúdo igual) e atualizar o import em `src/app/admin/page.tsx` para `@/app/_components/sign-out-button`.

`src/app/painel/_lib/access.ts`:

```ts
import { redirect } from "next/navigation";
import { isSuperAdmin, requireUser, type SessionUser } from "@/modules/auth";
import { getMembershipStoreId, getStoreById, type Store } from "@/modules/stores";

export type StoreAccess = { user: SessionUser; store: Store };

/** Única fonte do storeId no painel: a sessão. Use no início de toda página e Server Action do painel. */
export async function requireStoreAccess(): Promise<StoreAccess> {
  const user = await requireUser();
  const storeId = await getMembershipStoreId(user.id);
  if (!storeId) redirect(isSuperAdmin(user) ? "/admin" : "/sem-loja");

  const store = await getStoreById(storeId);
  if (!store) redirect("/sem-loja");
  return { user, store };
}
```

`src/app/painel/layout.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { requireStoreAccess } from "./_lib/access";

const links = [
  { href: "/painel/cardapio", label: "Cardápio" },
  { href: "/painel/cardapio/adicionais", label: "Adicionais" },
  { href: "/painel/disponibilidade", label: "Disponibilidade" },
  { href: "/painel/loja", label: "Loja" },
];

async function PainelHeader() {
  const { store } = await requireStoreAccess();

  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="font-semibold">{store.name}</span>
      <nav aria-label="Painel" className="flex flex-wrap gap-3 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="underline-offset-4 hover:underline">
            {link.label}
          </Link>
        ))}
        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
          Ver cardápio
        </a>
      </nav>
      <div className="ml-auto">
        <SignOutButton />
      </div>
    </div>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <Suspense fallback={<div className="h-14" />}>
          <PainelHeader />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
```

O `SignOutButton` tem `className` com `mt-6`; remover essa margem no arquivo movido (o painel o põe no topo).

`src/app/painel/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function PainelHome() {
  redirect("/painel/cardapio");
}
```

`src/app/painel/cardapio/page.tsx` (provisória; a Task 6 substitui):

```tsx
export default function CardapioPage() {
  return <h1 className="text-2xl font-semibold">Cardápio</h1>;
}
```

`src/app/sem-loja/page.tsx`:

```tsx
import { SignOutButton } from "@/app/_components/sign-out-button";

export default function SemLojaPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">Conta sem loja</h1>
      <p className="text-neutral-700 dark:text-neutral-300">
        Sua conta ainda não está vinculada a nenhuma loja. Fale com o suporte do Naquela Mesa.
      </p>
      <SignOutButton />
    </main>
  );
}
```

- [ ] **Step 8: Playwright — seed global, servidor sem rate limit, helpers**

`e2e/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

// Banco previsível a cada execução: recria a Pizzaria Demo (e o dono demo).
export default function globalSetup() {
  execSync("npm run seed:demo", { stdio: "inherit" });
}
```

Em `playwright.config.ts`: acrescentar `globalSetup: "./e2e/global-setup.ts",` e, no objeto `webServer`, a chave:

```ts
    env: Object.fromEntries(
      Object.entries({ ...process.env, E2E_DISABLE_AUTH_RATE_LIMIT: "1" }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
```

`e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = "dono@pizzariademo.test";
export const OWNER_PASSWORD = "demo-senha-123";

export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Senha").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);
}
```

Em `.github/workflows/ci.yml`, job `e2e`: remover o passo `- run: npm run seed:demo` (o `globalSetup` cuida disso).

Em `e2e/auth.spec.ts`, como o login agora carrega `?next=`, trocar cada `toHaveURL(/\/login$/)` por `toHaveURL(/\/login(\?|$)/)`.

- [ ] **Step 9: E2E de acesso — `e2e/painel-auth.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test("visitante sem sessão recebe 307 para o login com next", async ({ request }) => {
  const response = await request.get("/painel/loja", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?next=%2Fpainel%2Floja");
});

test("dono entra e cai no cardápio do painel da própria loja", async ({ page }) => {
  await loginAsOwner(page);
  await expect(page.getByRole("heading", { level: 1, name: "Cardápio" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Pizzaria Demo");
  await expect(page.getByRole("navigation", { name: "Painel" }).getByRole("link", { name: "Ver cardápio" })).toHaveAttribute(
    "href",
    "/pizzaria-demo",
  );
});

test("login respeita next interno e ignora next externo", async ({ page }) => {
  await page.goto("/login?next=%2Fpainel%2Fcardapio");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/login?next=https%3A%2F%2Fevil.com");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/painel\/cardapio$/);
});
```

- [ ] **Step 10: Rodar tudo e commitar**

Run: `npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && CI=1 npm run test:e2e`
Expected: tudo passa (E2E: auth 4 + menu 4 + painel-auth 3). Se o `build` reclamar de acesso dinâmico fora de `<Suspense>` (por exemplo no `layout.tsx` ou no `login`), mover a leitura para dentro de um componente envolto em `<Suspense>`.

```bash
git add -A
git commit -m "feat: gate store panel by membership with optimistic proxy redirect"
```

---
### Task 3: Utilitários compartilhados — preço digitado, URL de imagem, estado de formulário

**Files:**
- Modify: `src/shared/money.ts`, `src/shared/money.test.ts`
- Modify: `src/shared/validation.ts`, `src/shared/validation.test.ts`
- Modify: `src/modules/stores/settings.ts`, `src/modules/catalog/definition.ts` (usar `imageUrlSchema`)
- Create: `src/app/_lib/action-state.ts`, `src/app/_lib/action-state.test.ts`, `src/app/_components/form-controls.tsx`, `src/app/_components/styles.ts`

**Interfaces:**
- Consumes: `DomainError`, `isDomainError` (`@/shared/errors`).
- Produces:
  - `@/shared/money`: `parseBRLToCents(input: string): Cents | null`; `formatCentsForInput(cents: Cents): string` ("3490" → "34,90"); `formatBRL(-0)` passa a imprimir "R$ 0,00".
  - `@/shared/validation`: `UPLOAD_PATH_PATTERN`, `imageUrlSchema` (aceita `https://...` ou `/uploads/<uuid>.<jpg|png|webp>`).
  - `src/app/_lib/action-state.ts`: `type ActionState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string; fieldErrors: Record<string, string> }`; `idleState`; `success(message: string): ActionState`; `fieldError(field: string, message: string): ActionState`; `actionError(error: unknown): ActionState` (VALIDATION → fieldErrors por `path`; NOT_FOUND → "Item não encontrado."; outros erros são relançados).
  - `src/app/_components/form-controls.tsx` (client): `SubmitButton({ children, pendingText? })`, `FieldError({ state, name })`, `FormMessage({ state })` (`role="status"`).
  - `src/app/_components/styles.ts`: `inputClass`, `secondaryButtonClass`.

- [ ] **Step 1: Testes que falham — preço digitado**

Acrescentar em `src/shared/money.test.ts` (import `formatCentsForInput, parseBRLToCents` junto dos existentes):

```ts
describe("parseBRLToCents", () => {
  it.each([
    ["34,90", 3490],
    ["34,9", 3490],
    ["34", 3400],
    ["0", 0],
    ["1.234,56", 123456],
    ["R$ 12", 1200],
    ["R$12,50", 1250],
    ["  7,05 ", 705],
  ])("%s → %d", (input, cents) => {
    expect(parseBRLToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-1", "12.50", "12,505", "1.23,00", "12,", ",50", "1 000"])("recusa %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("formatCentsForInput", () => {
  it.each([
    [3490, "34,90"],
    [705, "7,05"],
    [0, "0,00"],
    [123456, "1234,56"],
  ])("%d → %s", (cents, text) => {
    expect(formatCentsForInput(cents)).toBe(text);
  });
});

it("formatBRL(-0) não mostra sinal", () => {
  expect(formatBRL(-0)).toBe(`R$${NBSP}0,00`);
});
```

Run: `npm test -- src/shared/money.test.ts`
Expected: FAIL — `parseBRLToCents` não exportado.

- [ ] **Step 2: Implementar em `src/shared/money.ts`**

Acrescentar:

```ts
// "1.234,56", "34,9", "R$ 12" — vírgula decimal (até 2 casas), ponto só como separador de milhar.
const BRL_INPUT = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function parseBRLToCents(input: string): Cents | null {
  const match = BRL_INPUT.exec(input.trim());
  if (!match) return null;
  const reais = Number(match[1]!.replaceAll(".", ""));
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = reais * 100 + centavos;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCentsForInput(cents: Cents): string {
  assertCents(cents);
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
```

e, em `formatBRL`, trocar `return brl.format(cents / 100);` por `return brl.format((cents + 0) / 100);` (soma com 0 transforma `-0` em `0`).

Run: `npm test -- src/shared/money.test.ts`
Expected: PASS.

- [ ] **Step 3: Teste que falha — `imageUrlSchema`**

Acrescentar em `src/shared/validation.test.ts`:

```ts
describe("imageUrlSchema", () => {
  it.each(["https://cdn.exemplo.com/logo.png", "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp"])("aceita %s", (url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    "http://cdn.exemplo.com/logo.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/uploads/../.env",
    "/uploads/logo.png",
    "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.svg",
  ])("recusa %s", (url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(false);
  });
});
```

(importar `imageUrlSchema` de `./validation`.)

Run: `npm test -- src/shared/validation.test.ts`
Expected: FAIL — `imageUrlSchema` não exportado.

- [ ] **Step 4: Implementar em `src/shared/validation.ts`**

Trocar `import type { z } from "zod";` por `import { z } from "zod";` e acrescentar:

```ts
export const UPLOAD_PATH_PATTERN = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export const imageUrlSchema = z.union([z.url({ protocol: /^https$/ }), z.string().regex(UPLOAD_PATH_PATTERN)], {
  error: "imagem deve ser um endereço https ou um arquivo enviado",
});
```

Em `src/modules/stores/settings.ts`: `logoUrl: imageUrlSchema.nullable().default(null)`, `bannerUrl: imageUrlSchema.nullable().default(null)` (import de `@/shared/validation`). Em `src/modules/catalog/definition.ts`: `imageUrl: imageUrlSchema.optional()`.

Run: `npm test && npm run test:int`
Expected: PASS (os testes de http/javascript existentes continuam recusando).

- [ ] **Step 5: Teste que falha — `actionError`**

`src/app/_lib/action-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/errors";
import { actionError, fieldError, success } from "./action-state";

describe("action-state", () => {
  it("VALIDATION vira erros por campo", () => {
    const error = new DomainError("VALIDATION", {
      issues: [
        { path: "name", message: "informe o nome" },
        { path: "sizePrices.0.priceCents", message: "preço inválido" },
      ],
    });
    expect(actionError(error)).toEqual({
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { name: "informe o nome", "sizePrices.0.priceCents": "preço inválido" },
    });
  });

  it("NOT_FOUND vira mensagem genérica", () => {
    expect(actionError(new DomainError("NOT_FOUND"))).toEqual({
      status: "error",
      message: "Item não encontrado.",
      fieldErrors: {},
    });
  });

  it("outros erros são relançados", () => {
    expect(() => actionError(new Error("banco caiu"))).toThrow("banco caiu");
  });

  it("helpers de sucesso e erro de campo", () => {
    expect(success("Salvo.")).toEqual({ status: "success", message: "Salvo." });
    expect(fieldError("price", "preço inválido")).toEqual({
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { price: "preço inválido" },
    });
  });
});
```

Run: `npm test -- src/app/_lib/action-state.test.ts`
Expected: FAIL — `Failed to resolve import "./action-state"`.

- [ ] **Step 6: Implementar `src/app/_lib/action-state.ts`**

```ts
import { isDomainError } from "@/shared/errors";

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

export const idleState: ActionState = { status: "idle" };

const CHECK_FIELDS = "Confira os campos destacados.";

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function fieldError(field: string, message: string): ActionState {
  return { status: "error", message: CHECK_FIELDS, fieldErrors: { [field]: message } };
}

/** Converte erros de domínio esperados em estado de formulário; erros inesperados sobem. */
export function actionError(error: unknown): ActionState {
  if (isDomainError(error) && error.code === "VALIDATION") {
    const issues = (error.details.issues ?? []) as { path: string; message: string }[];
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: Object.fromEntries(issues.map((issue) => [issue.path || "_", issue.message])),
    };
  }
  if (isDomainError(error) && error.code === "NOT_FOUND") {
    return { status: "error", message: "Item não encontrado.", fieldErrors: {} };
  }
  throw error;
}
```

Run: `npm test -- src/app/_lib/action-state.test.ts`
Expected: PASS.

- [ ] **Step 7: Controles de formulário e estilos**

`src/app/_components/styles.ts`:

```ts
export const inputClass =
  "rounded border border-neutral-300 bg-background px-3 py-2 text-sm dark:border-neutral-700";

export const secondaryButtonClass =
  "rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 disabled:opacity-50";
```

`src/app/_components/form-controls.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/_lib/action-state";

export function SubmitButton({ children, pendingText = "Salvando..." }: { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  if (state.status !== "error" || !state.fieldErrors[name]) return null;
  return <p className="text-sm text-red-700 dark:text-red-400">{state.fieldErrors[name]}</p>;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={state.status === "success" ? "text-sm text-green-800 dark:text-green-300" : "text-sm text-red-700 dark:text-red-400"}
    >
      {state.message}
    </p>
  );
}
```

- [ ] **Step 8: Verificar e commitar**

Run: `npm test && npm run test:int && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add price input parsing, image URL validation and form action state"
```

---

### Task 4: Edição do cardápio (serviços) — leitura para edição, categorias e tamanhos

**Files:**
- Create: `src/modules/catalog/ordering.ts`, `src/modules/catalog/ordering.test.ts`
- Create: `src/modules/catalog/editor.ts`, `src/modules/catalog/editor.int.test.ts`
- Modify: `src/modules/catalog/service.ts` (leitura comum), `src/modules/catalog/index.ts`

**Interfaces:**
- Consumes: tabelas do catálogo; `zodIssuesToDomainError`; `DomainError`; `createStore`, `deleteStoreBySlug` (testes).
- Produces (via `@/modules/catalog`):
  - Tipos `EditorSize = { id: string; name: string; maxFlavors: number }`, `EditorProduct = MenuProduct & { categoryId: string; active: boolean }`, `EditorCategory = { id: string; name: string; active: boolean; sizes: EditorSize[]; products: EditorProduct[] }`, `CatalogEditorView = { categories: EditorCategory[]; optionGroups: MenuOptionGroup[] }`.
  - `getCatalogForEditing(storeId: string): Promise<CatalogEditorView>` (inclui inativos e categorias vazias, ordenado).
  - `createCategory(storeId, { name }): Promise<{ id: string }>`; `updateCategory(storeId, categoryId, { name, active }): Promise<void>`; `moveCategory(storeId, categoryId, direction: "up" | "down"): Promise<void>`.
  - `createSize(storeId, categoryId, { name, maxFlavors: 1 | 2 }): Promise<{ id: string }>`; `updateSize(storeId, sizeId, { name, maxFlavors }): Promise<void>`; `moveSize(storeId, sizeId, direction): Promise<void>`; `deleteSize(storeId, sizeId): Promise<void>` (apaga os preços daquele tamanho em cascata).
  - `swapOrder(ids: string[], id: string, direction: "up" | "down"): string[] | null` (`ordering.ts`).
  - Ids de outra loja → `DomainError("NOT_FOUND")`, nada alterado.

- [ ] **Step 1: Teste que falha — `swapOrder`**

`src/modules/catalog/ordering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { swapOrder } from "./ordering";

describe("swapOrder", () => {
  it("sobe e desce um item", () => {
    expect(swapOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(swapOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("null nas pontas ou id ausente", () => {
    expect(swapOrder(["a", "b"], "a", "up")).toBeNull();
    expect(swapOrder(["a", "b"], "b", "down")).toBeNull();
    expect(swapOrder(["a", "b"], "x", "up")).toBeNull();
  });
});
```

Run: `npm test -- src/modules/catalog/ordering.test.ts`
Expected: FAIL — `Failed to resolve import "./ordering"`.

- [ ] **Step 2: Implementar `src/modules/catalog/ordering.ts`**

```ts
export type MoveDirection = "up" | "down";

/** Nova ordem com o item trocado de lugar com o vizinho; null se não há para onde mover. */
export function swapOrder(ids: string[], id: string, direction: MoveDirection): string[] | null {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return null;

  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
```

Run: `npm test -- src/modules/catalog/ordering.test.ts`
Expected: PASS.

- [ ] **Step 3: Leitura comum — refatorar `service.ts`**

Em `src/modules/catalog/service.ts`, transformar o corpo de `getMenu` em `readCatalog(storeId, { includeInactive })`, que devolve `CatalogEditorView`, e reescrever `getMenu` sobre ela:

```ts
import { and, asc, eq, type SQL } from "drizzle-orm";
import type { CatalogEditorView, EditorCategory } from "./editor-types";
// (demais imports como estão)

export async function readCatalog(storeId: string, options: { includeInactive: boolean }): Promise<CatalogEditorView> {
  const onlyActive = <T extends SQL>(condition: T, activeColumn: SQL) =>
    options.includeInactive ? condition : and(condition, activeColumn);

  const [categoryRows, sizeRows, productRows, priceRows, groupRows, optionRows, linkRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(onlyActive(eq(categories.storeId, storeId), eq(categories.active, true)))
      .orderBy(asc(categories.position)),
    db.select().from(categorySizes).where(eq(categorySizes.storeId, storeId)).orderBy(asc(categorySizes.position)),
    db
      .select()
      .from(products)
      .where(onlyActive(eq(products.storeId, storeId), eq(products.active, true)))
      .orderBy(asc(products.position)),
    // (as consultas de preços, grupos, opções e vínculos ficam exatamente como já estão em getMenu)
  ]);

  const sizeOrder = new Map(sizeRows.map((size) => [size.id, size.position]));

  const editorCategories: EditorCategory[] = categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    sizes: sizeRows
      .filter((size) => size.categoryId === category.id)
      .map((size) => ({ id: size.id, name: size.name, maxFlavors: size.maxFlavors })),
    products: productRows
      .filter((product) => product.categoryId === category.id)
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        sizePrices: priceRows
          .filter((price) => price.productId === product.id)
          .sort((a, b) => (sizeOrder.get(a.sizeId) ?? 0) - (sizeOrder.get(b.sizeId) ?? 0))
          .map((price) => ({ sizeId: price.sizeId, priceCents: price.priceCents })),
        allowsHalf: product.allowsHalf,
        active: product.active,
        available: product.available,
        optionGroupIds: linkRows.filter((link) => link.productId === product.id).map((link) => link.groupId),
      })),
  }));

  const optionGroupsView = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: optionRows
      .filter((option) => option.groupId === group.id)
      .map((option) => ({ id: option.id, name: option.name, priceCents: option.priceCents, available: option.available })),
  }));

  return { categories: editorCategories, optionGroups: optionGroupsView };
}

export async function getMenu(storeId: string): Promise<Menu> {
  const catalog = await readCatalog(storeId, { includeInactive: false });
  return {
    categories: catalog.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        sizes: category.sizes,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          priceCents: product.priceCents,
          sizePrices: product.sizePrices,
          allowsHalf: product.allowsHalf,
          available: product.available,
          optionGroupIds: product.optionGroupIds,
        })),
      }))
      .filter((category) => category.products.length > 0),
    optionGroups: catalog.optionGroups,
  };
}
```

Se o tipo genérico de `onlyActive` atrapalhar o TypeScript, usar uma função simples `(condition: SQL, active: SQL): SQL | undefined => options.includeInactive ? condition : and(condition, active)`.

`src/modules/catalog/editor-types.ts` (novo):

```ts
import type { MenuOptionGroup, MenuProduct } from "./menu";

export type EditorSize = { id: string; name: string; maxFlavors: number };
export type EditorProduct = MenuProduct & { categoryId: string; active: boolean };
export type EditorCategory = { id: string; name: string; active: boolean; sizes: EditorSize[]; products: EditorProduct[] };
export type CatalogEditorView = { categories: EditorCategory[]; optionGroups: MenuOptionGroup[] };
```

Run: `npm run test:int -- src/modules/catalog/service.int.test.ts`
Expected: PASS (comportamento de `getMenu` inalterado).

- [ ] **Step 4: Teste de integração que falha — `src/modules/catalog/editor.int.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import {
  createCategory,
  createSize,
  deleteSize,
  getCatalogForEditing,
  moveCategory,
  moveSize,
  updateCategory,
  updateSize,
} from "./editor";
import { getMenu, importCatalog } from "./service";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("catalog editor — categorias e tamanhos", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria categorias no fim, renomeia, desativa e reordena", async () => {
    const storeId = await newStore("loja-a");
    const pizzas = await createCategory(storeId, { name: "Pizzas" });
    const bebidas = await createCategory(storeId, { name: "Bebidas" });

    await updateCategory(storeId, bebidas.id, { name: "Bebidas geladas", active: false });
    await moveCategory(storeId, bebidas.id, "up");

    const view = await getCatalogForEditing(storeId);
    expect(view.categories.map((c) => [c.name, c.active])).toEqual([
      ["Bebidas geladas", false],
      ["Pizzas", true],
    ]);
    expect(view.categories[1]!.id).toBe(pizzas.id);
  });

  it("mover na ponta não faz nada", async () => {
    const storeId = await newStore("loja-a");
    const only = await createCategory(storeId, { name: "Única" });
    await moveCategory(storeId, only.id, "up");
    expect((await getCatalogForEditing(storeId)).categories.map((c) => c.name)).toEqual(["Única"]);
  });

  it("valida nome", async () => {
    const storeId = await newStore("loja-a");
    await expect(createCategory(storeId, { name: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("tamanhos: cria, edita, reordena e apaga (preços caem junto)", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, {
      categories: [
        {
          name: "Pizzas",
          sizes: [
            { key: "broto", name: "Broto", maxFlavors: 1 },
            { key: "grande", name: "Grande", maxFlavors: 2 },
          ],
          products: [{ name: "Mussarela", sizePrices: { broto: 3290, grande: 5490 }, allowsHalf: true }],
        },
      ],
    });
    let view = await getCatalogForEditing(storeId);
    const category = view.categories[0]!;
    const [broto, grande] = category.sizes;

    const media = await createSize(storeId, category.id, { name: "Média", maxFlavors: 2 });
    await updateSize(storeId, broto!.id, { name: "Pequena", maxFlavors: 1 });
    await moveSize(storeId, media.id, "up");
    await deleteSize(storeId, grande!.id);

    view = await getCatalogForEditing(storeId);
    expect(view.categories[0]!.sizes.map((s) => s.name)).toEqual(["Pequena", "Média"]);
    expect(view.categories[0]!.products[0]!.sizePrices).toEqual([{ sizeId: broto!.id, priceCents: 3290 }]);
  });

  it("leitura para edição inclui inativos; cardápio público não", async () => {
    const storeId = await newStore("loja-a");
    const hidden = await createCategory(storeId, { name: "Escondida" });
    await updateCategory(storeId, hidden.id, { name: "Escondida", active: false });

    expect((await getCatalogForEditing(storeId)).categories.map((c) => c.name)).toEqual(["Escondida"]);
    expect((await getMenu(storeId)).categories).toEqual([]);
  });

  it("ids de outra loja → NOT_FOUND sem alterar nada", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    const categoryB = await createCategory(storeB, { name: "Da B" });
    const sizeB = await createSize(storeB, categoryB.id, { name: "Grande", maxFlavors: 2 });

    await expect(updateCategory(storeA, categoryB.id, { name: "Invadida", active: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveCategory(storeA, categoryB.id, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createSize(storeA, categoryB.id, { name: "X", maxFlavors: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateSize(storeA, sizeB.id, { name: "Invadido", maxFlavors: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteSize(storeA, sizeB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewB = await getCatalogForEditing(storeB);
    expect(viewB.categories[0]).toMatchObject({ name: "Da B", sizes: [{ name: "Grande", maxFlavors: 2 }] });
  });
});
```

Run: `npm run test:int -- src/modules/catalog/editor.int.test.ts`
Expected: FAIL — `Failed to resolve import "./editor"`.

- [ ] **Step 5: Implementar `src/modules/catalog/editor.ts`**

```ts
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import type { CatalogEditorView } from "./editor-types";
import { swapOrder, type MoveDirection } from "./ordering";
import { categories, categorySizes } from "./schema";
import { readCatalog } from "./service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const nameSchema = z.string().trim().min(1, "informe o nome").max(80, "nome muito longo");
const categoryInputSchema = z.object({ name: nameSchema, active: z.boolean().default(true) });
const sizeInputSchema = z.object({ name: nameSchema, maxFlavors: z.union([z.literal(1), z.literal(2)]) });

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  return parsed.data;
}

function notFound(): DomainError {
  return new DomainError("NOT_FOUND");
}

export function getCatalogForEditing(storeId: string): Promise<CatalogEditorView> {
  return readCatalog(storeId, { includeInactive: true });
}

/** Garante que a categoria é da loja; lança NOT_FOUND caso contrário. */
export async function assertCategoryInStore(storeId: string, categoryId: string, tx: Tx | typeof db = db): Promise<void> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
}

export async function createCategory(storeId: string, input: { name: string }): Promise<{ id: string }> {
  const { name } = parseInput(categoryInputSchema, input);
  const [last] = await db.select({ position: max(categories.position) }).from(categories).where(eq(categories.storeId, storeId));
  const [row] = await db
    .insert(categories)
    .values({ storeId, name, position: (last?.position ?? -1) + 1 })
    .returning({ id: categories.id });
  return { id: row!.id };
}

export async function updateCategory(storeId: string, categoryId: string, input: { name: string; active: boolean }): Promise<void> {
  const data = parseInput(categoryInputSchema, input);
  const updated = await db
    .update(categories)
    .set(data)
    .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
    .returning({ id: categories.id });
  if (updated.length === 0) throw notFound();
}

export async function moveCategory(storeId: string, categoryId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(asc(categories.position), asc(categories.name));
    const ids = rows.map((row) => row.id);
    if (!ids.includes(categoryId)) throw notFound();

    const next = swapOrder(ids, categoryId, direction);
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx.update(categories).set({ position }).where(eq(categories.id, id));
    }
  });
}

async function findSize(storeId: string, sizeId: string, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ id: categorySizes.id, categoryId: categorySizes.categoryId })
    .from(categorySizes)
    .where(and(eq(categorySizes.id, sizeId), eq(categorySizes.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function createSize(
  storeId: string,
  categoryId: string,
  input: { name: string; maxFlavors: 1 | 2 },
): Promise<{ id: string }> {
  const data = parseInput(sizeInputSchema, input);
  await assertCategoryInStore(storeId, categoryId);
  const [last] = await db
    .select({ position: max(categorySizes.position) })
    .from(categorySizes)
    .where(eq(categorySizes.categoryId, categoryId));
  const [row] = await db
    .insert(categorySizes)
    .values({ storeId, categoryId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: categorySizes.id });
  return { id: row!.id };
}

export async function updateSize(storeId: string, sizeId: string, input: { name: string; maxFlavors: 1 | 2 }): Promise<void> {
  const data = parseInput(sizeInputSchema, input);
  await findSize(storeId, sizeId);
  await db.update(categorySizes).set(data).where(eq(categorySizes.id, sizeId));
}

export async function moveSize(storeId: string, sizeId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const size = await findSize(storeId, sizeId, tx);
    const rows = await tx
      .select({ id: categorySizes.id })
      .from(categorySizes)
      .where(eq(categorySizes.categoryId, size.categoryId))
      .orderBy(asc(categorySizes.position));
    const next = swapOrder(
      rows.map((row) => row.id),
      sizeId,
      direction,
    );
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx.update(categorySizes).set({ position }).where(eq(categorySizes.id, id));
    }
  });
}

export async function deleteSize(storeId: string, sizeId: string): Promise<void> {
  await findSize(storeId, sizeId);
  await db.delete(categorySizes).where(eq(categorySizes.id, sizeId));
}
```

Em `src/modules/catalog/index.ts`, acrescentar:

```ts
export type { CatalogEditorView, EditorCategory, EditorProduct, EditorSize } from "./editor-types";
export {
  createCategory,
  createSize,
  deleteSize,
  getCatalogForEditing,
  moveCategory,
  moveSize,
  updateCategory,
  updateSize,
} from "./editor";
export type { MoveDirection } from "./ordering";
```

- [ ] **Step 6: Rodar e commitar**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add catalog editing services for categories and sizes"
```

---

### Task 5: Edição do cardápio (serviços) — produtos, grupos e opções de adicionais

**Files:**
- Create: `src/modules/catalog/editor-products.ts`, `src/modules/catalog/editor-products.int.test.ts`
- Modify: `src/modules/catalog/index.ts`

**Interfaces:**
- Consumes: `parseInput`, `nameSchema`, `assertCategoryInStore`, `getCatalogForEditing` (`./editor`, Task 4); `swapOrder`, `MoveDirection` (`./ordering`); `imageUrlSchema` (`@/shared/validation`, Task 3); tabelas do catálogo.
- Produces (via `@/modules/catalog`):
  - `type ProductInput = { categoryId: string; name: string; description: string | null; imageUrl: string | null; priceCents: number | null; sizePrices: { sizeId: string; priceCents: number }[]; allowsHalf: boolean; active: boolean; optionGroupIds: string[] }`
  - `createProduct(storeId, input: ProductInput): Promise<{ id: string }>`; `updateProduct(storeId, productId, input: ProductInput): Promise<void>`; `moveProduct(storeId, productId, direction): Promise<void>` (dentro da categoria); `setProductAvailability(storeId, productId, available: boolean): Promise<void>`.
  - Regras de produto (erro `VALIDATION` com `path`): categoria com tamanhos → `priceCents` deve ser `null` e `sizePrices` com ≥ 1 preço, todos de tamanhos **daquela categoria**, sem repetir (`path: "sizePrices"`); categoria sem tamanhos → `priceCents` obrigatório e `sizePrices` vazio (`path: "priceCents"`); `allowsHalf` exige tamanho da categoria com `maxFlavors` 2 (`path: "allowsHalf"`); `optionGroupIds` todos da loja (`path: "optionGroupIds"`). Categoria/produto de outra loja → `NOT_FOUND`.
  - `type OptionGroupInput = { name: string; minSelect: number; maxSelect: number }`; `createOptionGroup(storeId, input): Promise<{ id: string }>`; `updateOptionGroup(storeId, groupId, input): Promise<void>` (`minSelect ≤ maxSelect`, `maxSelect ≥ 1`).
  - `type OptionInput = { name: string; priceCents: number; available: boolean }`; `addOption(storeId, groupId, input): Promise<{ id: string }>`; `updateOption(storeId, optionId, input): Promise<void>`; `setOptionAvailability(storeId, optionId, available: boolean): Promise<void>`.

- [ ] **Step 1: Teste de integração que falha — `src/modules/catalog/editor-products.int.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { createCategory, createSize, getCatalogForEditing } from "./editor";
import {
  addOption,
  createOptionGroup,
  createProduct,
  moveProduct,
  setOptionAvailability,
  setProductAvailability,
  updateOption,
  updateOptionGroup,
  updateProduct,
  type ProductInput,
} from "./editor-products";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

async function pizzaSetup(storeId: string) {
  const category = await createCategory(storeId, { name: "Pizzas" });
  const broto = await createSize(storeId, category.id, { name: "Broto", maxFlavors: 1 });
  const grande = await createSize(storeId, category.id, { name: "Grande", maxFlavors: 2 });
  const borda = await createOptionGroup(storeId, { name: "Borda", minSelect: 0, maxSelect: 1 });
  return { categoryId: category.id, brotoId: broto.id, grandeId: grande.id, bordaId: borda.id };
}

function pizza(overrides: Partial<ProductInput> & Pick<ProductInput, "categoryId">): ProductInput {
  return {
    name: "Calabresa",
    description: "Calabresa e cebola",
    imageUrl: null,
    priceCents: null,
    sizePrices: [],
    allowsHalf: false,
    active: true,
    optionGroupIds: [],
    ...overrides,
  };
}

describe("catalog editor — produtos e adicionais", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria produto com preços por tamanho, meio a meio e borda; depois edita", async () => {
    const storeId = await newStore("loja-a");
    const s = await pizzaSetup(storeId);

    const { id } = await createProduct(
      storeId,
      pizza({
        categoryId: s.categoryId,
        sizePrices: [
          { sizeId: s.grandeId, priceCents: 5690 },
          { sizeId: s.brotoId, priceCents: 3490 },
        ],
        allowsHalf: true,
        optionGroupIds: [s.bordaId],
      }),
    );
    await updateProduct(
      storeId,
      id,
      pizza({
        categoryId: s.categoryId,
        name: "Calabresa especial",
        sizePrices: [{ sizeId: s.brotoId, priceCents: 3990 }],
        allowsHalf: false,
      }),
    );

    const product = (await getCatalogForEditing(storeId)).categories[0]!.products[0]!;
    expect(product).toMatchObject({
      id,
      name: "Calabresa especial",
      priceCents: null,
      sizePrices: [{ sizeId: s.brotoId, priceCents: 3990 }],
      allowsHalf: false,
      optionGroupIds: [],
      active: true,
      available: true,
    });
  });

  it("produto de categoria sem tamanhos exige priceCents", async () => {
    const storeId = await newStore("loja-a");
    const bebidas = await createCategory(storeId, { name: "Bebidas" });

    await expect(createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca" }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "priceCents" }] },
    });
    const ok = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca", priceCents: 1400 }));
    expect(ok.id).toBeTruthy();
  });

  it.each([
    ["sem nenhum preço", { sizePrices: [] }, "sizePrices"],
    ["com priceCents", { priceCents: 1000 }, "sizePrices"],
    ["meio a meio sem tamanho de 2 sabores", { allowsHalf: true }, "allowsHalf"],
  ])("recusa pizza %s", async (_label, overrides, path) => {
    const storeId = await newStore("loja-a");
    const category = await createCategory(storeId, { name: "Pizzas" });
    const broto = await createSize(storeId, category.id, { name: "Broto", maxFlavors: 1 });
    const input = pizza({ categoryId: category.id, sizePrices: [{ sizeId: broto.id, priceCents: 3490 }], ...overrides });

    await expect(createProduct(storeId, input)).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path }] },
    });
  });

  it("recusa tamanho repetido e tamanho de outra categoria", async () => {
    const storeId = await newStore("loja-a");
    const s = await pizzaSetup(storeId);
    const doces = await createCategory(storeId, { name: "Doces" });
    const doceBroto = await createSize(storeId, doces.id, { name: "Broto", maxFlavors: 1 });

    for (const sizePrices of [
      [
        { sizeId: s.brotoId, priceCents: 3490 },
        { sizeId: s.brotoId, priceCents: 3590 },
      ],
      [{ sizeId: doceBroto.id, priceCents: 3490 }],
    ]) {
      await expect(createProduct(storeId, pizza({ categoryId: s.categoryId, sizePrices }))).rejects.toMatchObject({
        code: "VALIDATION",
        details: { issues: [{ path: "sizePrices" }] },
      });
    }
  });

  it("disponibilidade e ordem de produtos", async () => {
    const storeId = await newStore("loja-a");
    const bebidas = await createCategory(storeId, { name: "Bebidas" });
    const coca = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca", priceCents: 1400 }));
    const agua = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Água", priceCents: 400 }));

    await setProductAvailability(storeId, coca.id, false);
    await moveProduct(storeId, agua.id, "up");

    const products = (await getCatalogForEditing(storeId)).categories[0]!.products;
    expect(products.map((p) => [p.name, p.available])).toEqual([
      ["Água", true],
      ["Coca", false],
    ]);
  });

  it("grupos e opções de adicionais", async () => {
    const storeId = await newStore("loja-a");
    const group = await createOptionGroup(storeId, { name: "Borda", minSelect: 0, maxSelect: 1 });
    const catupiry = await addOption(storeId, group.id, { name: "Catupiry", priceCents: 800, available: true });
    await addOption(storeId, group.id, { name: "Cheddar", priceCents: 800, available: true });

    await updateOptionGroup(storeId, group.id, { name: "Borda recheada", minSelect: 0, maxSelect: 2 });
    await updateOption(storeId, catupiry.id, { name: "Catupiry original", priceCents: 900, available: true });
    await setOptionAvailability(storeId, catupiry.id, false);

    const [view] = (await getCatalogForEditing(storeId)).optionGroups;
    expect(view).toMatchObject({ name: "Borda recheada", minSelect: 0, maxSelect: 2 });
    expect(view!.options.map((o) => [o.name, o.priceCents, o.available])).toEqual([
      ["Catupiry original", 900, false],
      ["Cheddar", 800, true],
    ]);
    await expect(createOptionGroup(storeId, { name: "X", minSelect: 2, maxSelect: 1 })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("ids de outra loja → NOT_FOUND/VALIDATION sem alterar nada", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    const a = await pizzaSetup(storeA);
    const b = await pizzaSetup(storeB);
    const bebidasB = await createCategory(storeB, { name: "Bebidas" });
    const cocaB = await createProduct(storeB, pizza({ categoryId: bebidasB.id, name: "Coca B", priceCents: 1400 }));
    const optionB = await addOption(storeB, b.bordaId, { name: "Cheddar B", priceCents: 800, available: true });

    await expect(createProduct(storeA, pizza({ categoryId: bebidasB.id, priceCents: 1 }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateProduct(storeA, cocaB.id, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: a.brotoId, priceCents: 1 }] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setProductAvailability(storeA, cocaB.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveProduct(storeA, cocaB.id, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createProduct(storeA, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: b.brotoId, priceCents: 1 }] })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createProduct(storeA, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: a.brotoId, priceCents: 1 }], optionGroupIds: [b.bordaId] })),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "optionGroupIds" }] } });
    await expect(updateOptionGroup(storeA, b.bordaId, { name: "Invadido", minSelect: 0, maxSelect: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(addOption(storeA, b.bordaId, { name: "X", priceCents: 0, available: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateOption(storeA, optionB.id, { name: "Invadido", priceCents: 0, available: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setOptionAvailability(storeA, optionB.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewB = await getCatalogForEditing(storeB);
    expect(viewB.categories.find((c) => c.name === "Bebidas")!.products[0]).toMatchObject({ name: "Coca B", available: true });
    expect(viewB.optionGroups[0]).toMatchObject({ name: "Borda", options: [{ name: "Cheddar B", available: true }] });
  });
});
```

Run: `npm run test:int -- src/modules/catalog/editor-products.int.test.ts`
Expected: FAIL — `Failed to resolve import "./editor-products"`.

- [ ] **Step 2: Implementar `src/modules/catalog/editor-products.ts`**

```ts
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { imageUrlSchema } from "@/shared/validation";
import { assertCategoryInStore, nameSchema, parseInput } from "./editor";
import { swapOrder, type MoveDirection } from "./ordering";
import { categorySizes, optionGroups, options, productOptionGroups, products, productSizePrices } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const cents = z.number().int("valor inválido").nonnegative("valor inválido");

const productInputSchema = z.object({
  categoryId: z.uuid(),
  name: nameSchema,
  description: z.string().trim().max(300, "descrição muito longa").nullable(),
  imageUrl: imageUrlSchema.nullable(),
  priceCents: cents.nullable(),
  sizePrices: z.array(z.object({ sizeId: z.uuid(), priceCents: cents })),
  allowsHalf: z.boolean(),
  active: z.boolean(),
  optionGroupIds: z.array(z.uuid()),
});

export type ProductInput = z.input<typeof productInputSchema>;

const optionGroupInputSchema = z
  .object({
    name: nameSchema,
    minSelect: z.number().int().min(0, "mínimo inválido"),
    maxSelect: z.number().int().min(1, "máximo deve ser ao menos 1"),
  })
  .refine((group) => group.minSelect <= group.maxSelect, { message: "mínimo maior que máximo", path: ["minSelect"] });

export type OptionGroupInput = z.input<typeof optionGroupInputSchema>;

const optionInputSchema = z.object({ name: nameSchema, priceCents: cents, available: z.boolean() });

export type OptionInput = z.input<typeof optionInputSchema>;

function invalid(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

function notFound(): DomainError {
  return new DomainError("NOT_FOUND");
}

/** Regras que dependem do banco: tamanhos da categoria, meio a meio e grupos da loja. */
async function validateProductRelations(storeId: string, data: z.infer<typeof productInputSchema>, tx: Tx): Promise<void> {
  await assertCategoryInStore(storeId, data.categoryId, tx);

  const sizes = await tx
    .select({ id: categorySizes.id, maxFlavors: categorySizes.maxFlavors })
    .from(categorySizes)
    .where(eq(categorySizes.categoryId, data.categoryId));

  if (sizes.length > 0) {
    const sizeIds = new Set(sizes.map((size) => size.id));
    const pricedIds = data.sizePrices.map((price) => price.sizeId);
    const valid =
      data.priceCents === null &&
      pricedIds.length > 0 &&
      new Set(pricedIds).size === pricedIds.length &&
      pricedIds.every((id) => sizeIds.has(id));
    if (!valid) throw invalid("sizePrices", "informe o preço de ao menos um tamanho desta categoria");
  } else if (data.priceCents === null || data.sizePrices.length > 0) {
    throw invalid("priceCents", "informe o preço");
  }

  if (data.allowsHalf && !sizes.some((size) => size.maxFlavors === 2)) {
    throw invalid("allowsHalf", "meio a meio exige um tamanho com até 2 sabores");
  }

  if (data.optionGroupIds.length > 0) {
    const groups = await tx
      .select({ id: optionGroups.id })
      .from(optionGroups)
      .where(and(eq(optionGroups.storeId, storeId), inArray(optionGroups.id, data.optionGroupIds)));
    if (groups.length !== new Set(data.optionGroupIds).size) throw invalid("optionGroupIds", "grupo de adicionais inválido");
  }
}

async function replaceProductRelations(productId: string, data: z.infer<typeof productInputSchema>, tx: Tx): Promise<void> {
  await tx.delete(productSizePrices).where(eq(productSizePrices.productId, productId));
  await tx.delete(productOptionGroups).where(eq(productOptionGroups.productId, productId));
  if (data.sizePrices.length > 0) {
    await tx
      .insert(productSizePrices)
      .values(data.sizePrices.map((price) => ({ productId, categorySizeId: price.sizeId, priceCents: price.priceCents })));
  }
  if (data.optionGroupIds.length > 0) {
    await tx
      .insert(productOptionGroups)
      .values(data.optionGroupIds.map((groupId, position) => ({ productId, groupId, position })));
  }
}

function productColumns(data: z.infer<typeof productInputSchema>) {
  return {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description || null,
    imageUrl: data.imageUrl,
    priceCents: data.priceCents,
    allowsHalf: data.allowsHalf,
    active: data.active,
  };
}

async function findProduct(storeId: string, productId: string, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ id: products.id, categoryId: products.categoryId })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function createProduct(storeId: string, input: ProductInput): Promise<{ id: string }> {
  const data = parseInput(productInputSchema, input);
  return db.transaction(async (tx) => {
    await validateProductRelations(storeId, data, tx);
    const [last] = await tx
      .select({ position: max(products.position) })
      .from(products)
      .where(eq(products.categoryId, data.categoryId));
    const [row] = await tx
      .insert(products)
      .values({ storeId, ...productColumns(data), position: (last?.position ?? -1) + 1 })
      .returning({ id: products.id });
    await replaceProductRelations(row!.id, data, tx);
    return { id: row!.id };
  });
}

export async function updateProduct(storeId: string, productId: string, input: ProductInput): Promise<void> {
  const data = parseInput(productInputSchema, input);
  await db.transaction(async (tx) => {
    await findProduct(storeId, productId, tx);
    await validateProductRelations(storeId, data, tx);
    await tx.update(products).set(productColumns(data)).where(eq(products.id, productId));
    await replaceProductRelations(productId, data, tx);
  });
}

export async function moveProduct(storeId: string, productId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const product = await findProduct(storeId, productId, tx);
    const rows = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, product.categoryId))
      .orderBy(asc(products.position));
    const next = swapOrder(
      rows.map((row) => row.id),
      productId,
      direction,
    );
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx.update(products).set({ position }).where(eq(products.id, id));
    }
  });
}

export async function setProductAvailability(storeId: string, productId: string, available: boolean): Promise<void> {
  const updated = await db
    .update(products)
    .set({ available })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  if (updated.length === 0) throw notFound();
}

export async function createOptionGroup(storeId: string, input: OptionGroupInput): Promise<{ id: string }> {
  const data = parseInput(optionGroupInputSchema, input);
  const [last] = await db.select({ position: max(optionGroups.position) }).from(optionGroups).where(eq(optionGroups.storeId, storeId));
  const [row] = await db
    .insert(optionGroups)
    .values({ storeId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: optionGroups.id });
  return { id: row!.id };
}

export async function updateOptionGroup(storeId: string, groupId: string, input: OptionGroupInput): Promise<void> {
  const data = parseInput(optionGroupInputSchema, input);
  const updated = await db
    .update(optionGroups)
    .set(data)
    .where(and(eq(optionGroups.id, groupId), eq(optionGroups.storeId, storeId)))
    .returning({ id: optionGroups.id });
  if (updated.length === 0) throw notFound();
}

export async function addOption(storeId: string, groupId: string, input: OptionInput): Promise<{ id: string }> {
  const data = parseInput(optionInputSchema, input);
  const [group] = await db
    .select({ id: optionGroups.id })
    .from(optionGroups)
    .where(and(eq(optionGroups.id, groupId), eq(optionGroups.storeId, storeId)))
    .limit(1);
  if (!group) throw notFound();

  const [last] = await db.select({ position: max(options.position) }).from(options).where(eq(options.groupId, groupId));
  const [row] = await db
    .insert(options)
    .values({ storeId, groupId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: options.id });
  return { id: row!.id };
}

export async function updateOption(storeId: string, optionId: string, input: OptionInput): Promise<void> {
  const data = parseInput(optionInputSchema, input);
  const updated = await db
    .update(options)
    .set(data)
    .where(and(eq(options.id, optionId), eq(options.storeId, storeId)))
    .returning({ id: options.id });
  if (updated.length === 0) throw notFound();
}

export async function setOptionAvailability(storeId: string, optionId: string, available: boolean): Promise<void> {
  const updated = await db
    .update(options)
    .set({ available })
    .where(and(eq(options.id, optionId), eq(options.storeId, storeId)))
    .returning({ id: options.id });
  if (updated.length === 0) throw notFound();
}
```

Nota: `createProduct` com categoria de outra loja precisa dar `NOT_FOUND` (não `VALIDATION`) — `assertCategoryInStore` roda antes das outras checagens. `updateProduct` com produto de outra loja dá `NOT_FOUND` em `findProduct`. Tamanho de outra loja cai em "tamanho não pertence à categoria" → `VALIDATION`.

Em `src/modules/catalog/index.ts`, acrescentar:

```ts
export {
  addOption,
  createOptionGroup,
  createProduct,
  moveProduct,
  setOptionAvailability,
  setProductAvailability,
  updateOption,
  updateOptionGroup,
  updateProduct,
  type OptionGroupInput,
  type OptionInput,
  type ProductInput,
} from "./editor-products";
```

- [ ] **Step 3: Rodar e commitar**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add catalog editing services for products and option groups"
```

---

### Task 6: Painel — tela de cardápio (categorias, tamanhos, produtos)

**Files:**
- Create: `src/app/painel/cardapio/actions.ts`
- Replace: `src/app/painel/cardapio/page.tsx`
- Create: `src/app/painel/cardapio/_components/move-buttons.tsx`, `new-category-form.tsx`, `category-form.tsx`, `sizes-editor.tsx`, `category-card.tsx`, `product-form.tsx`
- Create: `src/app/painel/cardapio/produtos/novo/page.tsx`, `src/app/painel/cardapio/produtos/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireStoreAccess` (Task 2); serviços de `@/modules/catalog` (Tasks 4–5); `storeMenuTag` (`@/modules/stores`); `parseBRLToCents`, `formatCentsForInput`, `formatBRL` (`@/shared/money`); `ActionState`, `idleState`, `success`, `fieldError`, `actionError` (`@/app/_lib/action-state`); `SubmitButton`, `FieldError`, `FormMessage`, `inputClass`, `secondaryButtonClass` (Task 3); `updateTag` (`next/cache`).
- Produces:
  - Server Actions em `actions.ts`: `createCategoryAction`, `updateCategoryAction`, `createSizeAction`, `updateSizeAction`, `saveProductAction` (assinatura `(prev: ActionState, form: FormData) => Promise<ActionState>`) e `moveCategoryAction`, `moveSizeAction`, `deleteSizeAction`, `moveProductAction` (assinatura `(form: FormData) => Promise<void>`). Todas: `requireStoreAccess()` → serviço → `updateTag(storeMenuTag(store.slug))`.
  - Helper `mutate(work: (storeId: string) => Promise<unknown>, message: string): Promise<ActionState>` (local a `actions.ts`).
  - Rótulos usados pelo E2E (Task 11), exatamente: título "Cardápio"; campo "Nova categoria" + botão "Adicionar categoria"; cada categoria é um `<section>` com `aria-label` = nome da categoria; botões "Subir"/"Descer" com `aria-label` "Subir <nome>"/"Descer <nome>"; link "Novo produto" por categoria; link "Editar <produto>" por produto; no formulário de produto: campos "Nome", "Descrição", "Preço" (sem tamanhos) ou "Preço <tamanho>" (com tamanhos), caixas "Permite meio a meio", "Ativo", "Adicional: <grupo>", botão "Salvar produto"; tamanhos: campos "Novo tamanho" + seletor "Sabores do novo tamanho" + botão "Adicionar tamanho"; botão "Remover tamanho <nome>".
  - Produto salvo com sucesso redireciona para `/painel/cardapio`.

- [ ] **Step 1: Server Actions — `src/app/painel/cardapio/actions.ts`**

```ts
"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  createProduct,
  createSize,
  deleteSize,
  moveCategory,
  moveProduct,
  moveSize,
  updateCategory,
  updateProduct,
  updateSize,
  type MoveDirection,
  type ProductInput,
} from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function direction(form: FormData): MoveDirection {
  return form.get("direction") === "down" ? "down" : "up";
}

function maxFlavors(form: FormData): 1 | 2 {
  return form.get("maxFlavors") === "2" ? 2 : 1;
}

async function mutate(work: (storeId: string) => Promise<unknown>, message: string): Promise<ActionState> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    return actionError(error);
  }
  updateTag(storeMenuTag(store.slug));
  return success(message);
}

export async function createCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => createCategory(storeId, { name: text(form, "name") }), "Categoria criada.");
}

export async function updateCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) =>
      updateCategory(storeId, text(form, "categoryId"), { name: text(form, "name"), active: form.get("active") === "on" }),
    "Categoria salva.",
  );
}

export async function moveCategoryAction(form: FormData): Promise<void> {
  await mutate((storeId) => moveCategory(storeId, text(form, "categoryId"), direction(form)), "");
}

export async function createSizeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) => createSize(storeId, text(form, "categoryId"), { name: text(form, "name"), maxFlavors: maxFlavors(form) }),
    "Tamanho criado.",
  );
}

export async function updateSizeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) => updateSize(storeId, text(form, "sizeId"), { name: text(form, "name"), maxFlavors: maxFlavors(form) }),
    "Tamanho salvo.",
  );
}

export async function moveSizeAction(form: FormData): Promise<void> {
  await mutate((storeId) => moveSize(storeId, text(form, "sizeId"), direction(form)), "");
}

export async function deleteSizeAction(form: FormData): Promise<void> {
  await mutate((storeId) => deleteSize(storeId, text(form, "sizeId")), "");
}

export async function moveProductAction(form: FormData): Promise<void> {
  await mutate((storeId) => moveProduct(storeId, text(form, "productId"), direction(form)), "");
}

const PRICE_PREFIX = "price:";

function readProductForm(form: FormData): { input: ProductInput } | { error: ActionState } {
  let priceCents: number | null = null;
  const sizePrices: ProductInput["sizePrices"] = [];

  if (form.get("hasSizes") === "1") {
    for (const [key, value] of form.entries()) {
      if (!key.startsWith(PRICE_PREFIX) || String(value).trim() === "") continue;
      const cents = parseBRLToCents(String(value));
      if (cents === null) return { error: fieldError(key, "preço inválido (use 34,90)") };
      sizePrices.push({ sizeId: key.slice(PRICE_PREFIX.length), priceCents: cents });
    }
  } else if (text(form, "price") !== "") {
    priceCents = parseBRLToCents(text(form, "price"));
    if (priceCents === null) return { error: fieldError("priceCents", "preço inválido (use 34,90)") };
  }

  return {
    input: {
      categoryId: text(form, "categoryId"),
      name: text(form, "name"),
      description: text(form, "description") || null,
      imageUrl: text(form, "imageUrl") || null,
      priceCents,
      sizePrices,
      allowsHalf: form.get("allowsHalf") === "on",
      active: form.get("active") === "on",
      optionGroupIds: form.getAll("optionGroupIds").map(String),
    },
  };
}

export async function saveProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = readProductForm(form);
  if ("error" in parsed) return parsed.error;

  const productId = text(form, "productId");
  const state = await mutate(
    (storeId) => (productId ? updateProduct(storeId, productId, parsed.input) : createProduct(storeId, parsed.input)),
    "Produto salvo.",
  );
  if (state.status === "success") redirect("/painel/cardapio");
  return state;
}
```

- [ ] **Step 2: Componentes**

`src/app/painel/cardapio/_components/move-buttons.tsx`:

```tsx
import { secondaryButtonClass } from "@/app/_components/styles";

export function MoveButtons({
  action,
  hidden,
  label,
  isFirst,
  isLast,
}: {
  action: (form: FormData) => Promise<void>;
  hidden: Record<string, string>;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <form action={action} className="flex gap-1">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" name="direction" value="up" disabled={isFirst} aria-label={`Subir ${label}`} className={secondaryButtonClass}>
        ↑
      </button>
      <button type="submit" name="direction" value="down" disabled={isLast} aria-label={`Descer ${label}`} className={secondaryButtonClass}>
        ↓
      </button>
    </form>
  );
}
```

`src/app/painel/cardapio/_components/new-category-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createCategoryAction } from "@/app/painel/cardapio/actions";

export function NewCategoryForm() {
  const [state, formAction] = useActionState(createCategoryAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Nova categoria
        <input name="name" required maxLength={80} className={inputClass} />
      </label>
      <SubmitButton>Adicionar categoria</SubmitButton>
      <FieldError state={state} name="name" />
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/cardapio/_components/category-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { updateCategoryAction } from "@/app/painel/cardapio/actions";

export function CategoryForm({ categoryId, name, active }: { categoryId: string; name: string; active: boolean }) {
  const [state, formAction] = useActionState(updateCategoryAction, idleState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <label className="flex flex-col gap-1 text-sm">
        Nome da categoria
        <input name="name" defaultValue={name} required maxLength={80} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} />
        Ativa
      </label>
      <SubmitButton>Salvar categoria</SubmitButton>
      <FieldError state={state} name="name" />
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/cardapio/_components/sizes-editor.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { EditorSize } from "@/modules/catalog";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createSizeAction, deleteSizeAction, moveSizeAction, updateSizeAction } from "@/app/painel/cardapio/actions";

function FlavorsSelect({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select name={name} defaultValue={String(defaultValue)} className={inputClass}>
        <option value="1">1 sabor</option>
        <option value="2">até 2 sabores</option>
      </select>
    </label>
  );
}

function SizeRow({ size, isFirst, isLast }: { size: EditorSize; isFirst: boolean; isLast: boolean }) {
  const [state, formAction] = useActionState(updateSizeAction, idleState);

  return (
    <li className="flex flex-wrap items-end gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="sizeId" value={size.id} />
        <label className="flex flex-col gap-1 text-sm">
          Tamanho
          <input name="name" defaultValue={size.name} required maxLength={80} className={inputClass} />
        </label>
        <FlavorsSelect name="maxFlavors" label="Sabores" defaultValue={size.maxFlavors} />
        <SubmitButton>Salvar tamanho</SubmitButton>
        <FieldError state={state} name="name" />
        <FormMessage state={state} />
      </form>
      <form action={moveSizeAction} className="flex gap-1">
        <input type="hidden" name="sizeId" value={size.id} />
        <button type="submit" name="direction" value="up" disabled={isFirst} aria-label={`Subir ${size.name}`} className={secondaryButtonClass}>
          ↑
        </button>
        <button type="submit" name="direction" value="down" disabled={isLast} aria-label={`Descer ${size.name}`} className={secondaryButtonClass}>
          ↓
        </button>
      </form>
      <form
        action={deleteSizeAction}
        onSubmit={(event) => {
          if (!window.confirm(`Remover o tamanho ${size.name}? Os preços desse tamanho serão apagados.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="sizeId" value={size.id} />
        <button type="submit" className={secondaryButtonClass}>
          Remover tamanho {size.name}
        </button>
      </form>
    </li>
  );
}

export function SizesEditor({ categoryId, sizes }: { categoryId: string; sizes: EditorSize[] }) {
  const [state, formAction] = useActionState(createSizeAction, idleState);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Tamanhos</h3>
      {sizes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sizes.map((size, index) => (
            <SizeRow key={size.id} size={size} isFirst={index === 0} isLast={index === sizes.length - 1} />
          ))}
        </ul>
      )}
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="categoryId" value={categoryId} />
        <label className="flex flex-col gap-1 text-sm">
          Novo tamanho
          <input name="name" required maxLength={80} className={inputClass} />
        </label>
        <FlavorsSelect name="maxFlavors" label="Sabores do novo tamanho" defaultValue={1} />
        <SubmitButton>Adicionar tamanho</SubmitButton>
        <FieldError state={state} name="name" />
        <FormMessage state={state} />
      </form>
    </div>
  );
}
```

`src/app/painel/cardapio/_components/category-card.tsx`:

```tsx
import Link from "next/link";
import { startingPriceCents, type EditorCategory } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";
import { moveCategoryAction, moveProductAction } from "@/app/painel/cardapio/actions";
import { CategoryForm } from "./category-form";
import { MoveButtons } from "./move-buttons";
import { SizesEditor } from "./sizes-editor";

function priceLabel(product: EditorCategory["products"][number]): string {
  const cents = startingPriceCents(product);
  if (cents === null) return "sem preço";
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}

const badge = "rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

export function CategoryCard({ category, isFirst, isLast }: { category: EditorCategory; isFirst: boolean; isLast: boolean }) {
  return (
    <section aria-label={category.name} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{category.name}</h2>
        {!category.active && <span className={badge}>Inativa</span>}
        <div className="ml-auto">
          <MoveButtons action={moveCategoryAction} hidden={{ categoryId: category.id }} label={category.name} isFirst={isFirst} isLast={isLast} />
        </div>
      </div>

      <CategoryForm categoryId={category.id} name={category.name} active={category.active} />
      <SizesEditor categoryId={category.id} sizes={category.sizes} />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Produtos</h3>
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {category.products.map((product, index) => (
            <li key={product.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-medium">{product.name}</span>
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{priceLabel(product)}</span>
              {!product.active && <span className={badge}>Inativo</span>}
              {!product.available && <span className={badge}>Esgotado</span>}
              <div className="ml-auto flex items-center gap-2">
                <Link href={`/painel/cardapio/produtos/${product.id}`} aria-label={`Editar ${product.name}`} className="text-sm underline">
                  Editar
                </Link>
                <MoveButtons
                  action={moveProductAction}
                  hidden={{ productId: product.id }}
                  label={product.name}
                  isFirst={index === 0}
                  isLast={index === category.products.length - 1}
                />
              </div>
            </li>
          ))}
        </ul>
        <Link href={`/painel/cardapio/produtos/novo?categoria=${category.id}`} className="self-start text-sm underline">
          Novo produto
        </Link>
      </div>
    </section>
  );
}
```

`src/app/painel/cardapio/_components/product-form.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EditorCategory, EditorProduct, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveProductAction } from "@/app/painel/cardapio/actions";

type Props = {
  category: Pick<EditorCategory, "id" | "name" | "sizes">;
  optionGroups: Pick<MenuOptionGroup, "id" | "name">[];
  product: EditorProduct | null;
};

export function ProductForm({ category, optionGroups, product }: Props) {
  const [state, formAction] = useActionState(saveProductAction, idleState);
  const hasSizes = category.sizes.length > 0;
  const allowsHalfOption = category.sizes.some((size) => size.maxFlavors === 2);
  const priceFor = (sizeId: string) => product?.sizePrices.find((price) => price.sizeId === sizeId)?.priceCents;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="hasSizes" value={hasSizes ? "1" : "0"} />
      <input type="hidden" name="imageUrl" value={product?.imageUrl ?? ""} />

      <p className="text-sm text-neutral-700 dark:text-neutral-300">Categoria: {category.name}</p>

      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input name="name" defaultValue={product?.name} required maxLength={80} className={inputClass} />
      </label>
      <FieldError state={state} name="name" />

      <label className="flex flex-col gap-1 text-sm">
        Descrição
        <textarea name="description" defaultValue={product?.description ?? ""} maxLength={300} rows={3} className={inputClass} />
      </label>
      <FieldError state={state} name="description" />

      {hasSizes ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Preços por tamanho (deixe vazio se não vende nesse tamanho)</legend>
          {category.sizes.map((size) => {
            const cents = priceFor(size.id);
            return (
              <div key={size.id} className="flex flex-col gap-1">
                <label className="flex flex-col gap-1 text-sm">
                  Preço {size.name}
                  <input
                    name={`price:${size.id}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={cents === undefined ? "" : formatCentsForInput(cents)}
                    className={inputClass}
                  />
                </label>
                <FieldError state={state} name={`price:${size.id}`} />
              </div>
            );
          })}
          <FieldError state={state} name="sizePrices" />
        </fieldset>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Preço
            <input
              name="price"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={product?.priceCents == null ? "" : formatCentsForInput(product.priceCents)}
              className={inputClass}
            />
          </label>
          <FieldError state={state} name="priceCents" />
        </>
      )}

      {allowsHalfOption && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowsHalf" defaultChecked={product?.allowsHalf ?? false} />
          Permite meio a meio
        </label>
      )}
      <FieldError state={state} name="allowsHalf" />

      {optionGroups.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Adicionais</legend>
          {optionGroups.map((group) => (
            <label key={group.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="optionGroupIds"
                value={group.id}
                defaultChecked={product?.optionGroupIds.includes(group.id) ?? false}
              />
              Adicional: {group.name}
            </label>
          ))}
          <FieldError state={state} name="optionGroupIds" />
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
        Ativo
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton>Salvar produto</SubmitButton>
        <Link href="/painel/cardapio" className="text-sm underline">
          Cancelar
        </Link>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
```

(O campo de imagem é trocado pelo upload na Task 10; aqui `imageUrl` só preserva o valor atual.)

- [ ] **Step 3: Páginas**

`src/app/painel/cardapio/page.tsx`:

```tsx
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { CategoryCard } from "./_components/category-card";
import { NewCategoryForm } from "./_components/new-category-form";

async function CatalogEditor() {
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-6">
      <NewCategoryForm />
      {catalog.categories.length === 0 && (
        <p className="text-neutral-700 dark:text-neutral-300">Nenhuma categoria ainda. Comece criando uma.</p>
      )}
      {catalog.categories.map((category, index) => (
        <CategoryCard
          key={category.id}
          category={category}
          isFirst={index === 0}
          isLast={index === catalog.categories.length - 1}
        />
      ))}
    </div>
  );
}

export default function CardapioPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Cardápio</h1>
      <Suspense fallback={<p className="text-neutral-700 dark:text-neutral-300">Carregando cardápio...</p>}>
        <CatalogEditor />
      </Suspense>
    </div>
  );
}
```

`src/app/painel/cardapio/produtos/novo/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { ProductForm } from "@/app/painel/cardapio/_components/product-form";

async function NewProduct({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);
  const category = catalog.categories.find((item) => item.id === categoria);
  if (!category) notFound();

  return (
    <ProductForm
      category={{ id: category.id, name: category.name, sizes: category.sizes }}
      optionGroups={catalog.optionGroups.map(({ id, name }) => ({ id, name }))}
      product={null}
    />
  );
}

export default function NewProductPage({ searchParams }: PageProps<"/painel/cardapio/produtos/novo">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Novo produto</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <NewProduct searchParams={searchParams as Promise<{ categoria?: string }>} />
      </Suspense>
    </div>
  );
}
```

`src/app/painel/cardapio/produtos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { ProductForm } from "@/app/painel/cardapio/_components/product-form";

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);
  const category = catalog.categories.find((item) => item.products.some((product) => product.id === id));
  const product = category?.products.find((item) => item.id === id);
  if (!category || !product) notFound();

  return (
    <ProductForm
      category={{ id: category.id, name: category.name, sizes: category.sizes }}
      optionGroups={catalog.optionGroups.map(({ id: groupId, name }) => ({ id: groupId, name }))}
      product={product}
    />
  );
}

export default function EditProductPage({ params }: PageProps<"/painel/cardapio/produtos/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar produto</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <EditProduct params={params} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Verificação manual guiada por curl e build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sem erros. O `build` lista as rotas `/painel/cardapio`, `/painel/cardapio/produtos/novo`, `/painel/cardapio/produtos/[id]`.

Run: `npm run seed:demo && npm run test:e2e -- e2e/painel-auth.spec.ts`
Expected: PASS (o título "Cardápio" continua; agora com o editor).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add panel menu editor for categories, sizes and products"
```

---

### Task 7: Painel — adicionais e disponibilidade

**Files:**
- Create: `src/app/painel/cardapio/adicionais/actions.ts`, `src/app/painel/cardapio/adicionais/page.tsx`, `src/app/painel/cardapio/adicionais/_components/option-group-card.tsx`, `new-option-group-form.tsx`
- Create: `src/app/painel/disponibilidade/actions.ts`, `src/app/painel/disponibilidade/page.tsx`

**Interfaces:**
- Consumes: `createOptionGroup`, `updateOptionGroup`, `addOption`, `updateOption`, `setProductAvailability`, `setOptionAvailability`, `getCatalogForEditing` (`@/modules/catalog`); `requireStoreAccess`; `storeMenuTag`; `parseBRLToCents`, `formatCentsForInput`; form controls e action-state (Task 3).
- Produces:
  - Actions de adicionais `(prev, form) => Promise<ActionState>`: `createOptionGroupAction`, `updateOptionGroupAction`, `addOptionAction`, `updateOptionAction`.
  - Actions de disponibilidade `(form) => Promise<void>`: `toggleProductAvailabilityAction`, `toggleOptionAvailabilityAction` (campo `available` = `"true"`/`"false"` com o **novo** valor).
  - Rótulos para o E2E: página "Adicionais" com campo "Novo grupo" + "Mínimo" + "Máximo" + botão "Criar grupo"; cada grupo em `<section aria-label="<nome do grupo>">` com "Nova opção", "Preço da nova opção", botão "Adicionar opção". Página "Disponibilidade": cada produto/opção numa linha `<li>` com o nome e um botão "Marcar esgotado" (se disponível) ou "Marcar disponível" (se esgotado), com `aria-label` "Marcar <nome> como esgotado"/"Marcar <nome> como disponível".
  - Cada action grava com `storeId` da sessão e chama `updateTag(storeMenuTag(store.slug))`.

- [ ] **Step 1: Actions de adicionais — `src/app/painel/cardapio/adicionais/actions.ts`**

```ts
"use server";

import { updateTag } from "next/cache";
import { addOption, createOptionGroup, updateOption, updateOptionGroup } from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function integer(form: FormData, key: string): number {
  const value = Number(text(form, key));
  return Number.isInteger(value) ? value : Number.NaN;
}

async function mutate(work: (storeId: string) => Promise<unknown>, message: string): Promise<ActionState> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    return actionError(error);
  }
  updateTag(storeMenuTag(store.slug));
  return success(message);
}

function groupInput(form: FormData) {
  return { name: text(form, "name"), minSelect: integer(form, "minSelect"), maxSelect: integer(form, "maxSelect") };
}

export async function createOptionGroupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => createOptionGroup(storeId, groupInput(form)), "Grupo criado.");
}

export async function updateOptionGroupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => updateOptionGroup(storeId, text(form, "groupId"), groupInput(form)), "Grupo salvo.");
}

export async function addOptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const priceCents = parseBRLToCents(text(form, "price") || "0");
  if (priceCents === null) return fieldError("priceCents", "preço inválido (use 8,00)");
  return mutate(
    (storeId) => addOption(storeId, text(form, "groupId"), { name: text(form, "name"), priceCents, available: true }),
    "Opção adicionada.",
  );
}

export async function updateOptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const priceCents = parseBRLToCents(text(form, "price") || "0");
  if (priceCents === null) return fieldError("priceCents", "preço inválido (use 8,00)");
  return mutate(
    (storeId) =>
      updateOption(storeId, text(form, "optionId"), {
        name: text(form, "name"),
        priceCents,
        available: form.get("available") === "on",
      }),
    "Opção salva.",
  );
}
```

- [ ] **Step 2: Componentes e página de adicionais**

`src/app/painel/cardapio/adicionais/_components/new-option-group-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createOptionGroupAction } from "@/app/painel/cardapio/adicionais/actions";

export function NewOptionGroupForm() {
  const [state, formAction] = useActionState(createOptionGroupAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Novo grupo
        <input name="name" required maxLength={80} placeholder="Ex.: Borda recheada" className={inputClass} />
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm">
        Mínimo
        <input name="minSelect" type="number" min={0} defaultValue={0} required className={inputClass} />
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm">
        Máximo
        <input name="maxSelect" type="number" min={1} defaultValue={1} required className={inputClass} />
      </label>
      <SubmitButton>Criar grupo</SubmitButton>
      <FieldError state={state} name="name" />
      <FieldError state={state} name="minSelect" />
      <FieldError state={state} name="maxSelect" />
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/cardapio/adicionais/_components/option-group-card.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { MenuOption, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { addOptionAction, updateOptionAction, updateOptionGroupAction } from "@/app/painel/cardapio/adicionais/actions";

function OptionRow({ option }: { option: MenuOption }) {
  const [state, formAction] = useActionState(updateOptionAction, idleState);

  return (
    <li>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="optionId" value={option.id} />
        <label className="flex flex-col gap-1 text-sm">
          Opção
          <input name="name" defaultValue={option.name} required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Preço
          <input name="price" inputMode="decimal" defaultValue={formatCentsForInput(option.priceCents)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="available" defaultChecked={option.available} />
          Disponível
        </label>
        <SubmitButton>Salvar opção</SubmitButton>
        <FieldError state={state} name="name" />
        <FieldError state={state} name="priceCents" />
        <FormMessage state={state} />
      </form>
    </li>
  );
}

export function OptionGroupCard({ group }: { group: MenuOptionGroup }) {
  const [groupState, groupAction] = useActionState(updateOptionGroupAction, idleState);
  const [optionState, optionAction] = useActionState(addOptionAction, idleState);

  return (
    <section aria-label={group.name} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{group.name}</h2>

      <form action={groupAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <label className="flex flex-col gap-1 text-sm">
          Nome do grupo
          <input name="name" defaultValue={group.name} required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Mínimo
          <input name="minSelect" type="number" min={0} defaultValue={group.minSelect} required className={inputClass} />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Máximo
          <input name="maxSelect" type="number" min={1} defaultValue={group.maxSelect} required className={inputClass} />
        </label>
        <SubmitButton>Salvar grupo</SubmitButton>
        <FieldError state={groupState} name="name" />
        <FieldError state={groupState} name="minSelect" />
        <FormMessage state={groupState} />
      </form>

      <ul className="flex flex-col gap-3">
        {group.options.map((option) => (
          <OptionRow key={option.id} option={option} />
        ))}
      </ul>

      <form action={optionAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <label className="flex flex-col gap-1 text-sm">
          Nova opção
          <input name="name" required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Preço da nova opção
          <input name="price" inputMode="decimal" placeholder="0,00" className={inputClass} />
        </label>
        <SubmitButton>Adicionar opção</SubmitButton>
        <FieldError state={optionState} name="name" />
        <FieldError state={optionState} name="priceCents" />
        <FormMessage state={optionState} />
      </form>
    </section>
  );
}
```

`src/app/painel/cardapio/adicionais/page.tsx`:

```tsx
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { NewOptionGroupForm } from "./_components/new-option-group-form";
import { OptionGroupCard } from "./_components/option-group-card";

async function OptionGroups() {
  const { store } = await requireStoreAccess();
  const { optionGroups } = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-6">
      <NewOptionGroupForm />
      {optionGroups.length === 0 && (
        <p className="text-neutral-700 dark:text-neutral-300">Nenhum grupo de adicionais ainda.</p>
      )}
      {optionGroups.map((group) => (
        <OptionGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

export default function AdicionaisPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Adicionais</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Grupos como &quot;Borda recheada&quot;. Ligue um grupo a um produto no formulário do produto.
      </p>
      <Suspense fallback={<p>Carregando...</p>}>
        <OptionGroups />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Disponibilidade — actions e página**

`src/app/painel/disponibilidade/actions.ts`:

```ts
"use server";

import { updateTag } from "next/cache";
import { setOptionAvailability, setProductAvailability } from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { requireStoreAccess } from "@/app/painel/_lib/access";

async function toggle(work: (storeId: string) => Promise<void>): Promise<void> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    // Item de outra loja ou removido: nada a fazer; a tela recarrega com o estado real.
    if (isDomainError(error) && error.code === "NOT_FOUND") return;
    throw error;
  }
  updateTag(storeMenuTag(store.slug));
}

export async function toggleProductAvailabilityAction(form: FormData): Promise<void> {
  await toggle((storeId) => setProductAvailability(storeId, String(form.get("productId")), form.get("available") === "true"));
}

export async function toggleOptionAvailabilityAction(form: FormData): Promise<void> {
  await toggle((storeId) => setOptionAvailability(storeId, String(form.get("optionId")), form.get("available") === "true"));
}
```

`src/app/painel/disponibilidade/page.tsx`:

```tsx
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { toggleOptionAvailabilityAction, toggleProductAvailabilityAction } from "./actions";

function ToggleRow({
  name,
  available,
  action,
  idField,
  id,
}: {
  name: string;
  available: boolean;
  action: (form: FormData) => Promise<void>;
  idField: "productId" | "optionId";
  id: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className={available ? "" : "text-neutral-700 line-through dark:text-neutral-300"}>{name}</span>
      <form action={action}>
        <input type="hidden" name={idField} value={id} />
        <input type="hidden" name="available" value={available ? "false" : "true"} />
        <button
          type="submit"
          aria-label={available ? `Marcar ${name} como esgotado` : `Marcar ${name} como disponível`}
          className={
            available
              ? "min-w-40 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white"
              : "min-w-40 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          }
        >
          {available ? "Marcar esgotado" : "Marcar disponível"}
        </button>
      </form>
    </li>
  );
}

async function AvailabilityLists() {
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-8">
      {catalog.categories
        .filter((category) => category.active)
        .map((category) => (
          <section key={category.id} aria-label={category.name}>
            <h2 className="mb-2 text-lg font-semibold">{category.name}</h2>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {category.products
                .filter((product) => product.active)
                .map((product) => (
                  <ToggleRow
                    key={product.id}
                    name={product.name}
                    available={product.available}
                    action={toggleProductAvailabilityAction}
                    idField="productId"
                    id={product.id}
                  />
                ))}
            </ul>
          </section>
        ))}
      {catalog.optionGroups.map((group) => (
        <section key={group.id} aria-label={group.name}>
          <h2 className="mb-2 text-lg font-semibold">{group.name}</h2>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {group.options.map((option) => (
              <ToggleRow
                key={option.id}
                name={option.name}
                available={option.available}
                action={toggleOptionAvailabilityAction}
                idField="optionId"
                id={option.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function DisponibilidadePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Disponibilidade</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">Acabou algum item? Marque aqui e o cardápio atualiza na hora.</p>
      <Suspense fallback={<p>Carregando...</p>}>
        <AvailabilityLists />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sem erros; rotas `/painel/cardapio/adicionais` e `/painel/disponibilidade` no build.

```bash
git add -A
git commit -m "feat: add panel screens for option groups and item availability"
```

---

### Task 8: Configurações da loja (serviços) — perfil, status manual, operação, bairros, turnos sem sobreposição

**Files:**
- Modify: `src/modules/stores/hours.ts`, `src/modules/stores/hours.test.ts` (`findHourConflict`)
- Modify: `src/modules/stores/settings.ts` (horários sem sobreposição; schemas de edição)
- Modify: `src/modules/stores/schema.ts` (`delivery_zones`)
- Create: `src/modules/stores/settings-service.ts`, `src/modules/stores/settings-service.int.test.ts`
- Modify: `src/modules/stores/index.ts`
- Create: migration em `drizzle/` (gerada)

**Interfaces:**
- Consumes: `stores`, `storeHours`, `storeThemeSchema`, `storeFeaturesSchema`, `storeRulesSchema`, `storePaymentMethodsSchema`, `createStoreInputSchema` (`./settings`); `imageUrlSchema`, `zodIssuesToDomainError`; `DomainError`.
- Produces (via `@/modules/stores`):
  - `findHourConflict(hours: StoreHour[]): [number, number] | null` — índices do primeiro par de turnos sobrepostos (considera virada da meia-noite e de sábado para domingo; turnos que só se encostam não conflitam).
  - `storeHoursInputSchema` passa a recusar sobreposição (issue `"há turnos sobrepostos"` no índice do segundo turno).
  - `type StoreProfileInput = { name: string; address: string | null; whatsappPhone: string; theme: { primary: string; secondary: string }; logoUrl: string | null; bannerUrl: string | null }`; `updateStoreProfile(storeId, input): Promise<void>`.
  - `setManualStatus(storeId, status: ManualStatus): Promise<void>`.
  - `type StoreOperationsInput = { features: StoreFeaturesInput; rules: StoreRulesInput; paymentMethods: StorePaymentMethodsInput }` (tipos `z.input` dos schemas); `updateStoreOperations(storeId, input): Promise<void>` — exige ao menos um entre delivery/retirada/consumo no local (`path: "features"`).
  - Tabela `deliveryZones` (`delivery_zones`: id uuid, store_id FK cascade + índice, neighborhood text, fee_cents int ≥ 0, position int; único por `(store_id, lower(neighborhood))`).
  - `type DeliveryZone = { id: string; neighborhood: string; feeCents: number }`; `type DeliveryZoneInput = { neighborhood: string; feeCents: number }`; `replaceDeliveryZones(storeId, zones: DeliveryZoneInput[]): Promise<void>` (bairro repetido ignorando maiúsculas → `VALIDATION` em `zones.<i>.neighborhood`); `getDeliveryZones(storeId): Promise<DeliveryZone[]>` (ordem de cadastro).
  - Loja inexistente em qualquer update → `NOT_FOUND`.

- [ ] **Step 1: Teste que falha — `findHourConflict`**

Acrescentar em `src/modules/stores/hours.test.ts` (importar `findHourConflict`):

```ts
describe("findHourConflict", () => {
  const shift = (weekday: number, opensAt: string, closesAt: string): StoreHour => ({ weekday, opensAt, closesAt });

  it.each([
    ["mesmo dia sobreposto", [shift(2, "18:00", "23:00"), shift(2, "22:00", "23:30")]],
    ["turno duplicado", [shift(1, "18:00", "23:00"), shift(1, "18:00", "23:00")]],
    ["madrugada de sexta para sábado", [shift(5, "18:00", "02:00"), shift(6, "01:00", "03:00")]],
    ["sábado para domingo (virada da semana)", [shift(6, "23:00", "02:00"), shift(0, "01:00", "03:00")]],
  ])("conflito: %s", (_label, hours) => {
    expect(findHourConflict(hours)).toEqual([0, 1]);
  });

  it.each([
    ["turnos que só se encostam", [shift(6, "18:00", "00:30"), shift(0, "00:30", "02:00")]],
    ["almoço e jantar", [shift(2, "11:00", "14:00"), shift(2, "18:00", "23:00")]],
    ["dias diferentes", [shift(1, "18:00", "23:00"), shift(3, "18:00", "23:00")]],
    ["vazio", []],
  ])("sem conflito: %s", (_label, hours) => {
    expect(findHourConflict(hours)).toBeNull();
  });
});
```

Run: `npm test -- src/modules/stores/hours.test.ts`
Expected: FAIL — `findHourConflict` não exportado.

- [ ] **Step 2: Implementar em `src/modules/stores/hours.ts`**

```ts
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

function shiftInterval(shift: StoreHour): [number, number] {
  const opens = toMinutes(shift.opensAt);
  const closes = toMinutes(shift.closesAt);
  const duration = closes > opens ? closes - opens : MINUTES_PER_DAY - opens + closes;
  const start = shift.weekday * MINUTES_PER_DAY + opens;
  return [start, start + duration];
}

/** Primeiro par de turnos que se sobrepõe na semana (circular), ou null. */
export function findHourConflict(hours: StoreHour[]): [number, number] | null {
  const intervals = hours.map(shiftInterval);
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const [startA, endA] = intervals[i]!;
      const [startB, endB] = intervals[j]!;
      for (const offset of [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]) {
        if (startA < endB + offset && startB + offset < endA) return [i, j];
      }
    }
  }
  return null;
}
```

Exportar em `src/modules/stores/index.ts` junto de `getOpenStatus`. Em `src/modules/stores/settings.ts`, importar `findHourConflict` de `./hours` e trocar `storeHoursInputSchema` por:

```ts
export const storeHoursInputSchema = z
  .array(storeHourInputSchema)
  .max(21)
  .superRefine((hours, ctx) => {
    const conflict = findHourConflict(hours);
    if (conflict) ctx.addIssue({ code: "custom", message: "há turnos sobrepostos", path: [conflict[1]] });
  });
```

Run: `npm test -- src/modules/stores/hours.test.ts`
Expected: PASS.

- [ ] **Step 3: Tabela `delivery_zones`**

Em `src/modules/stores/schema.ts` (acrescentar `uniqueIndex` ao import):

```ts
export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    neighborhood: text("neighborhood").notNull(),
    feeCents: integer("fee_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("delivery_zones_store_id_idx").on(t.storeId),
    uniqueIndex("delivery_zones_store_neighborhood_idx").on(t.storeId, sql`lower(${t.neighborhood})`),
    check("delivery_zones_fee_cents_check", sql`${t.feeCents} >= 0`),
  ],
);
```

Run: `npm run db:generate`
Expected: nova migration com `CREATE TABLE "delivery_zones"` e o índice único em `lower("neighborhood")`.

- [ ] **Step 4: Teste de integração que falha — `src/modules/stores/settings-service.int.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/shared/db/client";
import { createStore, deleteStoreBySlug, getStoreById, replaceStoreHours } from "./service";
import {
  getDeliveryZones,
  replaceDeliveryZones,
  setManualStatus,
  updateStoreOperations,
  updateStoreProfile,
  type StoreProfileInput,
} from "./settings-service";

const missingStore = "00000000-0000-4000-8000-000000000000";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

const profile: StoreProfileInput = {
  name: "Pizzaria Nova",
  address: "Rua A, 1",
  whatsappPhone: "+5511977776666",
  theme: { primary: "#1d4ed8", secondary: "#facc15" },
  logoUrl: "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp",
  bannerUrl: null,
};

describe("store settings service", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("atualiza perfil e aparência", async () => {
    const storeId = await newStore("loja-a");
    await updateStoreProfile(storeId, profile);

    const store = await getStoreById(storeId);
    expect(store).toMatchObject({
      name: "Pizzaria Nova",
      address: "Rua A, 1",
      whatsappPhone: "+5511977776666",
      logoUrl: profile.logoUrl,
      bannerUrl: null,
      theme: { primary: "#1d4ed8", secondary: "#facc15" },
    });
  });

  it.each([
    ["cor inválida", { theme: { primary: "red", secondary: "#facc15" } }],
    ["logo http", { logoUrl: "http://x.com/a.png" }],
    ["telefone inválido", { whatsappPhone: "1199" }],
    ["nome vazio", { name: " " }],
  ])("recusa perfil com %s", async (_label, overrides) => {
    const storeId = await newStore("loja-a");
    await expect(updateStoreProfile(storeId, { ...profile, ...overrides })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("status manual", async () => {
    const storeId = await newStore("loja-a");
    await setManualStatus(storeId, "force_closed");
    expect((await getStoreById(storeId))?.manualStatus).toBe("force_closed");
  });

  it("operação: tipos de pedido, regras e pagamento", async () => {
    const storeId = await newStore("loja-a");
    await updateStoreOperations(storeId, {
      features: { delivery: false, pickup: true, dineIn: true, halfAndHalf: false, addons: true },
      rules: { minOrderCents: 2500, prepTimeMin: 20, deliveryTimeMin: 40, halfPriceRule: "average", deliveryFee: { strategy: "by_neighborhood" } },
      paymentMethods: { cash: true, cardOnDelivery: false, pixKey: "pix@loja.com" },
    });

    const store = await getStoreById(storeId);
    expect(store?.features).toMatchObject({ delivery: false, pickup: true, dineIn: true, halfAndHalf: false });
    expect(store?.rules).toMatchObject({ minOrderCents: 2500, halfPriceRule: "average", deliveryFee: { strategy: "by_neighborhood" } });
    expect(store?.paymentMethods).toEqual({ cash: true, cardOnDelivery: false, pixKey: "pix@loja.com" });
  });

  it("operação exige ao menos um tipo de pedido", async () => {
    const storeId = await newStore("loja-a");
    await expect(
      updateStoreOperations(storeId, {
        features: { delivery: false, pickup: false, dineIn: false },
        rules: {},
        paymentMethods: {},
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "features" }] } });
  });

  it("bairros: substitui, ordena e recusa repetidos", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    await replaceDeliveryZones(storeB, [{ neighborhood: "Centro", feeCents: 300 }]);

    await replaceDeliveryZones(storeA, [
      { neighborhood: "Vila Nova", feeCents: 800 },
      { neighborhood: "Centro", feeCents: 500 },
    ]);
    await replaceDeliveryZones(storeA, [
      { neighborhood: "Vila Nova", feeCents: 900 },
      { neighborhood: "Centro", feeCents: 500 },
    ]);

    expect((await getDeliveryZones(storeA)).map((z) => [z.neighborhood, z.feeCents])).toEqual([
      ["Vila Nova", 900],
      ["Centro", 500],
    ]);
    expect((await getDeliveryZones(storeB)).map((z) => z.neighborhood)).toEqual(["Centro"]);

    await expect(
      replaceDeliveryZones(storeA, [
        { neighborhood: "Centro", feeCents: 500 },
        { neighborhood: "centro ", feeCents: 600 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "zones.1.neighborhood" }] } });
  });

  it("horários sobrepostos são recusados", async () => {
    const storeId = await newStore("loja-a");
    await expect(
      replaceStoreHours(storeId, [
        { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
        { weekday: 2, opensAt: "22:00", closesAt: "23:30" },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ message: "há turnos sobrepostos" }] } });
  });

  it("loja inexistente → NOT_FOUND", async () => {
    await expect(setManualStatus(missingStore, "auto")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateStoreProfile(missingStore, profile)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

Run: `npm run test:int -- src/modules/stores/settings-service.int.test.ts`
Expected: FAIL — `Failed to resolve import "./settings-service"`.

- [ ] **Step 5: Implementar `src/modules/stores/settings-service.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { deliveryZones, stores } from "./schema";
import {
  createStoreInputSchema,
  storeFeaturesSchema,
  storePaymentMethodsSchema,
  storeRulesSchema,
  storeThemeSchema,
} from "./settings";
import type { ManualStatus } from "./types";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  return parsed.data;
}

const storeProfileInputSchema = createStoreInputSchema
  .pick({ name: true, address: true, whatsappPhone: true, logoUrl: true, bannerUrl: true })
  .extend({ theme: storeThemeSchema.pick({ primary: true, secondary: true }) });

export type StoreProfileInput = z.input<typeof storeProfileInputSchema>;

const storeOperationsInputSchema = z
  .object({ features: storeFeaturesSchema, rules: storeRulesSchema, paymentMethods: storePaymentMethodsSchema })
  .refine((ops) => ops.features.delivery || ops.features.pickup || ops.features.dineIn, {
    message: "ative ao menos um tipo de pedido",
    path: ["features"],
  });

export type StoreOperationsInput = z.input<typeof storeOperationsInputSchema>;

const deliveryZonesInputSchema = z
  .array(
    z.object({
      neighborhood: z.string().trim().min(1, "informe o bairro").max(80),
      feeCents: z.number().int().nonnegative("taxa inválida"),
    }),
  )
  .max(200)
  .superRefine((zones, ctx) => {
    const seen = new Set<string>();
    zones.forEach((zone, index) => {
      const key = zone.neighborhood.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: "bairro repetido", path: [index, "neighborhood"] });
      seen.add(key);
    });
  });

export type DeliveryZoneInput = z.input<typeof deliveryZonesInputSchema>[number];
export type DeliveryZone = { id: string; neighborhood: string; feeCents: number };

async function updateStore(storeId: string, values: Partial<typeof stores.$inferInsert>): Promise<void> {
  const updated = await db
    .update(stores)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(stores.id, storeId))
    .returning({ id: stores.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND");
}

export async function updateStoreProfile(storeId: string, input: StoreProfileInput): Promise<void> {
  const { theme, ...profile } = parse(storeProfileInputSchema, input);
  const [current] = await db.select({ theme: stores.theme }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!current) throw new DomainError("NOT_FOUND");
  await updateStore(storeId, { ...profile, theme: storeThemeSchema.parse({ ...current.theme, ...theme }) });
}

export async function setManualStatus(storeId: string, status: ManualStatus): Promise<void> {
  const manualStatus = parse(z.enum(["auto", "force_open", "force_closed"]), status);
  await updateStore(storeId, { manualStatus });
}

export async function updateStoreOperations(storeId: string, input: StoreOperationsInput): Promise<void> {
  const operations = parse(storeOperationsInputSchema, input);
  await updateStore(storeId, operations);
}

export async function replaceDeliveryZones(storeId: string, zones: DeliveryZoneInput[]): Promise<void> {
  const parsed = deliveryZonesInputSchema.safeParse(zones);
  if (!parsed.success) {
    const error = zodIssuesToDomainError(parsed.error);
    // Prefixa o caminho com "zones." para casar com os campos do formulário.
    const issues = (error.details.issues as { path: string; message: string }[]).map((issue) => ({
      ...issue,
      path: issue.path ? `zones.${issue.path}` : "zones",
    }));
    throw new DomainError("VALIDATION", { issues });
  }

  await db.transaction(async (tx) => {
    const [store] = await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) throw new DomainError("NOT_FOUND");
    await tx.delete(deliveryZones).where(eq(deliveryZones.storeId, storeId));
    if (parsed.data.length > 0) {
      await tx.insert(deliveryZones).values(parsed.data.map((zone, position) => ({ storeId, ...zone, position })));
    }
  });
}

export async function getDeliveryZones(storeId: string): Promise<DeliveryZone[]> {
  return db
    .select({ id: deliveryZones.id, neighborhood: deliveryZones.neighborhood, feeCents: deliveryZones.feeCents })
    .from(deliveryZones)
    .where(eq(deliveryZones.storeId, storeId))
    .orderBy(asc(deliveryZones.position));
}
```

Em `src/modules/stores/index.ts`, acrescentar:

```ts
export {
  getDeliveryZones,
  replaceDeliveryZones,
  setManualStatus,
  updateStoreOperations,
  updateStoreProfile,
  type DeliveryZone,
  type DeliveryZoneInput,
  type StoreOperationsInput,
  type StoreProfileInput,
} from "./settings-service";
export { findHourConflict } from "./hours";
```

(Se `findHourConflict` já foi exportado no Step 2, não duplicar.)

- [ ] **Step 6: Rodar e commitar**

Run: `npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS. O seed demo continua válido (seus turnos não se sobrepõem).

```bash
git add -A
git commit -m "feat: add store settings services, delivery zones and shift overlap checks"
```

---

### Task 9: Upload de imagens — módulo `media`, rota `/uploads/<arquivo>`, campo de upload

**Files:**
- Create: `src/modules/media/images.ts`, `src/modules/media/images.test.ts`, `src/modules/media/index.ts`
- Create: `src/app/uploads/[file]/route.ts`, `src/app/painel/upload-action.ts`, `src/app/_components/image-upload-field.tsx`
- Modify: `src/app/painel/cardapio/_components/product-form.tsx` (campo "Foto do produto"), `next.config.ts`, `.gitignore`

**Interfaces:**
- Consumes: `DomainError`; `requireStoreAccess`.
- Produces:
  - `@/modules/media`: `MAX_IMAGE_BYTES = 5 * 1024 * 1024`; `detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null`; `saveImage(bytes: Uint8Array): Promise<{ url: string }>` (grava em `process.env.UPLOAD_DIR ?? <cwd>/.data/uploads`, nome `<uuid>.<ext>`, URL `/uploads/<nome>`; tamanho/tipo inválido → `VALIDATION` em `path: "image"`); `readImage(fileName: string): Promise<{ bytes: Uint8Array; contentType: string } | null>` (nome fora do padrão `<uuid>.<jpg|png|webp>` → `null`).
  - `GET /uploads/<arquivo>` → imagem com `Content-Type` correto, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`; 404 caso contrário.
  - `uploadImageAction(form: FormData): Promise<{ url: string } | { error: string }>` (exige `requireStoreAccess`).
  - `ImageUploadField({ name, label, defaultUrl })` (client): input de arquivo com rótulo `label`, redimensiona no navegador (máx. 1200 px, WebP 0,85), envia, guarda a URL num `<input type="hidden" name={name}>`, mostra prévia `alt="Prévia: <label>"` e botão "Remover imagem".
  - Driver de armazenamento local apenas (deliberado: Vercel Blob entra na F6 junto com o deploy).

- [ ] **Step 1: Testes que falham — `src/modules/media/images.test.ts`**

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectImageType, MAX_IMAGE_BYTES, readImage, saveImage } from "./images";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);
const TEXT = new TextEncoder().encode("isto não é uma imagem");

describe("detectImageType", () => {
  it.each([
    [PNG, "png"],
    [JPG, "jpg"],
    [WEBP, "webp"],
    [TEXT, null],
    [new Uint8Array([0xff]), null],
  ])("detecta pelos bytes", (bytes, type) => {
    expect(detectImageType(bytes)).toBe(type);
  });
});

describe("saveImage / readImage", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "naquela-uploads-"));
    process.env.UPLOAD_DIR = dir;
  });

  afterAll(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("grava e lê de volta com content-type", async () => {
    const { url } = await saveImage(PNG);
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);

    const image = await readImage(url.replace("/uploads/", ""));
    expect(image?.contentType).toBe("image/png");
    expect(Array.from(image!.bytes)).toEqual(Array.from(PNG));
  });

  it("recusa texto disfarçado e arquivo grande demais", async () => {
    await expect(saveImage(TEXT)).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "image" }] } });
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(JPG);
    await expect(saveImage(huge)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["../.env", "..%2F.env", "3f2504e0-4f89-41d3-9a0c-0305e82c3301.svg", "logo.png"])("readImage recusa %s", async (name) => {
    expect(await readImage(name)).toBeNull();
  });

  it("readImage de arquivo inexistente devolve null", async () => {
    expect(await readImage("3f2504e0-4f89-41d3-9a0c-0305e82c3301.png")).toBeNull();
  });
});
```

Run: `npm test -- src/modules/media/images.test.ts`
Expected: FAIL — `Failed to resolve import "./images"`.

- [ ] **Step 2: Implementar `src/modules/media/images.ts` e `index.ts`**

```ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/shared/errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageType = "jpg" | "png" | "webp";

const CONTENT_TYPES: Record<ImageType, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** Tipo real pelo cabeçalho do arquivo (extensão e content-type do navegador não são confiáveis). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");
}

function invalidImage(message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path: "image", message }] });
}

export async function saveImage(bytes: Uint8Array): Promise<{ url: string }> {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw invalidImage("a imagem deve ter até 5 MB");
  const type = detectImageType(bytes);
  if (!type) throw invalidImage("envie uma imagem JPG, PNG ou WebP");

  const fileName = `${randomUUID()}.${type}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), fileName), bytes);
  return { url: `/uploads/${fileName}` };
}

export async function readImage(fileName: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const match = FILE_NAME.exec(fileName);
  if (!match) return null;
  try {
    const bytes = await readFile(path.join(uploadDir(), fileName));
    return { bytes: new Uint8Array(bytes), contentType: CONTENT_TYPES[match[1] as ImageType] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
```

`src/modules/media/index.ts`:

```ts
export { detectImageType, MAX_IMAGE_BYTES, readImage, saveImage } from "./images";
```

Run: `npm test -- src/modules/media/images.test.ts`
Expected: PASS.

- [ ] **Step 3: Rota, action e configuração**

`src/app/uploads/[file]/route.ts`:

```ts
import { readImage } from "@/modules/media";

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[file]">) {
  const { file } = await params;
  const image = await readImage(file);
  if (!image) return new Response("Não encontrado", { status: 404 });

  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

`src/app/painel/upload-action.ts`:

```ts
"use server";

import { saveImage } from "@/modules/media";
import { isDomainError } from "@/shared/errors";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export type UploadResult = { url: string } | { error: string };

export async function uploadImageAction(form: FormData): Promise<UploadResult> {
  await requireStoreAccess();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma imagem." };

  try {
    return await saveImage(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (isDomainError(error) && error.code === "VALIDATION") {
      const [issue] = error.details.issues as { message: string }[];
      return { error: issue?.message ?? "Imagem inválida." };
    }
    throw error;
  }
}
```

`next.config.ts`: aumentar o limite do corpo de Server Actions para 6 MB (o padrão é 1 MB). Conferir a chave exata em `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` (no Next 15 era `experimental: { serverActions: { bodySizeLimit: "6mb" } }`).

`.gitignore`: acrescentar `/.data/`.

- [ ] **Step 4: Campo de upload — `src/app/_components/image-upload-field.tsx`**

```tsx
"use client";

import Image from "next/image";
import { type ChangeEvent, useState, useTransition } from "react";
import { uploadImageAction } from "@/app/painel/upload-action";

const MAX_SIDE = 1200;

/** Reduz para no máx. 1200 px e WebP antes de enviar; se o navegador não conseguir, envia o original. */
async function resizeForUpload(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function ImageUploadField({ name, label, defaultUrl }: { name: string; label: string; defaultUrl: string | null }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("file", await resizeForUpload(file), "imagem");
      const result = await uploadImageAction(form);
      if ("error" in result) setError(result.error);
      else setUrl(result.url);
    });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={pending} />
      </label>
      <input type="hidden" name={name} value={url} />
      {pending && <p>Enviando imagem...</p>}
      {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
      {url && (
        <div className="flex items-center gap-3">
          <Image src={url} alt={`Prévia: ${label}`} width={80} height={80} unoptimized className="size-20 rounded object-cover" />
          <button type="button" onClick={() => setUrl("")} className="underline">
            Remover imagem
          </button>
        </div>
      )}
    </div>
  );
}
```

Em `src/app/painel/cardapio/_components/product-form.tsx`: remover `<input type="hidden" name="imageUrl" ... />` e, logo depois do campo "Descrição", inserir:

```tsx
      <ImageUploadField name="imageUrl" label="Foto do produto" defaultUrl={product?.imageUrl ?? null} />
      <FieldError state={state} name="imageUrl" />
```

(com `import { ImageUploadField } from "@/app/_components/image-upload-field";`).

- [ ] **Step 5: Verificar rota com curl**

```bash
npm run build && (npm run start >/tmp/naquela-start.log 2>&1 &) && sleep 5
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/uploads/..%2F.env"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png"
pkill -f "next start"
```

Expected: `404` e `404`. (Upload pela tela é coberto pelo E2E da Task 11.)

- [ ] **Step 6: Rodar e commitar**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add validated local image uploads served from /uploads"
```

---

### Task 10: Painel — configurações da loja (aparência, funcionamento, operação, bairros)

**Files:**
- Create: `src/app/painel/loja/actions.ts`, `src/app/painel/loja/page.tsx`
- Create: `src/app/painel/loja/_components/profile-form.tsx`, `status-buttons.tsx`, `hours-editor.tsx`, `operations-form.tsx`, `zones-editor.tsx`
- Create: `src/modules/stores/client.ts` (API pública de navegador)

**Interfaces:**
- Consumes: `updateStoreProfile`, `setManualStatus`, `replaceStoreHours`, `updateStoreOperations`, `replaceDeliveryZones`, `getDeliveryZones`, `storeMenuTag`, tipos `Store`, `StoreHour`, `DeliveryZone`, `ManualStatus` (`@/modules/stores`); `parseBRLToCents`, `formatCentsForInput`; `ImageUploadField` (Task 9); form controls e action-state (Task 3); `requireStoreAccess`.
- Produces:
  - Actions `(prev, form) => Promise<ActionState>`: `saveProfileAction`, `saveHoursAction` (lê JSON do campo oculto `hours`), `saveOperationsAction`, `saveZonesAction` (lê JSON do campo oculto `zones`); e `setManualStatusAction(form) => Promise<void>`. Todas com `requireStoreAccess()` + `updateTag(storeMenuTag(store.slug))`.
  - Página "Configurações da loja" com seções (cada uma `<section aria-label=...>`): "Aparência", "Funcionamento", "Entrega, retirada e pagamento", "Bairros atendidos".
  - Rótulos para o E2E, exatamente: "Nome da loja", "Endereço", "WhatsApp", "Cor principal", "Cor secundária", upload "Logo" e "Banner", botão "Salvar aparência" (mensagem "Aparência salva."); botões de status "Automático", "Abrir agora", "Fechar agora" (o atual com `aria-pressed="true"`); editor de turnos com botões "Adicionar turno", "Remover turno <n>", campos "Dia do turno <n>", "Abre turno <n>", "Fecha turno <n>", botão "Salvar horários" (mensagem "Horários salvos."); caixas "Delivery", "Retirada no balcão", "Consumo no local", "Meio a meio", "Adicionais"; "Pedido mínimo", "Tempo de preparo (min)", "Tempo de entrega (min)", seletor "Preço do meio a meio" (opções "Sabor mais caro"/"Média dos sabores"), rádios "Taxa fixa"/"Taxa por bairro", "Valor da taxa fixa", caixas "Dinheiro", "Cartão na entrega", campo "Chave Pix", botão "Salvar operação" (mensagem "Operação salva."); editor de bairros com "Bairro <n>", "Taxa <n>", "Adicionar bairro", "Remover bairro <n>", botão "Salvar bairros" (mensagem "Bairros salvos.").
  - Erros de validação de listas (turnos, bairros) aparecem como lista de mensagens abaixo do editor.
  - `@/modules/stores/client` (novo, só funções puras): `export { readableTextColor } from "./theme";`.
  - Aparência com prévia ao vivo (`data-testid="theme-preview"`: fundo = cor principal com texto legível, pílula na cor secundária). Sem "alerta de contraste": como o texto é sempre preto ou branco (o de maior contraste), o contraste mínimo possível é ~4,58:1 (≥ 4,5 da WCAG AA) — a prévia cumpre o objetivo da spec §7.

- [ ] **Step 1: API de navegador do módulo `stores`**

`src/modules/stores/client.ts`:

```ts
// API de navegador: só funções puras (nada de banco).
export { readableTextColor } from "./theme";
```

- [ ] **Step 1b: Actions — `src/app/painel/loja/actions.ts`**

```ts
"use server";

import { updateTag } from "next/cache";
import {
  replaceDeliveryZones,
  replaceStoreHours,
  setManualStatus,
  storeMenuTag,
  updateStoreOperations,
  updateStoreProfile,
  type ManualStatus,
} from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function checked(form: FormData, key: string): boolean {
  return form.get(key) === "on";
}

function minutes(form: FormData, key: string): number {
  return Number.parseInt(text(form, key), 10);
}

function readJson(form: FormData, key: string): unknown {
  try {
    return JSON.parse(text(form, key) || "[]");
  } catch {
    return null;
  }
}

async function mutate(work: (storeId: string) => Promise<unknown>, message: string): Promise<ActionState> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    return actionError(error);
  }
  updateTag(storeMenuTag(store.slug));
  return success(message);
}

export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) =>
      updateStoreProfile(storeId, {
        name: text(form, "name"),
        address: text(form, "address") || null,
        whatsappPhone: text(form, "whatsappPhone"),
        theme: { primary: text(form, "primary"), secondary: text(form, "secondary") },
        logoUrl: text(form, "logoUrl") || null,
        bannerUrl: text(form, "bannerUrl") || null,
      }),
    "Aparência salva.",
  );
}

const MANUAL_STATUSES: ManualStatus[] = ["auto", "force_open", "force_closed"];

export async function setManualStatusAction(form: FormData): Promise<void> {
  const status = MANUAL_STATUSES.find((value) => value === form.get("status"));
  if (!status) return;
  await mutate((storeId) => setManualStatus(storeId, status), "");
}

export async function saveHoursAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const hours = readJson(form, "hours");
  if (!Array.isArray(hours)) return fieldError("hours", "horários inválidos");
  return mutate((storeId) => replaceStoreHours(storeId, hours), "Horários salvos.");
}

export async function saveOperationsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const minOrderCents = parseBRLToCents(text(form, "minOrder") || "0");
  if (minOrderCents === null) return fieldError("rules.minOrderCents", "valor inválido (use 30,00)");

  const strategy = form.get("deliveryFeeStrategy") === "by_neighborhood" ? "by_neighborhood" : "fixed";
  let deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" } = { strategy: "by_neighborhood" };
  if (strategy === "fixed") {
    const fixedCents = parseBRLToCents(text(form, "fixedFee") || "0");
    if (fixedCents === null) return fieldError("rules.deliveryFee.fixedCents", "valor inválido (use 6,00)");
    deliveryFee = { strategy: "fixed", fixedCents };
  }

  const { store } = await requireStoreAccess();
  return mutate(
    (storeId) =>
      updateStoreOperations(storeId, {
        features: {
          delivery: checked(form, "delivery"),
          pickup: checked(form, "pickup"),
          dineIn: checked(form, "dineIn"),
          halfAndHalf: checked(form, "halfAndHalf"),
          addons: checked(form, "addons"),
        },
        rules: {
          minOrderCents,
          prepTimeMin: minutes(form, "prepTimeMin"),
          deliveryTimeMin: minutes(form, "deliveryTimeMin"),
          halfPriceRule: form.get("halfPriceRule") === "average" ? "average" : "highest",
          autoPrintOnAccept: store.rules.autoPrintOnAccept,
          deliveryFee,
        },
        paymentMethods: {
          cash: checked(form, "cash"),
          cardOnDelivery: checked(form, "cardOnDelivery"),
          pixKey: text(form, "pixKey") || null,
        },
      }),
    "Operação salva.",
  );
}

export async function saveZonesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const rows = readJson(form, "zones");
  if (!Array.isArray(rows)) return fieldError("zones", "bairros inválidos");

  const zones: { neighborhood: string; feeCents: number }[] = [];
  for (const [index, row] of rows.entries()) {
    const fee = parseBRLToCents(String((row as { fee?: unknown }).fee ?? ""));
    if (fee === null) return fieldError(`zones.${index}.feeCents`, `taxa inválida no bairro ${index + 1} (use 5,00)`);
    zones.push({ neighborhood: String((row as { neighborhood?: unknown }).neighborhood ?? ""), feeCents: fee });
  }
  return mutate((storeId) => replaceDeliveryZones(storeId, zones), "Bairros salvos.");
}
```

- [ ] **Step 2: Componentes**

`src/app/painel/loja/_components/profile-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { Store } from "@/modules/stores";
import { readableTextColor } from "@/modules/stores/client";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { ImageUploadField } from "@/app/_components/image-upload-field";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveProfileAction } from "@/app/painel/loja/actions";

type Props = Pick<Store, "name" | "address" | "whatsappPhone" | "logoUrl" | "bannerUrl"> & { primary: string; secondary: string };

export function ProfileForm(props: Props) {
  const [state, formAction] = useActionState(saveProfileAction, idleState);
  const [primary, setPrimary] = useState(props.primary);
  const [secondary, setSecondary] = useState(props.secondary);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nome da loja
        <input name="name" defaultValue={props.name} required maxLength={120} className={inputClass} />
      </label>
      <FieldError state={state} name="name" />
      <label className="flex flex-col gap-1 text-sm">
        Endereço
        <input name="address" defaultValue={props.address ?? ""} maxLength={300} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        WhatsApp
        <input name="whatsappPhone" defaultValue={props.whatsappPhone} placeholder="+5511999999999" required className={inputClass} />
      </label>
      <FieldError state={state} name="whatsappPhone" />
      <div className="flex gap-6">
        <label className="flex flex-col gap-1 text-sm">
          Cor principal
          <input type="color" name="primary" value={primary} onChange={(event) => setPrimary(event.target.value)} className="h-10 w-20" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cor secundária
          <input type="color" name="secondary" value={secondary} onChange={(event) => setSecondary(event.target.value)} className="h-10 w-20" />
        </label>
      </div>
      <div
        data-testid="theme-preview"
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ backgroundColor: primary, color: readableTextColor(primary) }}
      >
        <span className="font-semibold">{props.name}</span>
        <span className="rounded-full px-3 py-1 text-sm" style={{ backgroundColor: secondary, color: readableTextColor(secondary) }}>
          Pizzas
        </span>
      </div>
      <FieldError state={state} name="theme.primary" />
      <FieldError state={state} name="theme.secondary" />
      <ImageUploadField name="logoUrl" label="Logo" defaultUrl={props.logoUrl} />
      <FieldError state={state} name="logoUrl" />
      <ImageUploadField name="bannerUrl" label="Banner" defaultUrl={props.bannerUrl} />
      <FieldError state={state} name="bannerUrl" />
      <SubmitButton>Salvar aparência</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/loja/_components/status-buttons.tsx`:

```tsx
import type { ManualStatus } from "@/modules/stores";
import { setManualStatusAction } from "@/app/painel/loja/actions";

const OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "force_open", label: "Abrir agora" },
  { value: "force_closed", label: "Fechar agora" },
];

export function StatusButtons({ current }: { current: ManualStatus }) {
  return (
    <form action={setManualStatusAction} className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="status"
          value={option.value}
          aria-pressed={current === option.value}
          className={
            current === option.value
              ? "rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
          }
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}
```

`src/app/painel/loja/_components/hours-editor.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { StoreHour } from "@/modules/stores";
import { FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveHoursAction } from "@/app/painel/loja/actions";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Row = StoreHour & { key: string };

export function HoursEditor({ initialHours }: { initialHours: StoreHour[] }) {
  const [rows, setRows] = useState<Row[]>(() => initialHours.map((hour) => ({ ...hour, key: crypto.randomUUID() })));
  const [state, formAction] = useActionState(saveHoursAction, idleState);

  function update(key: string, patch: Partial<StoreHour>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const payload = rows.map((row) => ({ weekday: row.weekday, opensAt: row.opensAt, closesAt: row.closesAt }));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Se o horário de fechar for menor que o de abrir, o turno vira a meia-noite (ex.: 18:00 às 00:30).
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="sr-only">Dia do turno {index + 1}</span>
              <select
                aria-label={`Dia do turno ${index + 1}`}
                value={row.weekday}
                onChange={(event) => update(row.key, { weekday: Number(event.target.value) })}
                className={inputClass}
              >
                {WEEKDAYS.map((day, weekday) => (
                  <option key={day} value={weekday}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="time"
              aria-label={`Abre turno ${index + 1}`}
              value={row.opensAt}
              onChange={(event) => update(row.key, { opensAt: event.target.value })}
              className={inputClass}
            />
            <input
              type="time"
              aria-label={`Fecha turno ${index + 1}`}
              value={row.closesAt}
              onChange={(event) => update(row.key, { closesAt: event.target.value })}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              className={secondaryButtonClass}
            >
              Remover turno {index + 1}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), weekday: 1, opensAt: "18:00", closesAt: "23:00" }])}
          className={secondaryButtonClass}
        >
          Adicionar turno
        </button>
        <SubmitButton>Salvar horários</SubmitButton>
      </div>
      {state.status === "error" && (
        <ul className="text-sm text-red-700 dark:text-red-400">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/loja/_components/operations-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { Store } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveOperationsAction } from "@/app/painel/loja/actions";

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function OperationsForm({ features, rules, paymentMethods }: Pick<Store, "features" | "rules" | "paymentMethods">) {
  const [state, formAction] = useActionState(saveOperationsAction, idleState);
  const fixedCents = rules.deliveryFee.strategy === "fixed" ? rules.deliveryFee.fixedCents : 0;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipos de pedido</legend>
        <Check name="delivery" label="Delivery" defaultChecked={features.delivery} />
        <Check name="pickup" label="Retirada no balcão" defaultChecked={features.pickup} />
        <Check name="dineIn" label="Consumo no local" defaultChecked={features.dineIn} />
        <FieldError state={state} name="features" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Cardápio</legend>
        <Check name="halfAndHalf" label="Meio a meio" defaultChecked={features.halfAndHalf} />
        <Check name="addons" label="Adicionais" defaultChecked={features.addons} />
        <label className="flex flex-col gap-1 text-sm">
          Preço do meio a meio
          <select name="halfPriceRule" defaultValue={rules.halfPriceRule} className={inputClass}>
            <option value="highest">Sabor mais caro</option>
            <option value="average">Média dos sabores</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Regras</legend>
        <label className="flex flex-col gap-1 text-sm">
          Pedido mínimo
          <input name="minOrder" inputMode="decimal" defaultValue={formatCentsForInput(rules.minOrderCents)} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.minOrderCents" />
        <label className="flex flex-col gap-1 text-sm">
          Tempo de preparo (min)
          <input name="prepTimeMin" type="number" min={1} defaultValue={rules.prepTimeMin} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.prepTimeMin" />
        <label className="flex flex-col gap-1 text-sm">
          Tempo de entrega (min)
          <input name="deliveryTimeMin" type="number" min={1} defaultValue={rules.deliveryTimeMin} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.deliveryTimeMin" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Taxa de entrega</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="deliveryFeeStrategy" value="fixed" defaultChecked={rules.deliveryFee.strategy === "fixed"} />
          Taxa fixa
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="deliveryFeeStrategy"
            value="by_neighborhood"
            defaultChecked={rules.deliveryFee.strategy === "by_neighborhood"}
          />
          Taxa por bairro
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Valor da taxa fixa
          <input name="fixedFee" inputMode="decimal" defaultValue={formatCentsForInput(fixedCents)} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.deliveryFee.fixedCents" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Pagamento na entrega/retirada</legend>
        <Check name="cash" label="Dinheiro" defaultChecked={paymentMethods.cash} />
        <Check name="cardOnDelivery" label="Cartão na entrega" defaultChecked={paymentMethods.cardOnDelivery} />
        <label className="flex flex-col gap-1 text-sm">
          Chave Pix
          <input name="pixKey" defaultValue={paymentMethods.pixKey ?? ""} className={inputClass} />
        </label>
      </fieldset>

      <SubmitButton>Salvar operação</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
```

`src/app/painel/loja/_components/zones-editor.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { DeliveryZone } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveZonesAction } from "@/app/painel/loja/actions";

type Row = { key: string; neighborhood: string; fee: string };

export function ZonesEditor({ initialZones }: { initialZones: DeliveryZone[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialZones.map((zone) => ({ key: zone.id, neighborhood: zone.neighborhood, fee: formatCentsForInput(zone.feeCents) })),
  );
  const [state, formAction] = useActionState(saveZonesAction, idleState);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const payload = rows.map((row) => ({ neighborhood: row.neighborhood, fee: row.fee }));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="zones" value={JSON.stringify(payload)} />
      <p className="text-sm text-neutral-700 dark:text-neutral-300">Usado quando a taxa de entrega é &quot;Taxa por bairro&quot;.</p>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-end gap-2">
            <input
              aria-label={`Bairro ${index + 1}`}
              value={row.neighborhood}
              onChange={(event) => update(row.key, { neighborhood: event.target.value })}
              className={inputClass}
            />
            <input
              aria-label={`Taxa ${index + 1}`}
              inputMode="decimal"
              value={row.fee}
              onChange={(event) => update(row.key, { fee: event.target.value })}
              className={`${inputClass} w-28`}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              className={secondaryButtonClass}
            >
              Remover bairro {index + 1}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), neighborhood: "", fee: "0,00" }])}
          className={secondaryButtonClass}
        >
          Adicionar bairro
        </button>
        <SubmitButton>Salvar bairros</SubmitButton>
      </div>
      {state.status === "error" && (
        <ul className="text-sm text-red-700 dark:text-red-400">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
    </form>
  );
}
```

- [ ] **Step 3: Página — `src/app/painel/loja/page.tsx`**

```tsx
import { Suspense } from "react";
import { getDeliveryZones } from "@/modules/stores";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { HoursEditor } from "./_components/hours-editor";
import { OperationsForm } from "./_components/operations-form";
import { ProfileForm } from "./_components/profile-form";
import { StatusButtons } from "./_components/status-buttons";
import { ZonesEditor } from "./_components/zones-editor";

const sectionClass = "flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

async function StoreSettings() {
  const { store } = await requireStoreAccess();
  const zones = await getDeliveryZones(store.id);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Aparência" className={sectionClass}>
        <h2 className="text-lg font-semibold">Aparência</h2>
        <ProfileForm
          name={store.name}
          address={store.address}
          whatsappPhone={store.whatsappPhone}
          logoUrl={store.logoUrl}
          bannerUrl={store.bannerUrl}
          primary={store.theme.primary.toLowerCase()}
          secondary={store.theme.secondary.toLowerCase()}
        />
      </section>

      <section aria-label="Funcionamento" className={sectionClass}>
        <h2 className="text-lg font-semibold">Funcionamento</h2>
        <StatusButtons current={store.manualStatus} />
        <HoursEditor initialHours={store.hours} />
      </section>

      <section aria-label="Entrega, retirada e pagamento" className={sectionClass}>
        <h2 className="text-lg font-semibold">Entrega, retirada e pagamento</h2>
        <OperationsForm features={store.features} rules={store.rules} paymentMethods={store.paymentMethods} />
      </section>

      <section aria-label="Bairros atendidos" className={sectionClass}>
        <h2 className="text-lg font-semibold">Bairros atendidos</h2>
        <ZonesEditor initialZones={zones} />
      </section>
    </div>
  );
}

export default function LojaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações da loja</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <StoreSettings />
      </Suspense>
    </div>
  );
}
```

(`input type="color"` só aceita minúsculas — por isso o `toLowerCase()`.)

- [ ] **Step 4: Verificar e commitar**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: sem erros; rota `/painel/loja` no build.

```bash
git add -A
git commit -m "feat: add panel store settings for appearance, hours, operations and zones"
```

---

### Task 11: E2E do painel, CI e README

**Files:**
- Create: `e2e/painel.spec.ts`, `e2e/fixtures/logo.png`
- Modify: `README.md`

**Interfaces:**
- Consumes: `loginAsOwner` (`e2e/helpers.ts`, Task 2); seed via `globalSetup`; rótulos das Tasks 6, 7, 9, 10; página pública `/pizzaria-demo` (F1: `data-testid="open-status"`, `<article>` por produto, nav "Categorias").
- Produces: suíte E2E do painel provando que cada edição aparece no cardápio público.

- [ ] **Step 1: Fixture**

```bash
mkdir -p e2e/fixtures
node -e 'require("node:fs").writeFileSync("e2e/fixtures/logo.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"))'
```

- [ ] **Step 2: Escrever `e2e/painel.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers";

// Os testes alteram a Pizzaria Demo; o globalSetup recria a loja a cada execução.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await loginAsOwner(page);
});

async function publicCard(page: Page, name: string) {
  await page.goto("/pizzaria-demo");
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("editar preço de um tamanho aparece no cardápio", async ({ page }) => {
  await page.getByRole("link", { name: "Editar Calabresa" }).click();
  await page.getByLabel("Preço Broto").fill("39,90");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await expect(await publicCard(page, "Calabresa")).toContainText(/a partir de R\$\s39,90/);
});

test("preço digitado errado mostra erro e não salva", async ({ page }) => {
  await page.getByRole("link", { name: "Editar Mussarela" }).click();
  await page.getByLabel("Preço Broto").fill("12.50");
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("preço inválido (use 34,90)")).toBeVisible();
  await expect(page).toHaveURL(/\/painel\/cardapio\/produtos\//);
  await expect(await publicCard(page, "Mussarela")).toContainText(/a partir de R\$\s32,90/);
});

test("nova categoria com produto aparece no cardápio", async ({ page }) => {
  await page.getByLabel("Nova categoria").fill("Combos");
  await page.getByRole("button", { name: "Adicionar categoria" }).click();
  const combos = page.getByRole("region", { name: "Combos" });
  await expect(combos).toBeVisible();

  await combos.getByRole("link", { name: "Novo produto" }).click();
  await page.getByLabel("Nome").fill("Combo Família");
  await page.getByLabel("Preço", { exact: true }).fill("89,90");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Combos" })).toBeVisible();
  await expect(await publicCard(page, "Combo Família")).toContainText(/R\$\s89,90/);
});

test("marcar esgotado na disponibilidade aparece no cardápio", async ({ page }) => {
  await page.getByRole("navigation", { name: "Painel" }).getByRole("link", { name: "Disponibilidade" }).click();
  await page.getByRole("button", { name: "Marcar Coca-Cola 2L como esgotado" }).click();
  await expect(page.getByRole("button", { name: "Marcar Coca-Cola 2L como disponível" })).toBeVisible();

  await expect(await publicCard(page, "Coca-Cola 2L")).toContainText("Esgotado");
});

test("fechar agora e voltar ao automático", async ({ page }) => {
  await page.goto("/painel/loja");
  await page.getByRole("button", { name: "Fechar agora" }).click();
  await expect(page.getByRole("button", { name: "Fechar agora" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/pizzaria-demo");
  await expect(page.getByTestId("open-status")).toHaveText("Fechado no momento");

  await page.goto("/painel/loja");
  await page.getByRole("button", { name: "Automático" }).click();
  await expect(page.getByRole("button", { name: "Automático" })).toHaveAttribute("aria-pressed", "true");
});

test("cor principal e logo aparecem no cardápio", async ({ page }) => {
  await page.goto("/painel/loja");
  const appearance = page.getByRole("region", { name: "Aparência" });
  await appearance.getByLabel("Cor principal").fill("#1d4ed8");
  await appearance.getByLabel("Logo").setInputFiles("e2e/fixtures/logo.png");
  await expect(appearance.getByRole("img", { name: "Prévia: Logo" })).toBeVisible();
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Aparência salva.");

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("img", { name: "Logo de Pizzaria Demo" })).toBeVisible();
  await expect(page.locator('[style*="--brand-primary:#1d4ed8"]')).toHaveCount(1);
});

test("turnos sobrepostos são recusados", async ({ page }) => {
  await page.goto("/painel/loja");
  const hours = page.getByRole("region", { name: "Funcionamento" });
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Salvar horários" }).click();

  await expect(hours.getByText("há turnos sobrepostos")).toBeVisible();
});
```

- [ ] **Step 3: Rodar**

Run: `npm run db:migrate && npm run build && CI=1 npm run test:e2e`
Expected: PASS — auth 4, menu 4, painel-auth 3, painel 7. Se algum seletor não bater com a tela, ajustar a **tela** para os rótulos listados nas Interfaces das Tasks 6, 7, 9 e 10 (não afrouxar o teste).

- [ ] **Step 4: README**

Em `README.md`, acrescentar uma seção:

```markdown
## Painel da loja

- `/painel` — dono da loja (login em `/login`). Demo: `dono@pizzariademo.test` / `demo-senha-123`.
- Cardápio, adicionais, disponibilidade e configurações; cada alteração atualiza o cardápio público na hora.
- Imagens enviadas ficam em `.data/uploads` (local); servidas em `/uploads/<arquivo>`.
```

- [ ] **Step 5: Suíte completa e commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && CI=1 npm run test:e2e`
Expected: tudo passa.

```bash
git add -A
git commit -m "test: cover store panel flows end to end"
```
