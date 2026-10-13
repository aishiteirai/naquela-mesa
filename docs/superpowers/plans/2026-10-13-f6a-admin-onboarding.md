# F6a Super-admin e Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O super-admin coloca um restaurante novo no ar em minutos.
- Em `/admin`, cria a loja a partir de um template (Pizzaria, Hamburgueria, Lanchonete).
- Recebe um link de convite e manda ao dono pelo WhatsApp.
- O dono abre o link, define a senha e entra direto em `/painel`, onde um checklist mostra o que falta configurar.
- O super-admin também pode "Acessar como loja" para dar suporte. Todo acesso fica registrado.

**Architecture:**
- **Módulos novos:** `onboarding` (templates, criação de loja a partir de template, checklist) e `audit` (registro de ações do super-admin).
- **Convite:** `store_invites` no módulo `stores`, com token aleatório de 256 bits guardado como hash SHA-256, válido por 7 dias e de uso único.
- **Senha:** o mesmo convite serve para o primeiro acesso e para redefinir a senha. Se o email já tem conta, o link troca a senha.
- **Impersonação:** "Acessar como loja" usa a do plugin `admin` do Better Auth (`impersonateUser`/`stopImpersonating`). O painel mostra uma faixa "Modo suporte".
- **Sem envio de email:** o link aparece na tela para o super-admin copiar.

**Tech Stack:** Next.js 16.4 (cacheComponents, Server Actions, `useActionState`), Better Auth 1.7.7 (plugin admin, `auth.$context`), Drizzle 0.45 + Postgres 17, Zod 4, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md`:
- §1 critério 6 "Um restaurante novo entra no ar em menos de 30 minutos a partir de um template"
- §3 (Better Auth: cadastro público desabilitado, plugin `admin`, impersonation)
- §7 "Super-admin `/admin`"
- §9 "Auditoria"
- §11 E2E 4 "Super-admin cria loja a partir de template; loja fica acessível"

**Plano irmão:** `2026-10-13-f6b-lancamento.md` (rate limit, uploads no Blob, Sentry, deploy). Esta F6a não depende dele.

## Global Constraints

- **Textos e dinheiro:** textos de interface em português do Brasil. Dinheiro só via `formatBRL`.
- **Fronteiras de import:**
  - `src/app/` nunca acessa o banco; só módulos.
  - Módulos só via `@/modules/<nome>` (ou `/client`).
  - `../` é proibido em `src/` (exceto `schema.ts`, para FKs entre módulos).
  - `scripts/` importam só `@/modules/*` e `@/shared/*`.
- **Autorização:**
  - Toda página/action de `/admin` chama `requireSuperAdmin()` antes de ler o formulário.
  - Painel: `storeId` sempre da sessão (`requireStoreAccess()`).
- **Cadastro público continua desabilitado** (`disableSignUp: true`). Conta nova só nasce por convite aceito ou por script.
- **Convite:**
  - Token = `randomBytes(32).toString("base64url")` (43 caracteres). No banco só o hash SHA-256 hex.
  - Expira em 7 dias e vale uma vez.
  - Gerar link novo para a mesma loja apaga os convites pendentes dela.
  - Link: `${BETTER_AUTH_URL}/convite/<token>`.
- **Senha:** 8 a 128 caracteres; confirmação igual.
- **Email:** sempre `trim().toLowerCase()`.
- **Um dono, uma loja:** email que já é dono de outra loja é recusado ao criar loja ("este email já é dono de outra loja").
- **"Acessar como loja":**
  - Só para loja com dono.
  - Grava `audit_logs` (`support_session_started`) **antes** de impersonar.
  - Ao sair, grava `support_session_ended` com o ator = `impersonatedBy`.
- **Next 16 `cacheComponents`:** leituras de sessão e `params` dentro de `<Suspense>`. Depois de criar loja, `updateTag(storeMenuTag(slug))` na action.
- **Ambiente:**
  - Worktree `/home/ryan/workspace/personalprojects/ecom-menu-f2`, branch `f6a-admin`, banco `naquela_mesa_f2`, porta 3001.
  - Nunca `pkill`; nunca iniciar, parar ou recriar containers.
- **Commits** terminam com linha em branco + trailer `Co-Authored-By:` do modelo que escreveu.

## Review Focus

1. **Link de convite reaproveitado.** Mesmo link aberto duas vezes, ou dois envios ao mesmo tempo → só o primeiro cria conta; o segundo vê "Este link expirou ou já foi usado". Testes: Task 1 (integração, inclusive em paralelo) e Task 7 (E2E).
2. **Convite para email que já tem conta** → não cria conta duplicada; troca a senha e vincula à loja. Teste: Task 1.
3. **Dono de outra loja.** Criar loja com email de quem já é dono de outra → recusado com erro no campo, e nenhuma loja pela metade fica no banco. Teste: Task 2.
4. **Acesso de suporte.** Dono comum (não super-admin) chama a action de "Acessar como loja" → redirecionado, nada é gravado. Loja sem dono → botão desabilitado. Testes: Task 5 (unit da guarda) e Task 7.
5. **Token malformado ou inexistente em `/convite/...`** → página "Link inválido ou expirado.", sem erro 500. Teste: Task 1 e Task 7.

---

## File Structure

```
src/modules/auth/
  users.ts (+ users.int.test.ts)    # + findUserByEmail, getUserEmails, setUserPassword, deleteUserByEmail
  session.ts                        # signInWithPassword, startImpersonation, stopImpersonation (usam headers())
  guards.ts                         # SessionUser ganha impersonatedBy
  index.ts
src/modules/stores/
  schema.ts                         # + store_invites
  invites.ts (+ invites.int.test.ts)
  admin.ts (+ admin.int.test.ts)    # listStoresForAdmin, getStoreOwnerUserId
  settings.ts                       # "convite" em RESERVED_SLUGS
  index.ts
src/modules/audit/                  # módulo novo
  types.ts, schema.ts, service.ts (+ service.int.test.ts), index.ts
src/modules/onboarding/             # módulo novo
  templates.ts, create-store.ts (+ create-store.int.test.ts)
  checklist.ts (+ checklist.test.ts), index.ts
drizzle/0008_*.sql
src/app/admin/page.tsx, admin/actions.ts, admin/_components/{create-store-form,invite-link,new-link-form}.tsx
src/app/convite/[token]/page.tsx, convite/[token]/actions.ts, convite/[token]/_components/accept-form.tsx
src/app/login/page.tsx              # dica "Esqueceu a senha?"
src/app/painel/layout.tsx, painel/_components/support-banner.tsx, painel/support-actions.ts
src/app/painel/page.tsx, painel/_components/onboarding-checklist.tsx
scripts/e2e-cleanup.ts, package.json, e2e/global-setup.ts, playwright.config.ts, e2e/admin.spec.ts
README.md
```

---

### Task 1: Convites e senha (dados)

**Files:**
- Modify: `src/modules/auth/users.ts`, `src/modules/auth/index.ts`
- Create: `src/modules/auth/users.int.test.ts` (se já existir, acrescente os testes)
- Modify: `src/modules/stores/schema.ts`, `src/modules/stores/settings.ts`, `src/modules/stores/index.ts`
- Create: `src/modules/stores/invites.ts`, `src/modules/stores/invites.int.test.ts`
- Create (gerado): `drizzle/0008_*.sql` + `drizzle/meta/*`

**Interfaces:**
- Produces (via `@/modules/auth`):
  - `findUserByEmail(email: string): Promise<{ id: string; name: string } | null>` (email normalizado).
  - `getUserEmails(ids: string[]): Promise<Map<string, string>>`.
  - `setUserPassword(userId: string, password: string): Promise<void>` (hash do Better Auth via `auth.$context`).
  - `deleteUserByEmail(email: string): Promise<boolean>`.
- Produces (via `@/modules/stores`):
  - `INVITE_TTL_DAYS = 7`.
  - `createStoreInvite(storeId: string, email: string, createdBy: string | null, now?: Date): Promise<{ token: string; expiresAt: Date }>`.
  - `type InviteView = { storeName: string; email: string; hasAccount: boolean; expiresAt: Date }`; `getInvite(token: string, now?: Date): Promise<InviteView | null>`.
  - `acceptStoreInvite(token: string, input: { name: string | null; password: string }, now?: Date): Promise<{ email: string; storeId: string }>`.
- Erros:
  - Senha fora de 8–128 → `VALIDATION` path `password`.
  - Nome vazio quando a conta é nova → `VALIDATION` path `name`.
  - Email inválido → `VALIDATION` path `ownerEmail`.
  - Convite inexistente, expirado, usado ou token malformado → `NOT_FOUND`.

- [ ] **Step 1: Write the failing tests**

`src/modules/auth/users.int.test.ts` (crie; se existir, acrescente o `describe`):

```ts
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/shared/db/client";
import { auth } from "./auth";
import { deleteUserByEmail, ensureUser, findUserByEmail, getUserEmails, setUserPassword } from "./users";

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hash = found?.accounts.find((account) => account.providerId === "credential")?.password;
  return hash ? ctx.password.verify({ hash, password }) : false;
}

describe("usuários", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("acha por email normalizado, troca senha, lista emails e apaga", async () => {
    await deleteUserByEmail("troca-senha@exemplo.com");
    const created = await ensureUser({ email: "troca-senha@exemplo.com", password: "senha-antiga-1", name: "Teste" });

    expect(await findUserByEmail("  TROCA-SENHA@exemplo.com ")).toEqual({ id: created.id, name: "Teste" });
    expect(await findUserByEmail("ninguem@exemplo.com")).toBeNull();

    await setUserPassword(created.id, "senha-nova-123");
    expect(await passwordWorks("troca-senha@exemplo.com", "senha-nova-123")).toBe(true);
    expect(await passwordWorks("troca-senha@exemplo.com", "senha-antiga-1")).toBe(false);

    expect(await getUserEmails([created.id])).toEqual(new Map([[created.id, "troca-senha@exemplo.com"]]));
    expect(await getUserEmails([])).toEqual(new Map());

    expect(await deleteUserByEmail("troca-senha@exemplo.com")).toBe(true);
    expect(await findUserByEmail("troca-senha@exemplo.com")).toBeNull();
  });
});
```

Se `ctx.internalAdapter.findUserByEmail` tiver outra assinatura nesta versão do Better Auth, confira `node_modules/better-auth/dist/db/internal-adapter.mjs`. Ajuste só o helper `passwordWorks`, sem mudar o que ele verifica.

`src/modules/stores/invites.int.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, deleteUserByEmail, ensureUser, findUserByEmail } from "@/modules/auth";
import { db, pool } from "@/shared/db/client";
import { acceptStoreInvite, createStoreInvite, getInvite } from "./invites";
import { getMembershipStoreId } from "./members";
import { storeInvites } from "./schema";
import { createStore, deleteStoreBySlug } from "./service";

const NEW_OWNER = "novo-dono@exemplo.com";
const OLD_OWNER = "dono-antigo@exemplo.com";

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hash = found?.accounts.find((account) => account.providerId === "credential")?.password;
  return hash ? ctx.password.verify({ hash, password }) : false;
}

describe("convites de loja", () => {
  let storeId: string;

  beforeEach(async () => {
    await deleteStoreBySlug("convite-loja");
    await deleteUserByEmail(NEW_OWNER);
    await deleteUserByEmail(OLD_OWNER);
    ({ id: storeId } = await createStore({ slug: "convite-loja", name: "Loja Convite", whatsappPhone: "+5511999990000" }));
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria conta nova, vincula à loja e o link vale uma vez", async () => {
    const { token, expiresAt } = await createStoreInvite(storeId, "  Novo-Dono@Exemplo.com ", null);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);

    const [stored] = await db.select().from(storeInvites).where(eq(storeInvites.storeId, storeId));
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(await getInvite(token)).toMatchObject({ storeName: "Loja Convite", email: NEW_OWNER, hasAccount: false });

    expect(await acceptStoreInvite(token, { name: "Novo Dono", password: "senha-forte-123" })).toEqual({ email: NEW_OWNER, storeId });
    const user = await findUserByEmail(NEW_OWNER);
    expect(user?.name).toBe("Novo Dono");
    expect(await getMembershipStoreId(user!.id)).toBe(storeId);
    expect(await passwordWorks(NEW_OWNER, "senha-forte-123")).toBe(true);

    expect(await getInvite(token)).toBeNull();
    await expect(acceptStoreInvite(token, { name: "Outro", password: "senha-forte-456" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("dois aceites simultâneos criam uma conta só", async () => {
    const { token } = await createStoreInvite(storeId, NEW_OWNER, null);
    const results = await Promise.allSettled([
      acceptStoreInvite(token, { name: "Dono A", password: "senha-forte-123" }),
      acceptStoreInvite(token, { name: "Dono B", password: "senha-forte-456" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("email que já tem conta: troca a senha e não pede nome", async () => {
    await ensureUser({ email: OLD_OWNER, password: "senha-velha-1", name: "Dono Antigo" });
    const { token } = await createStoreInvite(storeId, OLD_OWNER, null);
    expect((await getInvite(token))?.hasAccount).toBe(true);

    await acceptStoreInvite(token, { name: null, password: "senha-nova-123" });
    expect(await passwordWorks(OLD_OWNER, "senha-nova-123")).toBe(true);
    expect(await passwordWorks(OLD_OWNER, "senha-velha-1")).toBe(false);
    expect((await findUserByEmail(OLD_OWNER))?.name).toBe("Dono Antigo");
  });

  it("recusa senha curta, nome vazio, email inválido e mantém o link válido", async () => {
    await expect(createStoreInvite(storeId, "nao-e-email", null)).rejects.toMatchObject({ code: "VALIDATION" });

    const { token } = await createStoreInvite(storeId, NEW_OWNER, null);
    await expect(acceptStoreInvite(token, { name: "Dono", password: "curta" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "password" }] },
    });
    await expect(acceptStoreInvite(token, { name: "   ", password: "senha-forte-123" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "name" }] },
    });
    expect(await getInvite(token)).not.toBeNull();
  });

  it("link expirado, substituído ou malformado não vale", async () => {
    const past = new Date(Date.now() - 8 * 86_400_000);
    const expired = await createStoreInvite(storeId, NEW_OWNER, null, past);
    expect(await getInvite(expired.token)).toBeNull();

    const first = await createStoreInvite(storeId, NEW_OWNER, null);
    const second = await createStoreInvite(storeId, NEW_OWNER, null);
    expect(await getInvite(first.token)).toBeNull();
    expect(await getInvite(second.token)).not.toBeNull();

    expect(await getInvite("curto")).toBeNull();
    await expect(acceptStoreInvite("curto", { name: "X", password: "senha-forte-123" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:int -- src/modules/auth/users.int.test.ts src/modules/stores/invites.int.test.ts`
Expected: FAIL (funções inexistentes)

- [ ] **Step 3: Implement auth helpers**

Em `src/modules/auth/users.ts`, ajuste o import do drizzle para `import { eq, inArray } from "drizzle-orm";` e acrescente:

```ts
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<{ id: string; name: string } | null> {
  const [row] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

export async function getUserEmails(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, ids));
  return new Map(rows.map((row) => [row.id, row.email]));
}

/** Troca a senha da conta de email/senha com o mesmo hash que o Better Auth usa no login. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
}

export async function deleteUserByEmail(email: string): Promise<boolean> {
  const deleted = await db.delete(user).where(eq(user.email, normalizeEmail(email))).returning({ id: user.id });
  return deleted.length > 0;
}
```

Em `ensureUser`, troque `const email = input.email.trim().toLowerCase();` por `const email = normalizeEmail(input.email);`. Em `src/modules/auth/index.ts`, troque a linha de `./users` por:

```ts
export {
  deleteUserByEmail,
  ensureSuperAdmin,
  ensureUser,
  findUserByEmail,
  getUserEmails,
  setUserPassword,
  type EnsureSuperAdminInput,
  type EnsureUserInput,
} from "./users";
```

- [ ] **Step 4: Schema, reserved slug, invites service**

Em `src/modules/stores/schema.ts`, acrescente ao fim:

```ts
export const storeInvites = pgTable(
  "store_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_invites_store_id_idx").on(t.storeId)],
);
```

Em `src/modules/stores/settings.ts`, acrescente `"convite"` a `RESERVED_SLUGS`, logo depois de `"api"`.

`src/modules/stores/invites.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { ensureUser, findUserByEmail, setUserPassword } from "@/modules/auth";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { addStoreMember } from "./members";
import { storeInvites, stores } from "./schema";

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 86_400_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const emailSchema = z.email();
const passwordSchema = z.string().min(8, "a senha deve ter ao menos 8 caracteres").max(128, "senha longa demais");
const nameSchema = z.string().trim().min(1, "informe seu nome").max(80, "nome longo demais");

export type InviteView = { storeName: string; email: string; hasAccount: boolean; expiresAt: Date };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validation(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

function validInvite(token: string, now: Date) {
  return and(eq(storeInvites.tokenHash, hashToken(token)), isNull(storeInvites.acceptedAt), gt(storeInvites.expiresAt, now));
}

/** Gera o link do dono (primeiro acesso ou nova senha). Só o último link pendente da loja vale. */
export async function createStoreInvite(
  storeId: string,
  email: string,
  createdBy: string | null,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase());
  if (!parsed.success) throw validation("ownerEmail", "email inválido");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
  await db.transaction(async (tx) => {
    await tx.delete(storeInvites).where(and(eq(storeInvites.storeId, storeId), isNull(storeInvites.acceptedAt)));
    await tx.insert(storeInvites).values({ storeId, email: parsed.data, tokenHash: hashToken(token), createdBy, expiresAt });
  });
  return { token, expiresAt };
}

async function findValidInvite(token: string, now: Date) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .select({
      id: storeInvites.id,
      storeId: storeInvites.storeId,
      email: storeInvites.email,
      expiresAt: storeInvites.expiresAt,
      storeName: stores.name,
    })
    .from(storeInvites)
    .innerJoin(stores, eq(stores.id, storeInvites.storeId))
    .where(validInvite(token, now))
    .limit(1);
  return row ?? null;
}

export async function getInvite(token: string, now: Date = new Date()): Promise<InviteView | null> {
  const invite = await findValidInvite(token, now);
  if (!invite) return null;
  return {
    storeName: invite.storeName,
    email: invite.email,
    hasAccount: (await findUserByEmail(invite.email)) !== null,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptStoreInvite(
  token: string,
  input: { name: string | null; password: string },
  now: Date = new Date(),
): Promise<{ email: string; storeId: string }> {
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) throw validation("password", password.error.issues[0]?.message ?? "senha inválida");

  const invite = await findValidInvite(token, now);
  if (!invite) throw new DomainError("NOT_FOUND");

  const existing = await findUserByEmail(invite.email);
  let name: string | null = null;
  if (!existing) {
    const parsedName = nameSchema.safeParse(input.name ?? "");
    if (!parsedName.success) throw validation("name", parsedName.error.issues[0]?.message ?? "nome inválido");
    name = parsedName.data;
  }

  // Marca como usado antes de mexer na conta: dois envios do mesmo link não criam duas contas.
  const [claimed] = await db
    .update(storeInvites)
    .set({ acceptedAt: now })
    .where(and(eq(storeInvites.id, invite.id), isNull(storeInvites.acceptedAt)))
    .returning({ id: storeInvites.id });
  if (!claimed) throw new DomainError("NOT_FOUND");

  try {
    let userId: string;
    if (existing) {
      await setUserPassword(existing.id, password.data);
      userId = existing.id;
    } else {
      userId = (await ensureUser({ email: invite.email, password: password.data, name: name! })).id;
    }
    await addStoreMember(invite.storeId, userId);
  } catch (error) {
    // Falhou depois de reservar: devolve o link para o dono tentar de novo.
    await db.update(storeInvites).set({ acceptedAt: null }).where(eq(storeInvites.id, claimed.id));
    throw error;
  }
  return { email: invite.email, storeId: invite.storeId };
}
```

Em `src/modules/stores/index.ts`, acrescente:

```ts
export { acceptStoreInvite, createStoreInvite, getInvite, INVITE_TTL_DAYS, type InviteView } from "./invites";
```

Run: `npm run db:generate`
Expected: `drizzle/0008_*.sql` só com `CREATE TABLE "store_invites"`, as FKs, o unique e o índice. Confira o arquivo.

Run: `npm run db:migrate`
Expected: sem erro (banco do worktree).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:int -- src/modules/auth src/modules/stores && npm test && npm run typecheck && npm run lint`
Expected: PASS. Se algum teste unitário de `settings` listar `RESERVED_SLUGS` por igualdade, atualize-o com `"convite"`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth src/modules/stores drizzle
git commit -m "feat: single-use store invite links for owner access"
```

---

### Task 2: Templates de cardápio e criação de loja a partir de template

**Files:**
- Create: `src/modules/stores/admin.ts`, `src/modules/stores/admin.int.test.ts`
- Modify: `src/modules/stores/index.ts`
- Create: `src/modules/onboarding/templates.ts`, `src/modules/onboarding/create-store.ts`, `src/modules/onboarding/create-store.int.test.ts`, `src/modules/onboarding/index.ts`

**Interfaces:**
- Consumes:
  - `createStore`, `deleteStoreBySlug`, `addStoreMember`, `getMembershipStoreId`, `createStoreInvite` (`@/modules/stores`).
  - `importCatalog`, `getMenu`, `CatalogDefinition` (`@/modules/catalog`).
  - `findUserByEmail` (`@/modules/auth`); `normalizeBrazilPhone` (`@/modules/orders`).
- Produces (via `@/modules/stores`):
  - `type AdminStoreRow = { id: string; slug: string; name: string; createdAt: Date; ownerEmail: string | null; pendingInvite: { email: string; expiresAt: Date } | null }`.
  - `listStoresForAdmin(now?: Date): Promise<AdminStoreRow[]>`: mais nova primeiro. O dono é o primeiro membro por `created_at`. O convite pendente só aparece se não expirou.
  - `getStoreOwnerUserId(storeId: string): Promise<string | null>`.
- Produces (via `@/modules/onboarding`):
  - `STORE_TEMPLATES = ["pizzaria", "hamburgueria", "lanchonete"] as const`; `StoreTemplate`; `TEMPLATE_LABELS: Record<StoreTemplate, string>` ("Pizzaria", "Hamburgueria", "Lanchonete"); `templateCatalog(template): CatalogDefinition`.
  - `type CreateStoreFromTemplateResult = { storeId: string; slug: string; inviteToken: string | null; ownerLinked: boolean }`.
  - `createStoreFromTemplate(input: { name: string; slug: string; whatsapp: string; ownerEmail: string; template: string }, createdBy: string): Promise<CreateStoreFromTemplateResult>`.
- Erros de `createStoreFromTemplate` (`VALIDATION`, por path):
  - `name`, `slug` (vêm de `createStore`), `whatsapp` ("WhatsApp inválido (use DDD + número)"), `ownerEmail` ("email inválido" / "este email já é dono de outra loja"), `template`.
  - Em qualquer erro depois de `createStore`, a loja é apagada (`deleteStoreBySlug`).

- [ ] **Step 1: Write the failing tests**

`src/modules/stores/admin.int.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteUserByEmail, ensureUser } from "@/modules/auth";
import { pool } from "@/shared/db/client";
import { getStoreOwnerUserId, listStoresForAdmin } from "./admin";
import { createStoreInvite } from "./invites";
import { addStoreMember } from "./members";
import { createStore, deleteStoreBySlug } from "./service";

describe("lojas no super-admin", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("admin-com-dono");
    await deleteStoreBySlug("admin-com-convite");
    await deleteUserByEmail("dono-admin@exemplo.com");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("mostra dono, convite pendente e a mais nova primeiro", async () => {
    const withOwner = await createStore({ slug: "admin-com-dono", name: "Com Dono", whatsappPhone: "+5511999990000" });
    const owner = await ensureUser({ email: "dono-admin@exemplo.com", password: "senha-forte-123", name: "Dono" });
    await addStoreMember(withOwner.id, owner.id);
    const withInvite = await createStore({ slug: "admin-com-convite", name: "Com Convite", whatsappPhone: "+5511999990001" });
    const { expiresAt } = await createStoreInvite(withInvite.id, "pendente@exemplo.com", null);

    const rows = (await listStoresForAdmin()).filter((row) => row.slug.startsWith("admin-com-"));
    expect(rows.map((row) => row.slug)).toEqual(["admin-com-convite", "admin-com-dono"]);
    expect(rows[0]).toMatchObject({ name: "Com Convite", ownerEmail: null, pendingInvite: { email: "pendente@exemplo.com", expiresAt } });
    expect(rows[1]).toMatchObject({ name: "Com Dono", ownerEmail: "dono-admin@exemplo.com", pendingInvite: null });

    expect(await getStoreOwnerUserId(withOwner.id)).toBe(owner.id);
    expect(await getStoreOwnerUserId(withInvite.id)).toBeNull();

    const later = new Date(Date.now() + 8 * 86_400_000);
    const expired = (await listStoresForAdmin(later)).find((row) => row.slug === "admin-com-convite");
    expect(expired?.pendingInvite).toBeNull();
  });
});
```

`src/modules/onboarding/create-store.int.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteUserByEmail, ensureUser } from "@/modules/auth";
import { getMenu } from "@/modules/catalog";
import { addStoreMember, createStore, deleteStoreBySlug, getInvite, getMembershipStoreId, getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { createStoreFromTemplate } from "./create-store";
import { STORE_TEMPLATES } from "./templates";

const base = { name: "Loja Template", whatsapp: "(11) 97777-0000", ownerEmail: "dono-template@exemplo.com" };

describe("criar loja a partir de template", () => {
  let adminId: string;

  beforeEach(async () => {
    for (const template of STORE_TEMPLATES) await deleteStoreBySlug(`tpl-${template}`);
    await deleteStoreBySlug("tpl-outra");
    await deleteUserByEmail("dono-template@exemplo.com");
    await deleteUserByEmail("dono-existente@exemplo.com");
    adminId = (await ensureUser({ email: "admin-template@exemplo.com", password: "senha-forte-123", name: "Admin" })).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each(STORE_TEMPLATES)("template %s cria loja com cardápio e convite", async (template) => {
    const result = await createStoreFromTemplate({ ...base, slug: `tpl-${template}`, template }, adminId);

    expect(result).toMatchObject({ slug: `tpl-${template}`, ownerLinked: false });
    expect(result.inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await getInvite(result.inviteToken!)).toMatchObject({ storeName: "Loja Template", email: "dono-template@exemplo.com" });

    const store = await getStoreBySlug(`tpl-${template}`);
    expect(store).toMatchObject({ whatsappPhone: "+5511977770000", features: { halfAndHalf: template === "pizzaria" } });
    const menu = await getMenu(result.storeId);
    expect(menu.categories.length).toBeGreaterThanOrEqual(3);
    expect(menu.categories.every((category) => category.products.length > 0)).toBe(true);
  });

  it("email com conta sem loja vira dono direto, sem convite", async () => {
    const existing = await ensureUser({ email: "dono-existente@exemplo.com", password: "senha-forte-123", name: "Já Tenho Conta" });
    const result = await createStoreFromTemplate(
      { ...base, slug: "tpl-pizzaria", template: "pizzaria", ownerEmail: "Dono-Existente@exemplo.com" },
      adminId,
    );
    expect(result).toMatchObject({ inviteToken: null, ownerLinked: true });
    expect(await getMembershipStoreId(existing.id)).toBe(result.storeId);
  });

  it("recusa dono de outra loja sem deixar loja pela metade", async () => {
    const other = await createStore({ slug: "tpl-outra", name: "Outra", whatsappPhone: "+5511999990000" });
    const existing = await ensureUser({ email: "dono-existente@exemplo.com", password: "senha-forte-123", name: "Dono" });
    await addStoreMember(other.id, existing.id);

    await expect(
      createStoreFromTemplate({ ...base, slug: "tpl-pizzaria", template: "pizzaria", ownerEmail: "dono-existente@exemplo.com" }, adminId),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "ownerEmail", message: "este email já é dono de outra loja" }] } });
    expect(await getStoreBySlug("tpl-pizzaria")).toBeNull();
  });

  it("valida WhatsApp, email, template e slug", async () => {
    const attempt = (override: Record<string, string>) =>
      createStoreFromTemplate({ ...base, slug: "tpl-pizzaria", template: "pizzaria", ...override }, adminId);

    await expect(attempt({ whatsapp: "123" })).rejects.toMatchObject({ details: { issues: [{ path: "whatsapp" }] } });
    await expect(attempt({ ownerEmail: "sem-arroba" })).rejects.toMatchObject({ details: { issues: [{ path: "ownerEmail" }] } });
    await expect(attempt({ template: "sorveteria" })).rejects.toMatchObject({ details: { issues: [{ path: "template" }] } });
    await expect(attempt({ slug: "admin" })).rejects.toMatchObject({ details: { issues: [{ path: "slug" }] } });
    await expect(attempt({ name: "  " })).rejects.toMatchObject({ details: { issues: [{ path: "name" }] } });
    expect(await getStoreBySlug("tpl-pizzaria")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:int -- src/modules/stores/admin.int.test.ts src/modules/onboarding`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Implement `stores/admin.ts`**

```ts
import { and, asc, desc, gt, inArray, isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getUserEmails } from "@/modules/auth";
import { db } from "@/shared/db/client";
import { storeInvites, storeMembers, stores } from "./schema";

export type AdminStoreRow = {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  ownerEmail: string | null;
  pendingInvite: { email: string; expiresAt: Date } | null;
};

export async function listStoresForAdmin(now: Date = new Date()): Promise<AdminStoreRow[]> {
  const rows = await db
    .select({ id: stores.id, slug: stores.slug, name: stores.name, createdAt: stores.createdAt })
    .from(stores)
    .orderBy(desc(stores.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [members, invites] = await Promise.all([
    db
      .select({ storeId: storeMembers.storeId, userId: storeMembers.userId })
      .from(storeMembers)
      .where(inArray(storeMembers.storeId, ids))
      .orderBy(asc(storeMembers.createdAt)),
    db
      .select({ storeId: storeInvites.storeId, email: storeInvites.email, expiresAt: storeInvites.expiresAt })
      .from(storeInvites)
      .where(and(inArray(storeInvites.storeId, ids), isNull(storeInvites.acceptedAt), gt(storeInvites.expiresAt, now))),
  ]);
  const emails = await getUserEmails([...new Set(members.map((member) => member.userId))]);

  return rows.map((row) => {
    const owner = members.find((member) => member.storeId === row.id);
    const invite = invites.find((candidate) => candidate.storeId === row.id);
    return {
      ...row,
      ownerEmail: owner ? (emails.get(owner.userId) ?? null) : null,
      pendingInvite: invite ? { email: invite.email, expiresAt: invite.expiresAt } : null,
    };
  });
}

export async function getStoreOwnerUserId(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: storeMembers.userId })
    .from(storeMembers)
    .where(eq(storeMembers.storeId, storeId))
    .orderBy(asc(storeMembers.createdAt))
    .limit(1);
  return row?.userId ?? null;
}
```

(Junte os dois imports de `drizzle-orm` numa linha só.) Em `src/modules/stores/index.ts`:

```ts
export { getStoreOwnerUserId, listStoresForAdmin, type AdminStoreRow } from "./admin";
```

- [ ] **Step 4: Implement onboarding module**

`src/modules/onboarding/templates.ts`:

```ts
import type { CatalogDefinition } from "@/modules/catalog";

export const STORE_TEMPLATES = ["pizzaria", "hamburgueria", "lanchonete"] as const;
export type StoreTemplate = (typeof STORE_TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<StoreTemplate, string> = {
  pizzaria: "Pizzaria",
  hamburgueria: "Hamburgueria",
  lanchonete: "Lanchonete",
};

/** Recursos ligados por modelo (o resto fica no padrão da loja). */
export const TEMPLATE_FEATURES: Record<StoreTemplate, { halfAndHalf: boolean }> = {
  pizzaria: { halfAndHalf: true },
  hamburgueria: { halfAndHalf: false },
  lanchonete: { halfAndHalf: false },
};

const bebidas = {
  name: "Bebidas",
  products: [
    { name: "Refrigerante 2L", priceCents: 1400 },
    { name: "Refrigerante lata", priceCents: 600 },
    { name: "Água sem gás 500ml", priceCents: 400 },
  ],
};

const CATALOGS: Record<StoreTemplate, CatalogDefinition> = {
  pizzaria: {
    optionGroups: [
      {
        key: "borda",
        name: "Borda recheada",
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Catupiry", priceCents: 800 },
          { name: "Cheddar", priceCents: 800 },
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
          { name: "Portuguesa", description: "Presunto, ovos, cebola, ervilha e mussarela.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
          { name: "Frango com Catupiry", description: "Frango desfiado com catupiry.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
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
          { name: "Banana com Canela", description: "Banana, açúcar e canela.", sizePrices: { broto: 3290, media: 4490 }, allowsHalf: true },
        ],
      },
      bebidas,
    ],
  },
  hamburgueria: {
    optionGroups: [
      {
        key: "adicionais",
        name: "Adicionais",
        minSelect: 0,
        maxSelect: 4,
        options: [
          { name: "Bacon", priceCents: 500 },
          { name: "Cheddar extra", priceCents: 400 },
          { name: "Ovo", priceCents: 300 },
          { name: "Hambúrguer extra", priceCents: 900 },
        ],
      },
    ],
    categories: [
      {
        name: "Hambúrgueres",
        products: [
          { name: "X-Burguer", description: "Pão, hambúrguer 150 g e queijo.", priceCents: 2490, optionGroupKeys: ["adicionais"] },
          { name: "X-Salada", description: "Hambúrguer 150 g, queijo, alface e tomate.", priceCents: 2690, optionGroupKeys: ["adicionais"] },
          { name: "X-Bacon", description: "Hambúrguer 150 g, queijo e bacon.", priceCents: 2990, optionGroupKeys: ["adicionais"] },
          { name: "Smash Duplo", description: "Dois smash de 90 g com cheddar.", priceCents: 3290, optionGroupKeys: ["adicionais"] },
        ],
      },
      {
        name: "Porções",
        products: [
          { name: "Batata frita", description: "Porção de 300 g.", priceCents: 1890 },
          { name: "Onion rings", description: "Porção de 250 g.", priceCents: 2190 },
        ],
      },
      bebidas,
    ],
  },
  lanchonete: {
    optionGroups: [
      {
        key: "extras",
        name: "Extras",
        minSelect: 0,
        maxSelect: 3,
        options: [
          { name: "Queijo extra", priceCents: 300 },
          { name: "Presunto extra", priceCents: 300 },
          { name: "Ovo", priceCents: 300 },
        ],
      },
    ],
    categories: [
      {
        name: "Lanches",
        products: [
          { name: "Misto quente", description: "Pão de forma, presunto e queijo.", priceCents: 1200, optionGroupKeys: ["extras"] },
          { name: "Bauru", description: "Pão francês, rosbife, queijo e tomate.", priceCents: 1590, optionGroupKeys: ["extras"] },
          { name: "Americano", description: "Presunto, queijo, ovo, alface e tomate.", priceCents: 1690, optionGroupKeys: ["extras"] },
        ],
      },
      {
        name: "Salgados",
        products: [
          { name: "Coxinha", priceCents: 700 },
          { name: "Pastel de carne", priceCents: 900 },
          { name: "Esfiha de carne", priceCents: 600 },
        ],
      },
      {
        name: "Bebidas",
        products: [
          { name: "Café", priceCents: 500 },
          { name: "Suco natural 400ml", priceCents: 900 },
          { name: "Refrigerante lata", priceCents: 600 },
        ],
      },
    ],
  },
};

export function templateCatalog(template: StoreTemplate): CatalogDefinition {
  return CATALOGS[template];
}
```

`src/modules/onboarding/create-store.ts`:

```ts
import { z } from "zod";
import { findUserByEmail } from "@/modules/auth";
import { importCatalog } from "@/modules/catalog";
import { normalizeBrazilPhone } from "@/modules/orders";
import { addStoreMember, createStore, createStoreInvite, deleteStoreBySlug, getMembershipStoreId } from "@/modules/stores";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { STORE_TEMPLATES, TEMPLATE_FEATURES, templateCatalog } from "./templates";

export type CreateStoreFromTemplateResult = { storeId: string; slug: string; inviteToken: string | null; ownerLinked: boolean };

const inputSchema = z.object({
  name: z.string().trim().min(1, "informe o nome da loja").max(120),
  slug: z.string().trim().toLowerCase(),
  whatsapp: z.string().trim(),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email("email inválido")),
  template: z.enum(STORE_TEMPLATES, "escolha um modelo de cardápio"),
});

function validation(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

/** Loja nova com o cardápio do modelo e o dono vinculado (conta existente) ou convidado (link). */
export async function createStoreFromTemplate(
  input: { name: string; slug: string; whatsapp: string; ownerEmail: string; template: string },
  createdBy: string,
): Promise<CreateStoreFromTemplateResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  const { name, slug, whatsapp, ownerEmail, template } = parsed.data;

  const whatsappPhone = normalizeBrazilPhone(whatsapp);
  if (!whatsappPhone) throw validation("whatsapp", "WhatsApp inválido (use DDD + número)");

  const existing = await findUserByEmail(ownerEmail);
  if (existing && (await getMembershipStoreId(existing.id))) throw validation("ownerEmail", "este email já é dono de outra loja");

  const { id: storeId } = await createStore({ slug, name, whatsappPhone, features: TEMPLATE_FEATURES[template] });
  try {
    await importCatalog(storeId, templateCatalog(template));
    if (existing) {
      await addStoreMember(storeId, existing.id);
      return { storeId, slug, inviteToken: null, ownerLinked: true };
    }
    const { token } = await createStoreInvite(storeId, ownerEmail, createdBy);
    return { storeId, slug, inviteToken: token, ownerLinked: false };
  } catch (error) {
    await deleteStoreBySlug(slug);
    throw error;
  }
}
```

Confira se `zodIssuesToDomainError` (`@/shared/validation`) gera `path` como `"name"`/`"template"` (junção do `issue.path`). Os testes de path dependem disso. Se o formato for outro, ajuste os testes ao formato real e mantenha o campo correto.

`src/modules/onboarding/index.ts`:

```ts
export { createStoreFromTemplate, type CreateStoreFromTemplateResult } from "./create-store";
export { STORE_TEMPLATES, TEMPLATE_LABELS, templateCatalog, type StoreTemplate } from "./templates";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:int -- src/modules/stores src/modules/onboarding && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/stores src/modules/onboarding
git commit -m "feat: create stores from menu templates with an owner invite"
```

---

### Task 3: Registro de auditoria

**Files:**
- Create: `src/modules/audit/types.ts`, `src/modules/audit/schema.ts`, `src/modules/audit/service.ts`, `src/modules/audit/service.int.test.ts`, `src/modules/audit/index.ts`
- Create (gerado): `drizzle/0009_*.sql` + meta

**Interfaces:**
- Produces (via `@/modules/audit`):
  - `AUDIT_ACTIONS = ["store_created", "invite_link_created", "support_session_started", "support_session_ended"] as const`; `AuditAction`.
  - `AUDIT_LABELS: Record<AuditAction, string>` = "Loja criada", "Link de acesso gerado", "Acesso de suporte iniciado", "Acesso de suporte encerrado".
  - `type AuditEntry = { id: string; action: AuditAction; actorUserId: string | null; storeId: string | null; details: Record<string, string>; createdAt: Date }`.
  - `recordAudit(entry: { actorUserId: string | null; action: AuditAction; storeId: string | null; details?: Record<string, string> }): Promise<void>`.
  - `listAuditLogs(limit?: number): Promise<AuditEntry[]>` (padrão 20, mais novo primeiro).
- Convenção de `details`: `{ actorEmail, storeName, storeSlug }`, uma cópia no momento da ação. O registro sobrevive à exclusão de loja ou usuário, porque as FKs são `set null`.

- [ ] **Step 1: Write the failing test**

`src/modules/audit/service.int.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { listAuditLogs, recordAudit } from "./service";

describe("auditoria", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("grava e lista do mais novo ao mais antigo, e sobrevive à exclusão da loja", async () => {
    await deleteStoreBySlug("audit-loja");
    const admin = await ensureUser({ email: "admin-audit@exemplo.com", password: "senha-forte-123", name: "Admin" });
    const { id: storeId } = await createStore({ slug: "audit-loja", name: "Loja Audit", whatsappPhone: "+5511999990000" });

    await recordAudit({ actorUserId: admin.id, action: "support_session_started", storeId, details: { storeName: "Loja Audit" } });
    await recordAudit({ actorUserId: admin.id, action: "support_session_ended", storeId });

    const [latest, previous] = await listAuditLogs(2);
    expect(latest).toMatchObject({ action: "support_session_ended", actorUserId: admin.id, storeId, details: {} });
    expect(previous).toMatchObject({ action: "support_session_started", details: { storeName: "Loja Audit" } });

    await deleteStoreBySlug("audit-loja");
    const [afterDelete] = await listAuditLogs(1);
    expect(afterDelete).toMatchObject({ action: "support_session_ended", storeId: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- src/modules/audit`
Expected: FAIL

- [ ] **Step 3: Implement**

`src/modules/audit/types.ts`:

```ts
export const AUDIT_ACTIONS = ["store_created", "invite_link_created", "support_session_started", "support_session_ended"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LABELS: Record<AuditAction, string> = {
  store_created: "Loja criada",
  invite_link_created: "Link de acesso gerado",
  support_session_started: "Acesso de suporte iniciado",
  support_session_ended: "Acesso de suporte encerrado",
};
```

`src/modules/audit/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { stores } from "../stores/schema";
import { AUDIT_ACTIONS } from "./types";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    details: jsonb("details").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_at_idx").on(t.createdAt)],
);
```

`src/modules/audit/service.ts`:

```ts
import { desc } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { auditLogs } from "./schema";
import type { AuditAction } from "./types";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  storeId: string | null;
  details: Record<string, string>;
  createdAt: Date;
};

export async function recordAudit(entry: {
  actorUserId: string | null;
  action: AuditAction;
  storeId: string | null;
  details?: Record<string, string>;
}): Promise<void> {
  await db.insert(auditLogs).values({ ...entry, details: entry.details ?? {} });
}

export async function listAuditLogs(limit = 20): Promise<AuditEntry[]> {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}
```

`src/modules/audit/index.ts`:

```ts
export * from "./types";
export { listAuditLogs, recordAudit, type AuditEntry } from "./service";
```

Run: `npm run db:generate` (espere só `CREATE TABLE "audit_logs"` + FKs + índice) e depois `npm run db:migrate`.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:int -- src/modules/audit && npm run typecheck && npm run lint`
Expected: PASS

```bash
git add src/modules/audit drizzle
git commit -m "feat: audit log for super-admin actions"
```

---

### Task 4: Tela `/admin` (lojas, criar a partir de template, links de acesso)

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/actions.ts`
- Create: `src/app/admin/_components/create-store-form.tsx`, `src/app/admin/_components/invite-link.tsx`, `src/app/admin/_components/new-link-form.tsx`

**Interfaces:**
- Consumes:
  - `requireSuperAdmin` (`@/modules/auth`).
  - `createStoreFromTemplate`, `STORE_TEMPLATES`, `TEMPLATE_LABELS` (`@/modules/onboarding`).
  - `listStoresForAdmin`, `createStoreInvite`, `getStoreById`, `storeMenuTag` (`@/modules/stores`).
  - `recordAudit`, `listAuditLogs`, `AUDIT_LABELS` (`@/modules/audit`).
  - `actionError`, `ActionState` (`@/app/_lib/action-state`); `FieldError`, `SubmitButton` (`@/app/_components/form-controls`); `inputClass`, `secondaryButtonClass`.
- Produces:
  - `type AdminLinkState = ActionState | { status: "link"; message: string; inviteUrl: string | null }`.
  - `createStoreAction(prev: AdminLinkState, form: FormData): Promise<AdminLinkState>` e `newInviteLinkAction(prev: AdminLinkState, form: FormData): Promise<AdminLinkState>` (campos `storeId`, `email`).
  - `startSupportAction(form: FormData): Promise<void>` é da Task 5. A página desta task já renderiza o botão "Acessar como loja" num `<form action={startSupportAction}>`; crie a action como stub `async function startSupportAction(_form: FormData) { await requireSuperAdmin(); }` em `actions.ts`, e a Task 5 a completa.
- Copy:
  - `h1` "Painel do super-admin" (o E2E de auth usa).
  - Seção "Nova loja", com campos "Nome da loja", "Endereço (slug)", "WhatsApp da loja", "Email do dono", "Modelo de cardápio" e botão "Criar loja".
  - Após criar: mensagem "Loja criada." e campo somente leitura "Link de acesso". Se o dono já tinha conta: "Loja criada e vinculada à conta existente do dono."
  - Seção "Lojas": tabela Loja / Endereço / Dono / Ações. Na coluna "Dono": o email; ou "Convite pendente: <email> (até dd/mm)"; ou "Sem dono".
  - Ações: botão "Gerar link de acesso" e botão "Acessar como loja" (desabilitado sem dono).
  - Seção "Registro de suporte": lista com data/hora, rótulo da ação, `details.storeName` e `details.actorEmail`. Sem registros: "Nenhum registro ainda."

- [ ] **Step 1: Write actions**

`src/app/admin/actions.ts`:

```ts
"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/modules/audit";
import { requireSuperAdmin } from "@/modules/auth";
import { createStoreFromTemplate } from "@/modules/onboarding";
import { createStoreInvite, getStoreById, storeMenuTag } from "@/modules/stores";
import { getEnv } from "@/shared/env";
import { actionError, type ActionState } from "@/app/_lib/action-state";

export type AdminLinkState = ActionState | { status: "link"; message: string; inviteUrl: string | null };

function inviteUrl(token: string): string {
  return new URL(`/convite/${token}`, getEnv().BETTER_AUTH_URL).toString();
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

export async function createStoreAction(_prev: AdminLinkState, form: FormData): Promise<AdminLinkState> {
  const admin = await requireSuperAdmin();
  try {
    const result = await createStoreFromTemplate(
      {
        name: text(form, "name"),
        slug: text(form, "slug"),
        whatsapp: text(form, "whatsapp"),
        ownerEmail: text(form, "ownerEmail"),
        template: text(form, "template"),
      },
      admin.id,
    );
    // Visita anterior ao slug pode ter deixado "loja não encontrada" no cache.
    updateTag(storeMenuTag(result.slug));
    await recordAudit({
      actorUserId: admin.id,
      action: "store_created",
      storeId: result.storeId,
      details: { actorEmail: admin.email, storeName: text(form, "name").trim(), storeSlug: result.slug },
    });
    return result.inviteToken
      ? { status: "link", message: "Loja criada.", inviteUrl: inviteUrl(result.inviteToken) }
      : { status: "link", message: "Loja criada e vinculada à conta existente do dono.", inviteUrl: null };
  } catch (error) {
    return actionError(error);
  }
}

export async function newInviteLinkAction(_prev: AdminLinkState, form: FormData): Promise<AdminLinkState> {
  const admin = await requireSuperAdmin();
  const storeId = z.uuid().safeParse(text(form, "storeId"));
  if (!storeId.success) return { status: "error", message: "Loja inválida.", fieldErrors: {} };
  const store = await getStoreById(storeId.data);
  if (!store) return { status: "error", message: "Loja não encontrada.", fieldErrors: {} };

  try {
    const { token } = await createStoreInvite(store.id, text(form, "email"), admin.id);
    await recordAudit({
      actorUserId: admin.id,
      action: "invite_link_created",
      storeId: store.id,
      details: { actorEmail: admin.email, storeName: store.name, storeSlug: store.slug },
    });
    return { status: "link", message: "Novo link gerado. Os anteriores deixaram de valer.", inviteUrl: inviteUrl(token) };
  } catch (error) {
    return actionError(error);
  }
}

export async function startSupportAction(_form: FormData): Promise<void> {
  await requireSuperAdmin();
  // Task 5 completa.
}
```

O comentário `// Task 5 completa.` é provisório e sai na Task 5.

- [ ] **Step 2: Write client components**

`src/app/admin/_components/invite-link.tsx`:

```tsx
"use client";

import { useState } from "react";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        Link de acesso
        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className={inputClass} />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={copy} className={secondaryButtonClass}>
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <span className="text-neutral-700 dark:text-neutral-300">Vale por 7 dias e uma vez só. Envie ao dono pelo WhatsApp.</span>
      </div>
    </div>
  );
}
```

`src/app/admin/_components/create-store-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { FieldError, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { createStoreAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

type Props = { templates: { value: string; label: string }[] };

export function CreateStoreForm({ templates }: Props) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(createStoreAction, { status: "idle" });
  const fieldState = state.status === "link" ? ({ status: "idle" } as const) : state;

  return (
    <form action={formAction} aria-label="Nova loja" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nome da loja
          <input name="name" required maxLength={120} className={inputClass} />
          <FieldError state={fieldState} name="name" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Endereço (slug)
          <input name="slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="pizzaria-do-joao" className={inputClass} />
          <FieldError state={fieldState} name="slug" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          WhatsApp da loja
          <input name="whatsapp" required inputMode="tel" placeholder="(11) 99999-9999" className={inputClass} />
          <FieldError state={fieldState} name="whatsapp" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email do dono
          <input name="ownerEmail" type="email" required className={inputClass} />
          <FieldError state={fieldState} name="ownerEmail" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Modelo de cardápio
          <select name="template" required defaultValue="pizzaria" className={inputClass}>
            {templates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </select>
          <FieldError state={fieldState} name="template" />
        </label>
      </div>
      <div>
        <SubmitButton pendingText="Criando...">Criar loja</SubmitButton>
      </div>
      {state.status !== "idle" && (
        <p role="status" className={state.status === "error" ? "text-sm text-red-700 dark:text-red-400" : "text-sm text-green-800 dark:text-green-300"}>
          {state.message}
        </p>
      )}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
```

`src/app/admin/_components/new-link-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/_components/form-controls";
import { newInviteLinkAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

export function NewLinkForm({ storeId, email }: { storeId: string; email: string }) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(newInviteLinkAction, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="email" value={email} />
      <SubmitButton pendingText="Gerando...">Gerar link de acesso</SubmitButton>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.message}</p>}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

`src/app/admin/page.tsx`:

```tsx
import { Suspense } from "react";
import { AUDIT_LABELS, listAuditLogs } from "@/modules/audit";
import { requireSuperAdmin } from "@/modules/auth";
import { STORE_TEMPLATES, TEMPLATE_LABELS } from "@/modules/onboarding";
import { listStoresForAdmin } from "@/modules/stores";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { secondaryButtonClass } from "@/app/_components/styles";
import { startSupportAction } from "./actions";
import { CreateStoreForm } from "./_components/create-store-form";
import { NewLinkForm } from "./_components/new-link-form";

const TIME_ZONE = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const sectionClass = "flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

async function AdminContent() {
  const admin = await requireSuperAdmin();
  const [stores, logs] = await Promise.all([listStoresForAdmin(), listAuditLogs(20)]);
  const templates = STORE_TEMPLATES.map((value) => ({ value, label: TEMPLATE_LABELS[value] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">Olá, {admin.name}.</p>
        <SignOutButton />
      </div>

      <section aria-label="Nova loja" className={sectionClass}>
        <h2 className="text-lg font-semibold">Nova loja</h2>
        <CreateStoreForm templates={templates} />
      </section>

      <section aria-label="Lojas" className={sectionClass}>
        <h2 className="text-lg font-semibold">Lojas</h2>
        {stores.length === 0 ? (
          <p className="text-sm">Nenhuma loja ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-2 pr-3">Loja</th>
                  <th className="py-2 pr-3">Endereço</th>
                  <th className="py-2 pr-3">Dono</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => {
                  const linkEmail = store.ownerEmail ?? store.pendingInvite?.email ?? null;
                  return (
                    <tr key={store.id} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                      <td className="py-2 pr-3 font-medium">{store.name}</td>
                      <td className="py-2 pr-3">
                        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="underline">
                          /{store.slug}
                        </a>
                      </td>
                      <td className="py-2 pr-3">
                        {store.ownerEmail ??
                          (store.pendingInvite
                            ? `Convite pendente: ${store.pendingInvite.email} (até ${dayMonth.format(store.pendingInvite.expiresAt)})`
                            : "Sem dono")}
                      </td>
                      <td className="flex flex-col gap-2 py-2">
                        <form action={startSupportAction}>
                          <input type="hidden" name="storeId" value={store.id} />
                          <button type="submit" disabled={!store.ownerEmail} className={secondaryButtonClass}>
                            Acessar como loja
                          </button>
                        </form>
                        {linkEmail && <NewLinkForm storeId={store.id} email={linkEmail} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Registro de suporte" className={sectionClass}>
        <h2 className="text-lg font-semibold">Registro de suporte</h2>
        {logs.length === 0 ? (
          <p className="text-sm">Nenhum registro ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {logs.map((log) => (
              <li key={log.id}>
                <span className="tabular-nums">{dateTime.format(log.createdAt)}</span> · {AUDIT_LABELS[log.action]}
                {log.details.storeName ? ` · ${log.details.storeName}` : ""}
                {log.details.actorEmail ? ` · por ${log.details.actorEmail}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Painel do super-admin</h1>
      <Suspense fallback={<p className="text-sm text-neutral-700 dark:text-neutral-300">Carregando...</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

```bash
git add src/app/admin
git commit -m "feat: super-admin store list, template store creation and access links"
```

---

### Task 5: Página do convite e "Acessar como loja"

**Files:**
- Create: `src/modules/auth/session.ts`; Modify: `src/modules/auth/guards.ts`, `src/modules/auth/index.ts`
- Create: `src/app/convite/[token]/page.tsx`, `src/app/convite/[token]/actions.ts`, `src/app/convite/[token]/_components/accept-form.tsx`
- Modify: `src/app/login/page.tsx` (dica)
- Modify: `src/app/admin/actions.ts` (`startSupportAction` de verdade)
- Create: `src/app/painel/support-actions.ts`, `src/app/painel/_components/support-banner.tsx`; Modify: `src/app/painel/layout.tsx`

**Interfaces:**
- Produces (via `@/modules/auth`):
  - `SessionUser` ganha `impersonatedBy: string | null`.
  - `signInWithPassword(email: string, password: string): Promise<void>`, `startImpersonation(userId: string): Promise<void>`, `stopImpersonation(): Promise<void>`. Usam `headers()`; o plugin `nextCookies` grava os cookies na Server Action.
- Produces (app):
  - `acceptInviteAction(token: string, prev: ActionState, form: FormData): Promise<ActionState>`. Campos `name` (só conta nova), `password`, `confirm`.
  - `startSupportAction(form: FormData)` (campo `storeId`) e `stopSupportAction(): Promise<void>`.
- Comportamento:
  - `startSupportAction`: `requireSuperAdmin()` → `storeId` uuid → loja existe → dono existe (senão retorna sem fazer nada) → `recordAudit(support_session_started, { actorEmail, storeName, storeSlug })` → `startImpersonation(ownerId)` → `redirect("/painel")`.
  - `stopSupportAction`: `requireUser()`; sem `impersonatedBy` → `redirect("/painel")`. Senão: `recordAudit({ actorUserId: impersonatedBy, action: "support_session_ended", storeId, details: { storeName, storeSlug } })` → `stopImpersonation()` → `redirect("/admin")`.
  - `/convite/[token]`:
    - Token inválido → `h1` "Link inválido ou expirado." + "Peça um novo link ao suporte do Naquela Mesa."
    - Token válido → `h1` "Acesso à <loja>", email somente leitura, "Seu nome" (só se `!hasAccount`), "Senha", "Confirmar senha" e botão "Criar acesso" (ou "Definir nova senha" se `hasAccount`).
    - Senhas diferentes → erro no campo `confirm`: "as senhas não conferem".
    - Sucesso → login automático e `redirect("/painel")`.
    - Link usado ou expirado durante o envio → "Este link expirou ou já foi usado. Peça um novo link ao suporte."
  - Faixa do painel: "Modo suporte: você está vendo o painel da <loja>." + botão "Sair do modo suporte".
  - Login: texto "Esqueceu a senha? Peça ao suporte um novo link de acesso."

- [ ] **Step 1: Auth session helpers**

`src/modules/auth/session.ts`:

```ts
import { headers } from "next/headers";
import { auth } from "./auth";

/** Login no servidor (Server Action): o plugin nextCookies grava o cookie da sessão. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
}

/** Sessão do super-admin vira a do dono (plugin admin); a original volta em stopImpersonation. */
export async function startImpersonation(userId: string): Promise<void> {
  await auth.api.impersonateUser({ body: { userId }, headers: await headers() });
}

export async function stopImpersonation(): Promise<void> {
  await auth.api.stopImpersonating({ headers: await headers() });
}
```

Em `src/modules/auth/guards.ts`, troque `SessionUser` e `getCurrentUser` por:

```ts
export type SessionUser = { id: string; email: string; name: string; role: string | null; impersonatedBy: string | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role: role ?? null, impersonatedBy: session.session.impersonatedBy ?? null };
}
```

Em `src/modules/auth/index.ts`, acrescente:

```ts
export { signInWithPassword, startImpersonation, stopImpersonation } from "./session";
```

Run: `npm run typecheck`. Se algum teste ou mock montar `SessionUser` sem `impersonatedBy`, acrescente `impersonatedBy: null`.

- [ ] **Step 2: Invite page**

`src/app/convite/[token]/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { signInWithPassword } from "@/modules/auth";
import { acceptStoreInvite } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { actionError, fieldError, type ActionState } from "@/app/_lib/action-state";

export async function acceptInviteAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return fieldError("confirm", "as senhas não conferem");
  const name = form.has("name") ? String(form.get("name")) : null;

  let email: string;
  try {
    ({ email } = await acceptStoreInvite(token, { name, password }));
  } catch (error) {
    if (isDomainError(error) && error.code === "NOT_FOUND") {
      return { status: "error", message: "Este link expirou ou já foi usado. Peça um novo link ao suporte.", fieldErrors: {} };
    }
    return actionError(error);
  }
  await signInWithPassword(email, password);
  redirect("/painel");
}
```

`src/app/convite/[token]/_components/accept-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState, type ActionState } from "@/app/_lib/action-state";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  email: string;
  hasAccount: boolean;
};

export function AcceptForm({ action, email, hasAccount }: Props) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input value={email} readOnly className={inputClass} />
      </label>
      {!hasAccount && (
        <label className="flex flex-col gap-1 text-sm">
          Seu nome
          <input name="name" required maxLength={80} autoComplete="name" className={inputClass} />
          <FieldError state={state} name="name" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <FieldError state={state} name="password" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirmar senha
        <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <FieldError state={state} name="confirm" />
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando...">{hasAccount ? "Definir nova senha" : "Criar acesso"}</SubmitButton>
    </form>
  );
}
```

`src/app/convite/[token]/page.tsx`:

```tsx
import { Suspense } from "react";
import { getInvite } from "@/modules/stores";
import { acceptInviteAction } from "./actions";
import { AcceptForm } from "./_components/accept-form";

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvite(token);

  if (!invite) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Link inválido ou expirado.</h1>
        <p className="text-neutral-700 dark:text-neutral-300">Peça um novo link ao suporte do Naquela Mesa.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Acesso à {invite.storeName}</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {invite.hasAccount ? "Defina uma nova senha para entrar no painel." : "Crie sua senha para entrar no painel da loja."}
      </p>
      <AcceptForm action={acceptInviteAction.bind(null, token)} email={invite.email} hasAccount={invite.hasAccount} />
    </>
  );
}

export default function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <Suspense fallback={<p>Carregando...</p>}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}
```

Leia `node_modules/next/dist/docs/` sobre páginas que leem dados por request com `cacheComponents`. `getInvite` lê o banco a cada request. Se o build reclamar de dado não cacheado fora de Suspense ou de prerender, chame `await connection()` (de `next/server`) no início de `Invite`. É o mesmo padrão já usado no projeto para leituras dinâmicas.

Em `src/app/login/page.tsx`, depois de `<Suspense fallback={null}><LoginForm /></Suspense>`, acrescente:

```tsx
      <p className="text-sm text-neutral-700 dark:text-neutral-300">Esqueceu a senha? Peça ao suporte um novo link de acesso.</p>
```

- [ ] **Step 3: Support session actions and banner**

Em `src/app/admin/actions.ts`, acrescente os imports `import { redirect } from "next/navigation";`, `getStoreOwnerUserId` (de `@/modules/stores`) e `startImpersonation` (de `@/modules/auth`). Troque o stub por:

```ts
export async function startSupportAction(form: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const storeId = z.uuid().safeParse(text(form, "storeId"));
  if (!storeId.success) return;
  const store = await getStoreById(storeId.data);
  const ownerId = store ? await getStoreOwnerUserId(store.id) : null;
  if (!store || !ownerId) return;

  // Registra antes de trocar a sessão: o acesso fica auditado mesmo se a troca falhar depois.
  await recordAudit({
    actorUserId: admin.id,
    action: "support_session_started",
    storeId: store.id,
    details: { actorEmail: admin.email, storeName: store.name, storeSlug: store.slug },
  });
  await startImpersonation(ownerId);
  redirect("/painel");
}
```

`src/app/painel/support-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/modules/audit";
import { requireUser, stopImpersonation } from "@/modules/auth";
import { getMembershipStoreId, getStoreById } from "@/modules/stores";

export async function stopSupportAction(): Promise<void> {
  const user = await requireUser();
  if (!user.impersonatedBy) redirect("/painel");

  const storeId = await getMembershipStoreId(user.id);
  const store = storeId ? await getStoreById(storeId) : null;
  await recordAudit({
    actorUserId: user.impersonatedBy,
    action: "support_session_ended",
    storeId: store?.id ?? null,
    details: store ? { storeName: store.name, storeSlug: store.slug } : {},
  });
  await stopImpersonation();
  redirect("/admin");
}
```

`src/app/painel/_components/support-banner.tsx`:

```tsx
import { stopSupportAction } from "@/app/painel/support-actions";

export function SupportBanner({ storeName }: { storeName: string }) {
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950 print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <span>Modo suporte: você está vendo o painel da {storeName}.</span>
        <form action={stopSupportAction}>
          <button type="submit" className="rounded border border-amber-900 px-3 py-1 font-medium">
            Sair do modo suporte
          </button>
        </form>
      </div>
    </div>
  );
}
```

Em `src/app/painel/layout.tsx`:
- importe `SupportBanner`;
- em `PainelHeader`, troque `const { store } = await requireStoreAccess();` por `const { store, user } = await requireStoreAccess();`;
- envolva o retorno num fragmento com a faixa no topo:

```tsx
  return (
    <>
      {user.impersonatedBy && <SupportBanner storeName={store.name} />}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {/* ... conteúdo atual sem mudança ... */}
      </div>
    </>
  );
```

O comentário `{/* ... */}` acima só indica "mantenha o conteúdo atual"; não o copie.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int -- src/modules/auth src/modules/stores`
Expected: PASS

Smoke manual (porta 3001; mate só o seu PID):
- `PORT=3001 npm run dev`.
- Como super-admin: crie uma loja em `/admin`, copie o link e abra-o numa janela anônima.
- Defina a senha e confira que cai em `/painel`.
- De volta ao admin, "Acessar como loja" → faixa "Modo suporte" → "Sair do modo suporte" → `/admin` com os dois registros.

```bash
git add src/modules/auth src/app/convite src/app/login src/app/admin src/app/painel
git commit -m "feat: owner invite page and audited support access to a store panel"
```

---

### Task 6: Checklist de primeiros passos no painel

**Files:**
- Create: `src/modules/onboarding/checklist.ts`, `src/modules/onboarding/checklist.test.ts`, `src/modules/onboarding/checklist-service.ts`
- Modify: `src/modules/onboarding/index.ts`
- Create: `src/app/painel/_components/onboarding-checklist.tsx`; Modify: `src/app/painel/page.tsx`

**Interfaces:**
- Consumes: `Store` (`@/modules/stores`), `getDeliveryZones` (`@/modules/stores`), `getMenu` (`@/modules/catalog`).
- Produces (via `@/modules/onboarding`):
  - `type ChecklistKey = "logo" | "hours" | "delivery" | "pix" | "menu"`; `type ChecklistItem = { key: ChecklistKey; label: string; done: boolean; href: string }`.
  - `buildOnboardingChecklist(input: { logoUrl: string | null; hoursCount: number; deliveryEnabled: boolean; deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" }; zonesCount: number; pixKey: string | null; productCount: number }): ChecklistItem[]`.
  - `getOnboardingChecklist(store: Store): Promise<ChecklistItem[]>`.
- Itens, em ordem:

  | key | label | concluído quando | href |
  |---|---|---|---|
  | `logo` | "Enviar o logo da loja" | `logoUrl !== null` | `/painel/loja` |
  | `hours` | "Cadastrar os horários de funcionamento" | `hoursCount > 0` | `/painel/loja` |
  | `delivery` | "Definir a taxa de entrega ou os bairros atendidos" | `!deliveryEnabled` ou (`fixed` e `fixedCents > 0`) ou (`by_neighborhood` e `zonesCount > 0`) | `/painel/loja` |
  | `pix` | "Cadastrar a chave Pix" | `pixKey !== null` | `/painel/loja` |
  | `menu` | "Conferir o cardápio e os preços" | `productCount > 0` | `/painel/cardapio` |

- UI:
  - Quando falta algum item, aparece no topo de `/painel` uma `section aria-label="Primeiros passos"` com `h2` "Primeiros passos (X de 5)" e a lista. Itens feitos têm "✓ " antes do texto; pendentes são links.
  - Tudo feito → a seção não aparece.

- [ ] **Step 1: Write the failing test**

`src/modules/onboarding/checklist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist } from "./checklist";

const empty = {
  logoUrl: null,
  hoursCount: 0,
  deliveryEnabled: true,
  deliveryFee: { strategy: "fixed" as const, fixedCents: 0 },
  zonesCount: 0,
  pixKey: null,
  productCount: 0,
};

describe("buildOnboardingChecklist", () => {
  it("loja recém-criada tem tudo pendente, na ordem", () => {
    const items = buildOnboardingChecklist(empty);
    expect(items.map((item) => [item.key, item.done])).toEqual([
      ["logo", false],
      ["hours", false],
      ["delivery", false],
      ["pix", false],
      ["menu", false],
    ]);
    expect(items[0]).toEqual({ key: "logo", label: "Enviar o logo da loja", done: false, href: "/painel/loja" });
    expect(items[4]?.href).toBe("/painel/cardapio");
  });

  it("marca cada item conforme a configuração", () => {
    const items = buildOnboardingChecklist({
      ...empty,
      logoUrl: "/uploads/logo.webp",
      hoursCount: 6,
      deliveryFee: { strategy: "fixed", fixedCents: 600 },
      pixKey: "pix@loja.com",
      productCount: 12,
    });
    expect(items.every((item) => item.done)).toBe(true);
  });

  it("entrega: bairros contam quando a taxa é por bairro; sem delivery não pede nada", () => {
    const byZone = { ...empty, deliveryFee: { strategy: "by_neighborhood" as const } };
    expect(buildOnboardingChecklist(byZone)[2]?.done).toBe(false);
    expect(buildOnboardingChecklist({ ...byZone, zonesCount: 3 })[2]?.done).toBe(true);
    expect(buildOnboardingChecklist({ ...empty, deliveryEnabled: false })[2]?.done).toBe(true);
  });
});
```

Run: `npm test -- src/modules/onboarding/checklist.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/modules/onboarding/checklist.ts`:

```ts
export type ChecklistKey = "logo" | "hours" | "delivery" | "pix" | "menu";
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean; href: string };

export type ChecklistInput = {
  logoUrl: string | null;
  hoursCount: number;
  deliveryEnabled: boolean;
  deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" };
  zonesCount: number;
  pixKey: string | null;
  productCount: number;
};

export function buildOnboardingChecklist(input: ChecklistInput): ChecklistItem[] {
  const deliveryDone =
    !input.deliveryEnabled ||
    (input.deliveryFee.strategy === "fixed" ? input.deliveryFee.fixedCents > 0 : input.zonesCount > 0);

  return [
    { key: "logo", label: "Enviar o logo da loja", done: input.logoUrl !== null, href: "/painel/loja" },
    { key: "hours", label: "Cadastrar os horários de funcionamento", done: input.hoursCount > 0, href: "/painel/loja" },
    { key: "delivery", label: "Definir a taxa de entrega ou os bairros atendidos", done: deliveryDone, href: "/painel/loja" },
    { key: "pix", label: "Cadastrar a chave Pix", done: input.pixKey !== null, href: "/painel/loja" },
    { key: "menu", label: "Conferir o cardápio e os preços", done: input.productCount > 0, href: "/painel/cardapio" },
  ];
}
```

`src/modules/onboarding/checklist-service.ts`:

```ts
import { getMenu } from "@/modules/catalog";
import { getDeliveryZones, type Store } from "@/modules/stores";
import { buildOnboardingChecklist, type ChecklistItem } from "./checklist";

export async function getOnboardingChecklist(store: Store): Promise<ChecklistItem[]> {
  const [zones, menu] = await Promise.all([getDeliveryZones(store.id), getMenu(store.id)]);
  return buildOnboardingChecklist({
    logoUrl: store.logoUrl,
    hoursCount: store.hours.length,
    deliveryEnabled: store.features.delivery,
    deliveryFee: store.rules.deliveryFee,
    zonesCount: zones.length,
    pixKey: store.paymentMethods.pixKey,
    productCount: menu.categories.reduce((sum, category) => sum + category.products.length, 0),
  });
}
```

Em `src/modules/onboarding/index.ts`, acrescente:

```ts
export { buildOnboardingChecklist, type ChecklistItem, type ChecklistKey } from "./checklist";
export { getOnboardingChecklist } from "./checklist-service";
```

`src/app/painel/_components/onboarding-checklist.tsx`:

```tsx
import Link from "next/link";
import { getOnboardingChecklist } from "@/modules/onboarding";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export async function OnboardingChecklist() {
  const { store } = await requireStoreAccess();
  const items = await getOnboardingChecklist(store);
  const done = items.filter((item) => item.done).length;
  if (done === items.length) return null;

  return (
    <section aria-label="Primeiros passos" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
      <h2 className="text-lg font-semibold">
        Primeiros passos ({done} de {items.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className="text-amber-900/70 line-through dark:text-amber-100/70">✓ {item.label}</span>
            ) : (
              <Link href={item.href} className="underline">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Em `src/app/painel/page.tsx`, importe `OnboardingChecklist` e o renderize logo abaixo do `h1` "Pedidos", dentro do seu próprio `<Suspense fallback={null}>`:

```tsx
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <Suspense fallback={null}>
        <OnboardingChecklist />
      </Suspense>
```

- [ ] **Step 3: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

```bash
git add src/modules/onboarding src/app/painel
git commit -m "feat: onboarding checklist on the store panel"
```

---

### Task 7: E2E do super-admin, limpeza e README

**Files:**
- Create: `scripts/e2e-cleanup.ts`; Modify: `package.json` (script `e2e:cleanup`), `e2e/global-setup.ts`
- Modify: `playwright.config.ts` (projeto `admin`)
- Create: `e2e/admin.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: telas das Tasks 4–6; `deleteUserByEmail` (`@/modules/auth`); `deleteStoreBySlug` (`@/modules/stores`).
- A loja e o dono do E2E têm nomes fixos (`e2e-hamburgueria`, `dono-e2e@naquelamesa.test`). A limpeza roda no `globalSetup` antes de cada execução, então rodar duas vezes seguidas funciona.

- [ ] **Step 1: Cleanup script and setup**

`scripts/e2e-cleanup.ts`:

```ts
import { deleteUserByEmail } from "@/modules/auth";
import { deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";

export const E2E_STORE_SLUG = "e2e-hamburgueria";
export const E2E_OWNER_EMAIL = "dono-e2e@naquelamesa.test";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("e2e:cleanup não roda com NODE_ENV=production");
  await deleteStoreBySlug(E2E_STORE_SLUG);
  await deleteUserByEmail(E2E_OWNER_EMAIL);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

Em `package.json`, acrescente o script, ao lado de `seed:demo`:

```json
    "e2e:cleanup": "node --env-file-if-exists=.env.local --import tsx scripts/e2e-cleanup.ts",
```

Em `e2e/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

// Banco previsível a cada execução: recria a Pizzaria Demo (e o dono demo) e apaga a loja criada pelo E2E do admin.
export default function globalSetup() {
  execSync("npm run seed:demo", { stdio: "inherit" });
  execSync("npm run e2e:cleanup", { stdio: "inherit" });
}
```

Em `playwright.config.ts`, acrescente o projeto depois de `painel`:

```ts
    { name: "admin", testMatch: ["**/admin.spec.ts"], dependencies: ["painel"], retries: 0, use: { ...devices["Desktop Chrome"] } },
```

- [ ] **Step 2: E2E spec**

`e2e/admin.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@naquelamesa.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-123";
const OWNER_EMAIL = "dono-e2e@naquelamesa.test";

test.describe.configure({ mode: "serial" });

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("super-admin cria loja a partir de template e o dono ativa o acesso", async ({ page, browser }) => {
  await loginAsAdmin(page);
  const form = page.getByRole("form", { name: "Nova loja" });
  await form.getByLabel("Nome da loja").fill("Hamburgueria E2E");
  await form.getByLabel("Endereço (slug)").fill("e2e-hamburgueria");
  await form.getByLabel("WhatsApp da loja").fill("(11) 97777-0000");
  await form.getByLabel("Email do dono").fill(OWNER_EMAIL);
  await form.getByLabel("Modelo de cardápio").selectOption("hamburgueria");
  await form.getByRole("button", { name: "Criar loja" }).click();

  const link = form.getByRole("textbox", { name: "Link de acesso" });
  await expect(link).toHaveValue(/\/convite\/[A-Za-z0-9_-]{43}$/);
  const inviteUrl = await link.inputValue();

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto(inviteUrl);
  await expect(owner.getByRole("heading", { name: "Acesso à Hamburgueria E2E" })).toBeVisible();
  await owner.getByLabel("Seu nome").fill("Dono E2E");
  await owner.getByLabel("Senha", { exact: true }).fill("senha-dono-123");
  await owner.getByLabel("Confirmar senha").fill("senha-dono-123");
  await owner.getByRole("button", { name: "Criar acesso" }).click();
  await expect(owner).toHaveURL(/\/painel$/);
  await expect(owner.getByRole("region", { name: "Primeiros passos" })).toContainText("Primeiros passos (1 de 5)");

  await owner.goto(inviteUrl);
  await expect(owner.getByRole("heading", { name: "Link inválido ou expirado." })).toBeVisible();
  await ownerContext.close();

  await page.goto("/e2e-hamburgueria");
  await expect(page.getByRole("heading", { name: "Hambúrgueres" })).toBeVisible();
});

test("acesso de suporte entra no painel da loja e fica registrado", async ({ page }) => {
  await loginAsAdmin(page);
  const row = page.getByRole("row", { name: /Hamburgueria E2E/ });
  await expect(row).toContainText(OWNER_EMAIL);
  await row.getByRole("button", { name: "Acessar como loja" }).click();

  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Modo suporte: você está vendo o painel da Hamburgueria E2E.")).toBeVisible();
  await page.getByRole("button", { name: "Sair do modo suporte" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  const log = page.getByRole("region", { name: "Registro de suporte" });
  await expect(log).toContainText("Acesso de suporte iniciado · Hamburgueria E2E");
  await expect(log).toContainText("Acesso de suporte encerrado · Hamburgueria E2E");
});

test("link de convite inválido mostra a página de erro", async ({ page }) => {
  await page.goto("/convite/token-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado." })).toBeVisible();
});
```

"Primeiros passos (1 de 5)": a loja do template tem produtos (item `menu` feito); logo, horários, entrega com taxa 0 e Pix estão pendentes. Se o número real for outro, confira contra a tabela da Task 6 antes de mudar o teste.

- [ ] **Step 3: Run E2E**

O super-admin do E2E precisa existir no banco do worktree:

Run: `npm run admin:ensure -- e2e-admin@naquelamesa.test e2e-senha-123 "E2E Admin"`

Run: `PORT=3001 npm run test:e2e`
Expected: 30 anteriores + 3 novos = 33 passando.

Rode de novo: `PORT=3001 npm run test:e2e`. Tem que passar de novo (limpeza do `globalSetup`).

- [ ] **Step 4: README**

Em `README.md`, acrescente a seção:

```markdown
## Super-admin (`/admin`)

- Crie o primeiro super-admin com `make admin EMAIL=voce@exemplo.com SENHA=...`.
- **Nova loja:** nome, endereço (slug), WhatsApp, email do dono e modelo de cardápio (Pizzaria, Hamburgueria ou Lanchonete). O cardápio do modelo já vem cadastrado; o dono ajusta preços e itens.
- **Link de acesso:** aparece na tela depois de criar a loja. Copie e envie ao dono pelo WhatsApp. Vale por 7 dias e uma vez só. O dono define a senha e cai direto no painel. Se o email já tem conta, a loja é vinculada a ela sem link.
- **Esqueceu a senha:** em "Lojas", "Gerar link de acesso" cria um link novo (o anterior deixa de valer); o dono define uma nova senha por ele.
- **Acessar como loja:** abre o painel da loja como se fosse o dono, com a faixa "Modo suporte". Entrada e saída ficam em "Registro de suporte".
- **Primeiros passos:** o painel da loja mostra o que falta configurar (logo, horários, entrega, Pix, cardápio) até tudo estar feito.
```

- [ ] **Step 5: Final checks and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int`
Expected: PASS

```bash
git add scripts/e2e-cleanup.ts package.json e2e playwright.config.ts README.md
git commit -m "test: cover store onboarding and support access end to end"
```
