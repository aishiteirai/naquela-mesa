# F6b Lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Naquela Mesa pronto para produção na Vercel. Concretamente:
- rate limit de verdade em pedidos, login, convites e uploads (bloqueador de lançamento);
- imagens no Vercel Blob;
- erros no Sentry;
- configuração segura de produção;
- pequenos reforços de integridade nos pedidos;
- um roteiro de deploy que o dono do projeto executa (contas, variáveis, domínio).

**Architecture:**
- **Rate limit:** `src/shared/rate-limit.ts` usa Upstash quando há credenciais e memória no desenvolvimento. Em produção na Vercel, as credenciais do Upstash são obrigatórias (o env falha sem elas).
- **Login:** o Better Auth usa o próprio limitador com armazenamento no banco (tabela `rate_limit`). Funciona em serverless sem Redis.
- **Upload:** sai da Server Action e vai para um Route Handler (`/api/painel/upload`). Assim o limite de corpo das Server Actions volta ao padrão (1 MB), inclusive nas públicas.
- **Imagens:** `saveImage` grava no Blob quando há token e em disco no desenvolvimento.
- **Sentry:** via `instrumentation.ts`, ligado só quando há DSN. Erros de domínio esperados não são enviados.
- **Deploy:** `vercel-build` roda as migrações antes do build. `docs/deploy.md` guia o passo a passo.

**Tech Stack:** Next.js 16.4, Better Auth 1.7.7, Drizzle 0.45 + Postgres 17 (Neon em produção), `@upstash/ratelimit` 2.2 + `@upstash/redis` 1.39, `@vercel/blob` 2.8, `@sentry/nextjs` 11.7, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md`:
- §3 (Vercel Blob, Upstash, Sentry)
- §8 `RATE_LIMITED`
- §9 "Rate limit (Upstash): criação de pedido por IP e por telefone; login por IP/email"
- §12 F6 "deploy, domínio"

**Pré-requisito:** a F6a (`2026-10-13-f6a-admin-onboarding.md`) já está na `main`. Esta F6b toca o convite (rate limit, `appUrl`) e o `setUserPassword` criados lá.

## Global Constraints

- **Textos:** interface em português do Brasil.
- **Fronteiras de import:**
  - `src/app/` nunca acessa o banco.
  - Módulos só via `@/modules/<nome>`; `../` proibido em `src/` (exceto `schema.ts`).
  - `src/shared/` não importa módulos.
- **Variáveis de ambiente** (todas validadas em `src/shared/env.ts`):

  | Variável | Obrigatória | Padrão / regra |
  |---|---|---|
  | `DATABASE_URL` | sim | — |
  | `DATABASE_POOL_MAX` | não | 10 (1–50) |
  | `BETTER_AUTH_SECRET` | sim | ≥ 32 caracteres |
  | `BETTER_AUTH_URL` | sim | — |
  | `BETTER_AUTH_TRUSTED_ORIGINS` | não | lista separada por vírgula |
  | `APP_URL` | não | cai em `BETTER_AUTH_URL` |
  | `E2E_DISABLE_RATE_LIMIT` | não | só `"1"`; proibida com `VERCEL_ENV=production` |
  | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | juntas; obrigatórias com `VERCEL_ENV=production` | — |
  | `BLOB_READ_WRITE_TOKEN` | obrigatória com `VERCEL_ENV=production` | — |
  | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | não | — |

- **Limites:**

  | Política | Limite | Chave |
  |---|---|---|
  | `orderByIp` | 10 pedidos / 10 min | IP |
  | `orderByPhone` | 5 pedidos / 10 min | dígitos do telefone |
  | `quoteByIp` | 60 cotações / min | IP |
  | `inviteByIp` | 10 tentativas / 10 min | IP |
  | `uploadByUser` | 30 envios / 10 min | usuário |
  | Login (Better Auth) | 5 / min em `/sign-in/email` | IP |

- **Respostas a limite estourado:**
  - Pedido/cotação → erro `RATE_LIMITED` com a mensagem "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
  - Upload → HTTP 429.
  - Login → mensagem atual "Muitas tentativas. Tente novamente em instantes."
- **IP do cliente:** primeiro item de `x-forwarded-for`, depois `x-real-ip`, senão `"desconhecido"`.
- **Server Actions** voltam ao limite padrão de corpo (sem `experimental.serverActions.bodySizeLimit`). Upload só pelo Route Handler, até `MAX_IMAGE_BYTES` (5 MB).
- **Ambiente:**
  - Worktree `/home/ryan/workspace/personalprojects/ecom-menu-f2`, branch `f6b-lancamento` (criada da `main` com a F6a), banco `naquela_mesa_f2`, porta 3001.
  - Nunca `pkill`; nunca mexer em containers.
  - Nenhuma task acessa Vercel, Neon, Upstash ou Sentry de verdade; integrações externas são testadas com mocks.
- **Commits** terminam com linha em branco + trailer `Co-Authored-By:` do modelo que escreveu.

## Review Focus

1. **Produção sem Upstash ou Blob** (`VERCEL_ENV=production`) → o app recusa subir com mensagem que nomeia a variável. Nunca cai silenciosamente no limitador em memória ou no disco local. Teste: Task 1.
2. **Pedidos em sequência.** O 11º pedido do mesmo IP em 10 min, ou o 6º do mesmo telefone → mensagem "Muitas tentativas…" no checkout, e nenhum pedido criado. Teste: Task 2.
3. **Pedido normal e cliente honesto.** Repetir o mesmo pedido (clique duplo, mesma chave de idempotência) não estoura o limite em uso normal, e o E2E continua passando com `E2E_DISABLE_RATE_LIMIT=1`. Teste: Task 2 e suíte E2E.
4. **Upload sem sessão, de dono de outra loja, ou maior que 5 MB** → 401, 403 ou 413 sem gravar nada. Arquivo que não é imagem → 400 com a mensagem do domínio. Teste: Task 3.
5. **Erros esperados não poluem o Sentry.** `DomainError`, `redirect()` e `notFound()` não são enviados; erro inesperado é enviado. Teste: Task 5.

---

## File Structure

```
src/shared/env.ts (+ env.test.ts)          # novas variáveis, regras de produção, appUrl()
src/shared/db/client.ts                     # Pool max
src/shared/rate-limit.ts (+ rate-limit.test.ts)
src/shared/sentry-filter.ts (+ sentry-filter.test.ts)
src/modules/auth/auth.ts, auth/schema.ts    # rate limit do Better Auth no banco, trustedOrigins
src/modules/auth/users.ts (+ users.int.test.ts)  # ensureSuperAdmin troca senha de conta existente
src/modules/media/images.ts (+ images.test.ts)   # driver Blob
src/modules/orders/service.ts, orders/queue.ts, orders/schema.ts (+ service.int.test.ts)
src/modules/stores/settings-service.ts
src/app/[slug]/sacola/actions.ts, sacola/messages.ts (+ messages.test.ts)
src/app/[slug]/pedido/[token]/page.tsx, src/app/painel/pedidos/_components/order-card.tsx, src/app/admin/actions.ts
src/app/convite/[token]/actions.ts
src/app/api/painel/upload/route.ts, src/app/_components/image-upload-field.tsx, (remove) src/app/painel/upload-action.ts
src/instrumentation.ts, src/instrumentation-client.ts, src/app/global-error.tsx
next.config.ts, drizzle.config.ts, package.json, Makefile, playwright.config.ts, .github/workflows/ci.yml, .env.example
scripts/ensure-super-admin.ts
docs/deploy.md, README.md
drizzle/0010_*.sql, drizzle/0011_*.sql
```

---

### Task 1: Configuração de produção

**Files:**
- Modify: `src/shared/env.ts`, `src/shared/env.test.ts`, `src/shared/db/client.ts`
- Modify: `src/modules/auth/auth.ts`, `src/modules/auth/users.ts`, `src/modules/auth/users.int.test.ts`
- Modify: `scripts/ensure-super-admin.ts`, `Makefile`, `.github/workflows/ci.yml`, `playwright.config.ts`
- Modify (usar `appUrl()`): `src/app/[slug]/sacola/actions.ts`, `src/app/[slug]/pedido/[token]/page.tsx`, `src/app/painel/pedidos/_components/order-card.tsx`, `src/app/admin/actions.ts`
- Modify (`updatedAt` do banco): `src/modules/orders/queue.ts`, `src/modules/stores/settings-service.ts`, `src/modules/auth/users.ts`

**Interfaces:**
- Produces (`@/shared/env`):
  - `Env` com os campos da tabela de Global Constraints. `BETTER_AUTH_TRUSTED_ORIGINS` vira `string[]`; `DATABASE_POOL_MAX` vira `number`.
  - `appUrl(): string` = `APP_URL ?? BETTER_AUTH_URL`.
- `E2E_DISABLE_AUTH_RATE_LIMIT` é renomeada para `E2E_DISABLE_RATE_LIMIT` em todo o repositório (env, auth, Playwright). Na Task 2 ela também desliga o limitador do app.
- `ensureSuperAdmin(input)`:
  - conta nova → cria e promove;
  - conta existente → promove **e troca a senha** (usa `setUserPassword`, da F6a).
  - Retorna `{ id, created }`.
- `scripts/ensure-super-admin.ts` lê a senha de `ADMIN_PASSWORD` (variável de ambiente), não de argumento. Uso: `ADMIN_PASSWORD=... npm run admin:ensure -- <email> [nome]`.

- [ ] **Step 1: Write the failing tests**

Em `src/shared/env.test.ts`:
- troque o primeiro teste por `expect(parseEnv(valid)).toMatchObject(valid);`;
- troque o teste de `E2E_DISABLE_AUTH_RATE_LIMIT` pelo de `E2E_DISABLE_RATE_LIMIT` (mesmo formato);
- acrescente:

```ts
  it("aplica padrões e converte lista de origens", () => {
    const env = parseEnv({ ...valid, BETTER_AUTH_TRUSTED_ORIGINS: "https://a.vercel.app, https://b.vercel.app ,", DATABASE_POOL_MAX: "3" });
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toEqual(["https://a.vercel.app", "https://b.vercel.app"]);
    expect(env.DATABASE_POOL_MAX).toBe(3);
    expect(parseEnv(valid).DATABASE_POOL_MAX).toBe(10);
    expect(parseEnv(valid).BETTER_AUTH_TRUSTED_ORIGINS).toEqual([]);
    expect(() => parseEnv({ ...valid, DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
  });

  it("exige URL e token do Upstash juntos", () => {
    expect(() => parseEnv({ ...valid, UPSTASH_REDIS_REST_URL: "https://x.upstash.io" })).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("em produção exige Upstash e Blob e proíbe o atalho do E2E", () => {
    const production = {
      ...valid,
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    };
    expect(parseEnv(production).VERCEL_ENV).toBe("production");

    const noRedis: Record<string, string> = { ...production };
    delete noRedis.UPSTASH_REDIS_REST_URL;
    delete noRedis.UPSTASH_REDIS_REST_TOKEN;
    expect(() => parseEnv(noRedis)).toThrow(/UPSTASH_REDIS_REST_URL/);

    const noBlob: Record<string, string> = { ...production };
    delete noBlob.BLOB_READ_WRITE_TOKEN;
    expect(() => parseEnv(noBlob)).toThrow(/BLOB_READ_WRITE_TOKEN/);

    expect(() => parseEnv({ ...production, E2E_DISABLE_RATE_LIMIT: "1" })).toThrow(/E2E_DISABLE_RATE_LIMIT/);
    // Preview pode rodar sem Blob/Upstash (cai no disco/memória).
    expect(parseEnv({ ...valid, VERCEL_ENV: "preview" }).VERCEL_ENV).toBe("preview");
  });
```

Em `src/modules/auth/users.int.test.ts`, acrescente (reaproveite o helper `passwordWorks` do arquivo e importe `ensureSuperAdmin`):

```ts
  it("ensureSuperAdmin promove e troca a senha de conta existente", async () => {
    await deleteUserByEmail("vira-admin@exemplo.com");
    await ensureUser({ email: "vira-admin@exemplo.com", password: "senha-antiga-1", name: "Futuro Admin" });

    const result = await ensureSuperAdmin({ email: "vira-admin@exemplo.com", password: "senha-nova-123", name: "Ignorado" });
    expect(result.created).toBe(false);
    expect(await passwordWorks("vira-admin@exemplo.com", "senha-nova-123")).toBe(true);
    expect(await passwordWorks("vira-admin@exemplo.com", "senha-antiga-1")).toBe(false);
    await deleteUserByEmail("vira-admin@exemplo.com");
  });
```

Run: `npm test -- src/shared/env.test.ts && npm run test:int -- src/modules/auth/users.int.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement env**

`src/shared/env.ts`:

```ts
import { z } from "zod";

const optionalText = z.string().min(1).optional();

const envSchema = z
  .object({
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    BETTER_AUTH_SECRET: z.string().min(32, "precisa ter ao menos 32 caracteres"),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .optional()
      .transform((value) => (value ? value.split(",").map((origin) => origin.trim()).filter(Boolean) : [])),
    APP_URL: z.url().optional(),
    E2E_DISABLE_RATE_LIMIT: z.literal("1").optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: optionalText,
    BLOB_READ_WRITE_TOKEN: optionalText,
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
      const missing = env.UPSTASH_REDIS_REST_URL ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL";
      ctx.addIssue({ code: "custom", path: [missing], message: "defina URL e token do Upstash juntos" });
    }
    if (env.VERCEL_ENV !== "production") return;
    // Em produção serverless, limitador em memória e disco local não funcionam: falha cedo.
    if (!env.UPSTASH_REDIS_REST_URL) ctx.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_URL"], message: "obrigatória em produção" });
    if (!env.BLOB_READ_WRITE_TOKEN) ctx.addIssue({ code: "custom", path: ["BLOB_READ_WRITE_TOKEN"], message: "obrigatória em produção" });
    if (env.E2E_DISABLE_RATE_LIMIT) ctx.addIssue({ code: "custom", path: ["E2E_DISABLE_RATE_LIMIT"], message: "proibida em produção" });
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Variáveis de ambiente inválidas: ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** URL pública do app (links de acompanhamento e convite). */
export function appUrl(): string {
  const env = getEnv();
  return env.APP_URL ?? env.BETTER_AUTH_URL;
}
```

`src/shared/db/client.ts`: `new Pool({ connectionString: getEnv().DATABASE_URL, max: getEnv().DATABASE_POOL_MAX })`.

`src/modules/auth/auth.ts`:
- troque a linha do `E2E_DISABLE_AUTH_RATE_LIMIT` para usar `E2E_DISABLE_RATE_LIMIT`;
- acrescente `trustedOrigins: getEnv().BETTER_AUTH_TRUSTED_ORIGINS,` logo depois de `baseURL`.

A Task 2 mexe de novo no `rateLimit`.

Troque `getEnv().BETTER_AUTH_URL` por `appUrl()` (import de `@/shared/env`) nos 4 arquivos de app listados.

- [ ] **Step 3: Rename the E2E flag**

Run: `grep -rn "E2E_DISABLE_AUTH_RATE_LIMIT" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs .`
Troque cada ocorrência (fora de `docs/`) por `E2E_DISABLE_RATE_LIMIT`. Deve sobrar só `playwright.config.ts` (e `env`/`auth`, já feitos).

- [ ] **Step 4: `updatedAt` pelo relógio do banco**

Com várias instâncias serverless, o relógio de cada uma pode divergir. A versão da fila (`max(updated_at)`) precisa de um relógio só. Troque `updatedAt: new Date()` por `updatedAt: sql\`now()\`` em:
- `src/modules/orders/queue.ts` (`transitionOrder`);
- `src/modules/stores/settings-service.ts`;
- `src/modules/auth/users.ts` (`ensureSuperAdmin`).

Importe `sql` de `drizzle-orm` onde faltar.

- [ ] **Step 5: `ensureSuperAdmin` and script**

Em `src/modules/auth/users.ts`:

```ts
export async function ensureSuperAdmin(input: EnsureSuperAdminInput): Promise<{ id: string; created: boolean }> {
  const result = await ensureUser(input);
  // Conta existente: a senha informada passa a valer (antes era ignorada sem aviso).
  if (!result.created) await setUserPassword(result.id, input.password);
  await db.update(user).set({ role: SUPER_ADMIN_ROLE, updatedAt: sql`now()` }).where(eq(user.id, result.id));
  return result;
}
```

`scripts/ensure-super-admin.ts`:

```ts
import { ensureSuperAdmin } from "@/modules/auth";
import { pool } from "@/shared/db/client";

async function main() {
  const [email, name = "Super Admin"] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Uso: ADMIN_PASSWORD=<senha> npm run admin:ensure -- <email> [nome]");
    process.exitCode = 1;
    return;
  }
  const result = await ensureSuperAdmin({ email, password, name });
  console.log(result.created ? `Super-admin criado: ${email}` : `Usuário promovido a super-admin (senha atualizada): ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
```

No `Makefile`:
- alvo `admin`: troque a linha do `npm run` por `ADMIN_PASSWORD="$(SENHA)" npm run admin:ensure -- "$(EMAIL)" "$(or $(NOME),Super Admin)"`;
- alvo `e2e`: `ADMIN_PASSWORD=e2e-senha-123 npm run admin:ensure -- e2e-admin@naquelamesa.test "E2E Admin"`.

Em `.github/workflows/ci.yml`, passo do admin: `- run: ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" npm run admin:ensure -- "$E2E_ADMIN_EMAIL" "E2E Admin"`.

Em `README.md` e na seção "Super-admin", ajuste exemplos que passem senha como argumento do `admin:ensure`.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int`
Expected: PASS

```bash
git add -A src scripts Makefile .github playwright.config.ts README.md
git commit -m "feat: production-safe env validation, app URL and admin password handling"
```

---

### Task 2: Rate limit

**Files:**
- Modify: `package.json` (deps `@upstash/ratelimit@^2.2.0`, `@upstash/redis@^1.39.0`)
- Create: `src/shared/rate-limit.ts`, `src/shared/rate-limit.test.ts`
- Modify: `src/modules/auth/schema.ts` (tabela `rate_limit`), `src/modules/auth/auth.ts`
- Create (gerado): `drizzle/0010_*.sql`
- Modify: `src/app/[slug]/sacola/actions.ts`, `src/app/[slug]/sacola/messages.ts`, `src/app/[slug]/sacola/messages.test.ts`
- Modify: `src/app/convite/[token]/actions.ts`

**Interfaces:**
- Produces (`@/shared/rate-limit`):
  - `type RateLimitPolicy = { name: string; limit: number; windowSec: number }`.
  - `RATE_LIMITS` (valores da tabela de Global Constraints): `orderByIp`, `orderByPhone`, `quoteByIp`, `inviteByIp`, `uploadByUser`.
  - `type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }`.
  - `interface RateLimiter { check(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult> }`.
  - `createMemoryRateLimiter(now?: () => number): RateLimiter` (janela fixa).
  - `createUpstashRateLimiter(url: string, token: string): RateLimiter` (janela deslizante).
  - `getRateLimiter(): RateLimiter`:
    - com `E2E_DISABLE_RATE_LIMIT=1`, sempre libera;
    - com Upstash configurado, usa o Upstash;
    - senão, memória (uma instância por processo).
  - `enforceRateLimit(policy, identifier, limiter?: RateLimiter): Promise<void>`, que lança `DomainError("RATE_LIMITED", { retryAfterSec })`.
  - `clientIp(headers: Headers): string`.
- `toCheckoutError` trata `RATE_LIMITED`.
- Login: o Better Auth limita com armazenamento `database`; a tabela `rate_limit` é do módulo auth.

- [ ] **Step 1: Write the failing tests**

`src/shared/rate-limit.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { clientIp, createMemoryRateLimiter, enforceRateLimit, type RateLimitPolicy } from "./rate-limit";

const policy: RateLimitPolicy = { name: "teste", limit: 2, windowSec: 60 };

describe("createMemoryRateLimiter", () => {
  it("libera até o limite, bloqueia depois e reabre na janela seguinte", async () => {
    let now = 1_000_000;
    const limiter = createMemoryRateLimiter(() => now);

    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: false, retryAfterSec: 60 });
    expect(await limiter.check(policy, "ip-2")).toEqual({ ok: true });

    now += 30_000;
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: false, retryAfterSec: 30 });
    now += 30_000;
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
  });

  it("separa políticas com o mesmo identificador", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    const other: RateLimitPolicy = { name: "outra", limit: 1, windowSec: 60 };
    await limiter.check(policy, "x");
    await limiter.check(policy, "x");
    expect(await limiter.check(other, "x")).toEqual({ ok: true });
  });
});

describe("enforceRateLimit", () => {
  afterEach(() => {
    delete process.env.E2E_DISABLE_RATE_LIMIT;
  });

  it("lança RATE_LIMITED com o tempo de espera", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    await enforceRateLimit(policy, "y", limiter);
    await enforceRateLimit(policy, "y", limiter);
    await expect(enforceRateLimit(policy, "y", limiter)).rejects.toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSec: 60 } });
  });
});

describe("clientIp", () => {
  it("usa o primeiro x-forwarded-for, depois x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("desconhecido");
  });
});
```

Em `src/app/[slug]/sacola/messages.test.ts`, acrescente (siga o estilo de import já usado no arquivo):

```ts
  it("traduz RATE_LIMITED", () => {
    expect(toCheckoutError(new DomainError("RATE_LIMITED", { retryAfterSec: 120 }))).toEqual({
      code: "RATE_LIMITED",
      message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
      fieldErrors: {},
    });
  });
```

Run: `npm test -- src/shared/rate-limit.test.ts 'src/app/[slug]/sacola/messages.test.ts'` → FAIL.

- [ ] **Step 2: Implement the limiter**

Run: `npm install @upstash/ratelimit@^2.2.0 @upstash/redis@^1.39.0`

`src/shared/rate-limit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv } from "@/shared/env";
import { DomainError } from "@/shared/errors";

export type RateLimitPolicy = { name: string; limit: number; windowSec: number };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };
export interface RateLimiter {
  check(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult>;
}

export const RATE_LIMITS = {
  orderByIp: { name: "order-ip", limit: 10, windowSec: 600 },
  orderByPhone: { name: "order-phone", limit: 5, windowSec: 600 },
  quoteByIp: { name: "quote-ip", limit: 60, windowSec: 60 },
  inviteByIp: { name: "invite-ip", limit: 10, windowSec: 600 },
  uploadByUser: { name: "upload-user", limit: 30, windowSec: 600 },
} as const satisfies Record<string, RateLimitPolicy>;

/** Janela fixa em memória: só para desenvolvimento e testes (em serverless cada instância teria a sua). */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async check(policy, identifier) {
      const key = `${policy.name}:${identifier}`;
      const current = now();
      let window = windows.get(key);
      if (!window || current >= window.resetAt) {
        window = { count: 0, resetAt: current + policy.windowSec * 1000 };
        windows.set(key, window);
      }
      window.count += 1;
      if (window.count <= policy.limit) return { ok: true };
      return { ok: false, retryAfterSec: Math.ceil((window.resetAt - current) / 1000) };
    },
  };
}

export function createUpstashRateLimiter(url: string, token: string): RateLimiter {
  const redis = new Redis({ url, token });
  const limiters = new Map<string, Ratelimit>();
  return {
    async check(policy, identifier) {
      let limiter = limiters.get(policy.name);
      if (!limiter) {
        limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSec} s`), prefix: `nm:${policy.name}` });
        limiters.set(policy.name, limiter);
      }
      const result = await limiter.limit(identifier);
      if (result.success) return { ok: true };
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
    },
  };
}

const unlimited: RateLimiter = { check: async () => ({ ok: true }) };
let shared: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  const env = getEnv();
  if (env.E2E_DISABLE_RATE_LIMIT === "1") return unlimited;
  shared ??=
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? createUpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
      : createMemoryRateLimiter();
  return shared;
}

export async function enforceRateLimit(policy: RateLimitPolicy, identifier: string, limiter: RateLimiter = getRateLimiter()): Promise<void> {
  const result = await limiter.check(policy, identifier);
  if (!result.ok) throw new DomainError("RATE_LIMITED", { retryAfterSec: result.retryAfterSec });
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "desconhecido";
}
```

Nos testes de `enforceRateLimit` o limitador é passado explicitamente, então `getEnv()` não é chamado. Se o lint de fronteiras reclamar de `@upstash/*` em `src/shared`, não reclamará: são pacotes externos, não módulos.

- [ ] **Step 3: Apply to checkout and invite**

Em `src/app/[slug]/sacola/messages.ts`, dentro do `switch` de `toCheckoutError`, antes de `case "NOT_FOUND"`:

```ts
    case "RATE_LIMITED":
      return plain(error.code, "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.");
```

Em `src/app/[slug]/sacola/actions.ts`, importe `headers` de `next/headers` e `clientIp`, `enforceRateLimit`, `RATE_LIMITS` de `@/shared/rate-limit`. Acrescente:

```ts
function phoneDigits(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const phone = (payload as { customer?: { phone?: unknown } }).customer?.phone;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  return digits.length >= 10 ? digits.slice(-11) : null;
}
```

Em `quoteOrderAction`, logo antes de `return { ok: true, quote: await quoteOrder(slug, payload) };` (dentro do `try`):

```ts
    await enforceRateLimit(RATE_LIMITS.quoteByIp, clientIp(await headers()));
```

Em `placeOrderAction`, dentro do `try`, antes de `createOrder`:

```ts
    await enforceRateLimit(RATE_LIMITS.orderByIp, clientIp(await headers()));
    const phone = phoneDigits(payload);
    if (phone) await enforceRateLimit(RATE_LIMITS.orderByPhone, phone);
```

O `catch` existente já converte `DomainError` via `toCheckoutError`.

Em `src/app/convite/[token]/actions.ts` (F6a), no início de `acceptInviteAction`, depois da checagem de confirmação de senha:

```ts
  try {
    await enforceRateLimit(RATE_LIMITS.inviteByIp, clientIp(await headers()));
  } catch (error) {
    if (isDomainError(error) && error.code === "RATE_LIMITED") {
      return { status: "error", message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", fieldErrors: {} };
    }
    throw error;
  }
```

- [ ] **Step 4: Better Auth login limit in the database**

Confira em `node_modules/better-auth/dist` (procure `rateLimit` com `storage: "database"` e o model `rateLimit`) quais campos a tabela precisa. Em 1.7.x são `id`, `key`, `count`, `lastRequest`. Em `src/modules/auth/schema.ts` (importe `bigint`, `integer`):

```ts
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
```

Em `src/modules/auth/auth.ts`, troque o spread condicional do rate limit por:

```ts
  rateLimit: {
    // Ligado também fora de produção; só o servidor do E2E desliga.
    enabled: getEnv().E2E_DISABLE_RATE_LIMIT !== "1",
    storage: "database",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
```

O drizzle adapter recebe `schema` inteiro (`import * as schema`), então `rateLimit` é encontrado pela chave. Se o Better Auth pedir o nome do model de outra forma, siga a mensagem de erro dele.

Run: `npm run db:generate` (só `CREATE TABLE "rate_limit"`) e `npm run db:migrate`.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int`
Expected: PASS

Run: `PORT=3001 npm run test:e2e`
Expected: todos passam (o Playwright passa `E2E_DISABLE_RATE_LIMIT=1` ao servidor).

```bash
git add package.json package-lock.json src drizzle
git commit -m "feat: rate limit orders, quotes, invites and logins"
```

---

### Task 3: Upload por Route Handler e imagens no Vercel Blob

**Files:**
- Modify: `package.json` (`@vercel/blob@^2.8.1`)
- Modify: `src/modules/media/images.ts`, `src/modules/media/images.test.ts`
- Create: `src/app/api/painel/upload/route.ts`
- Modify: `src/app/_components/image-upload-field.tsx`
- Delete: `src/app/painel/upload-action.ts`
- Modify: `next.config.ts`

**Interfaces:**
- `saveImage(bytes)` mantém a assinatura `Promise<{ url: string }>`:
  - com `process.env.BLOB_READ_WRITE_TOKEN` → `put("uploads/<uuid>.<ext>", …, { access: "public", contentType, addRandomSuffix: false, token })` → `{ url: <https do Blob> }`;
  - sem token → disco local, `{ url: "/uploads/<arquivo>" }` (como hoje).
- `POST /api/painel/upload` (multipart, campo `file`):
  - sem sessão → 401 `{ error: "Faça login de novo." }`;
  - sem loja → 403 `{ error: "Sem acesso." }`;
  - `content-length` acima de `MAX_IMAGE_BYTES + 64 KB` → 413 `{ error: "a imagem deve ter até 5 MB" }`;
  - sem arquivo → 400 `{ error: "Selecione uma imagem." }`;
  - limite estourado → 429 `{ error: "Muitos envios. Aguarde alguns minutos." }`;
  - `VALIDATION` do domínio → 400 `{ error: <mensagem> }`;
  - sucesso → 200 `{ url }`.
  - Sempre com `Cache-Control: no-store`.
- O campo de imagem do painel usa `fetch("/api/painel/upload", { method: "POST", body })` e lê `{ url } | { error }`.

- [ ] **Step 1: Write the failing tests**

Em `src/modules/media/images.test.ts`, acrescente no topo (antes dos imports do módulo testado):

```ts
import { vi } from "vitest";

const put = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({ put }));
```

e o bloco:

```ts
describe("saveImage com Vercel Blob", () => {
  afterAll(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("envia ao Blob quando há token e devolve a URL pública", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teste";
    put.mockResolvedValueOnce({ url: "https://abc.public.blob.vercel-storage.com/uploads/x.png" });

    const result = await saveImage(PNG);

    expect(result).toEqual({ url: "https://abc.public.blob.vercel-storage.com/uploads/x.png" });
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^uploads\/[0-9a-f-]{36}\.png$/),
      expect.any(Buffer),
      { access: "public", contentType: "image/png", addRandomSuffix: false, token: "vercel_blob_rw_teste" },
    );
  });

  it("valida antes de enviar", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teste";
    put.mockClear();
    await expect(saveImage(TEXT)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(put).not.toHaveBeenCalled();
  });
});
```

Coloque este `describe` **antes** do bloco de disco local, ou garanta que o token é apagado antes dos testes de disco: o `afterAll` acima apaga. Os testes de disco existentes precisam rodar sem token.

Run: `npm install @vercel/blob@^2.8.1 && npm test -- src/modules/media` → FAIL.

- [ ] **Step 2: Implement Blob driver**

Em `src/modules/media/images.ts`, importe `import { put } from "@vercel/blob";` e troque o fim de `saveImage`:

```ts
  const fileName = `${randomUUID()}.${type}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`uploads/${fileName}`, Buffer.from(bytes), {
      access: "public",
      contentType: CONTENT_TYPES[type],
      addRandomSuffix: false,
      token,
    });
    return { url: blob.url };
  }

  // Desenvolvimento: disco local, servido por /uploads/[file].
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), fileName), bytes);
  return { url: `/uploads/${fileName}` };
```

`imageUrlSchema` já aceita `https://…`, e as `<Image>` do projeto usam `unoptimized`, então não precisa de `images.remotePatterns`.

- [ ] **Step 3: Route handler and client field**

`src/app/api/painel/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { MAX_IMAGE_BYTES, saveImage } from "@/modules/media";
import { getMembershipStoreId } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/shared/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };
const MULTIPART_OVERHEAD = 64 * 1024;

function reply(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply(401, { error: "Faça login de novo." });
  if (!(await getMembershipStoreId(user.id))) return reply(403, { error: "Sem acesso." });

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD) return reply(413, { error: "a imagem deve ter até 5 MB" });

  try {
    await enforceRateLimit(RATE_LIMITS.uploadByUser, user.id);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return reply(400, { error: "Selecione uma imagem." });
    return reply(200, await saveImage(new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    if (isDomainError(error) && error.code === "RATE_LIMITED") return reply(429, { error: "Muitos envios. Aguarde alguns minutos." });
    if (isDomainError(error) && error.code === "VALIDATION") {
      const [issue] = (error.details.issues ?? []) as { message: string }[];
      return reply(400, { error: issue?.message ?? "Imagem inválida." });
    }
    throw error;
  }
}
```

Em `src/app/_components/image-upload-field.tsx`:
- remova o import de `uploadImageAction`;
- troque o bloco do `try` dentro de `startTransition` por:

```tsx
      try {
        const response = await fetch("/api/painel/upload", { method: "POST", body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (result.url) setUrl(result.url);
        else setError(result.error ?? "Não foi possível enviar a imagem.");
      } catch {
        setError("Não foi possível enviar a imagem.");
      }
```

Apague `src/app/painel/upload-action.ts` e confira que nada mais o importa (`grep -rn upload-action src`).

Em `next.config.ts`, remova o bloco `experimental: { serverActions: { bodySizeLimit: "6mb" } },`. Se `experimental` ficar vazio, remova a chave inteira.

- [ ] **Step 4: Verify (E2E covers the logo upload) and commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

Run: `PORT=3001 npm run test:e2e`
Expected: todos passam. `e2e/painel.spec.ts` envia o logo do fixture pelo novo endpoint.

Teste manual rápido dos códigos HTTP (com o dev server do worktree):
- `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/api/painel/upload` → `401`.

```bash
git add package.json package-lock.json src next.config.ts
git rm src/app/painel/upload-action.ts
git commit -m "feat: upload images through a route handler to Vercel Blob"
```

---

### Task 4: Integridade dos pedidos

**Files:**
- Modify: `src/modules/orders/schema.ts` (CHECKs), `src/modules/orders/service.ts` (`insertOrderLines` em lote)
- Create (gerado): `drizzle/0011_*.sql`
- Modify: `src/modules/orders/service.int.test.ts`

**Interfaces:**
- `insertOrderLines(tx, orderId, lines)` mantém a assinatura (F5). Agora faz **um** `INSERT` de itens (com `returning` de `id` e `position`) e **um** de opções, em vez de um por linha.
- CHECKs novos:
  - `order_items_quantity_check`: `quantity between 1 and 50`;
  - `order_items_amounts_check`: `unit_price_cents >= 0 and total_cents >= 0`;
  - `order_item_options_price_check`: `price_cents >= 0`.

- [ ] **Step 1: Write the failing test**

Em `src/modules/orders/service.int.test.ts`, troque o import `import { orders } from "./schema";` por `import { orderItems, orders } from "./schema";` e acrescente dentro do `describe` (usa os helpers `setupStore` e `checkout` que o arquivo já tem):

```ts
  it("o banco recusa item com quantidade ou valor inválido", async () => {
    const ids = await setupStore();
    const placed = await createOrder(SLUG, checkout(ids, { expectedTotalCents: 8490 }));
    const base = { orderId: placed.orderId, productName: "X", quantity: 1, unitPriceCents: 100, totalCents: 100 };
    await expect(db.insert(orderItems).values({ ...base, quantity: 0 })).rejects.toThrow(/order_items_quantity_check/);
    await expect(db.insert(orderItems).values({ ...base, quantity: 51 })).rejects.toThrow(/order_items_quantity_check/);
    await expect(db.insert(orderItems).values({ ...base, totalCents: -1 })).rejects.toThrow(/order_items_amounts_check/);
  });
```

O teste "cria pedido #1 com snapshot…" já cria pedido com 2 itens, um deles com adicional (`checkout` padrão), e confere as opções: ele cobre o insert em lote.

Run: `npm run test:int -- src/modules/orders/service.int.test.ts` → FAIL (sem CHECK).

- [ ] **Step 2: Implement**

Em `src/modules/orders/schema.ts`:
- `orderItems`: na lista de índices, acrescente
  `check("order_items_quantity_check", sql\`${t.quantity} between 1 and 50\`)` e
  `check("order_items_amounts_check", sql\`${t.unitPriceCents} >= 0 and ${t.totalCents} >= 0\`)`;
- `orderItemOptions`: `check("order_item_options_price_check", sql\`${t.priceCents} >= 0\`)`.

Em `src/modules/orders/service.ts`, troque o corpo de `insertOrderLines`:

```ts
export async function insertOrderLines(tx: OrderTx, orderId: string, lines: PricedLine[]): Promise<void> {
  if (lines.length === 0) return;
  const items = await tx
    .insert(orderItems)
    .values(
      lines.map((line, position) => ({
        orderId,
        productName: line.productName,
        sizeName: line.sizeName,
        flavors: line.flavors,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        totalCents: line.totalCents,
        notes: line.notes,
        position,
      })),
    )
    .returning({ id: orderItems.id, position: orderItems.position });

  // Liga cada opção ao item pela posição (a ordem do RETURNING não é garantida).
  const itemIdByPosition = new Map(items.map((item) => [item.position, item.id]));
  const options = lines.flatMap((line, position) =>
    line.options.map((option) => ({ orderItemId: itemIdByPosition.get(position)!, ...option })),
  );
  if (options.length > 0) await tx.insert(orderItemOptions).values(options);
}
```

Run: `npm run db:generate` (só os 3 `ALTER TABLE … ADD CONSTRAINT … CHECK`) e `npm run db:migrate`. Se o banco do worktree tiver linhas que violem o CHECK, a migração falha. Nesse caso, rode `npm run seed:demo` e tente de novo, e relate no report.

- [ ] **Step 3: Verify and commit**

Run: `npm run test:int && npm run typecheck && npm run lint`
Expected: PASS

```bash
git add src/modules/orders drizzle
git commit -m "fix: database checks on order items and batched line inserts"
```

---

### Task 5: Sentry

**Files:**
- Modify: `package.json` (`@sentry/nextjs@^11.7.0`)
- Create: `src/shared/sentry-filter.ts`, `src/shared/sentry-filter.test.ts`
- Create: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/global-error.tsx`

**Interfaces:**
- `dropExpectedErrors<T>(event: T, hint: { originalException?: unknown }): T | null`. Devolve `null` (não envia) para:
  - `DomainError`;
  - erros com `digest` começando por `NEXT_REDIRECT`, `NEXT_HTTP_ERROR_FALLBACK` ou `NEXT_NOT_FOUND`.
- Servidor: `register()` inicializa o Sentry só com `SENTRY_DSN`; `onRequestError = Sentry.captureRequestError`.
- Navegador: inicializa só com `NEXT_PUBLIC_SENTRY_DSN`.
- `tracesSampleRate: 0` (só erros). `environment` = `VERCEL_ENV ?? NODE_ENV`.
- `global-error.tsx`: mensagem "Algo deu errado." + botão "Tentar de novo"; envia o erro ao Sentry.
- Sem `withSentryConfig` (sem upload de source maps) nesta fase.

- [ ] **Step 1: Write the failing test**

`src/shared/sentry-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { dropExpectedErrors } from "./sentry-filter";

const event = { message: "x" };

describe("dropExpectedErrors", () => {
  it("descarta erros de domínio e controles de navegação do Next", () => {
    expect(dropExpectedErrors(event, { originalException: new DomainError("STORE_CLOSED") })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("r"), { digest: "NEXT_REDIRECT;replace;/login;307;" }) })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("n"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }) })).toBeNull();
  });

  it("mantém erros inesperados", () => {
    expect(dropExpectedErrors(event, { originalException: new Error("boom") })).toBe(event);
    expect(dropExpectedErrors(event, {})).toBe(event);
  });
});
```

Run: `npm test -- src/shared/sentry-filter.test.ts` → FAIL.

- [ ] **Step 2: Implement**

Run: `npm install @sentry/nextjs@^11.7.0`

`src/shared/sentry-filter.ts`:

```ts
import { isDomainError } from "./errors";

const NEXT_CONTROL_DIGESTS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

/** beforeSend do Sentry: erros esperados (regra de negócio, redirect/notFound do Next) não são incidentes. */
export function dropExpectedErrors<T>(event: T, hint: { originalException?: unknown }): T | null {
  const error = hint.originalException;
  if (isDomainError(error)) return null;
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest === "string" && NEXT_CONTROL_DIGESTS.some((prefix) => digest.startsWith(prefix))) return null;
  return event;
}
```

Antes de escrever os arquivos abaixo, leia `node_modules/next/dist/docs/` (procure `instrumentation` e `onRequestError`) e o README de `node_modules/@sentry/nextjs`. Confirme os nomes e a localização (`src/instrumentation.ts` e `src/instrumentation-client.ts` quando há pasta `src`).

`src/instrumentation.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import { dropExpectedErrors } from "@/shared/sentry-filter";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: dropExpectedErrors,
  });
}

export const onRequestError = Sentry.captureRequestError;
```

`src/instrumentation-client.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import { dropExpectedErrors } from "@/shared/sentry-filter";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: dropExpectedErrors,
  });
}
```

`src/app/global-error.tsx`:

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Algo deu errado.</h1>
        <p>Tente recarregar a página. Se continuar, fale com o suporte.</p>
        <button type="button" onClick={reset} className="w-fit rounded border px-4 py-2">
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
```

Se o tipo de `beforeSend` do Sentry não aceitar a função genérica diretamente, use `beforeSend: (event, hint) => dropExpectedErrors(event, hint)`.

- [ ] **Step 3: Verify build and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS. O build sem `SENTRY_DSN` não envia nada e não deve gerar avisos que viram erro.

Se `@sentry/nextjs` quebrar o build com Next 16.4/Turbopack, pare e reporte BLOCKED com a mensagem exata. Não troque de versão do Next nem desative o Turbopack.

```bash
git add package.json package-lock.json src
git commit -m "feat: report unexpected errors to Sentry when a DSN is configured"
```

---

### Task 6: Preparação do deploy e roteiro

**Files:**
- Modify: `package.json` (script `vercel-build`), `drizzle.config.ts`, `.env.example`, `README.md`
- Create: `docs/deploy.md`

**Interfaces:**
- `vercel-build`: `drizzle-kit migrate && next build`. Na Vercel, as migrações rodam antes de cada build (inclusive preview, contra o banco de preview).
- `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` quando existir (a integração Neon da Vercel cria as duas). Migração não roda pelo pooler.

- [ ] **Step 1: Config files**

`drizzle.config.ts`: troque `dbCredentials: { url: process.env.DATABASE_URL ?? "" }` por:

```ts
  // Migração usa a conexão direta (o pooler do Neon não suporta tudo que o drizzle-kit faz).
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
```

`package.json`, em `scripts`:

```json
    "vercel-build": "drizzle-kit migrate && next build",
```

`.env.example` (acrescente, comentado):

```bash
# Opcional no desenvolvimento; obrigatórias na Vercel em produção (veja docs/deploy.md).
# APP_URL=https://naquelamesa.com.br
# BETTER_AUTH_TRUSTED_ORIGINS=https://naquela-mesa-git-main-aishiteirai.vercel.app
# DATABASE_POOL_MAX=3
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
# BLOB_READ_WRITE_TOKEN=
# SENTRY_DSN=
# NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 2: `docs/deploy.md`**

Crie o roteiro (português, passos numerados, sem segredos reais) com estas seções e conteúdo:

1. **Contas** (todas no plano gratuito): GitHub (repositório já existe), Vercel (login com GitHub), Neon e Upstash (pela aba **Integrations / Marketplace** da Vercel, que já cria as variáveis), Vercel Blob (aba **Storage** do projeto), Sentry (projeto "Next.js").
2. **Criar o projeto na Vercel:** importar `aishiteirai/naquela-mesa`; framework Next.js; *Build Command* em branco (a Vercel usa `vercel-build` sozinha); Node 24 (de `.nvmrc`).
3. **Variáveis de ambiente.** Tabela com nome, ambiente (Production / Preview) e de onde vem:
   - `DATABASE_URL` e `DATABASE_URL_UNPOOLED` (Neon);
   - `DATABASE_POOL_MAX=3`;
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`; um diferente para Preview);
   - `BETTER_AUTH_URL` e `APP_URL` = domínio final em Production;
   - `BETTER_AUTH_TRUSTED_ORIGINS` = URL de preview;
   - `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`;
   - `BLOB_READ_WRITE_TOKEN`;
   - `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`.
   - **Aviso:** **nunca** definir `E2E_DISABLE_RATE_LIMIT` na Vercel; o app se recusa a subir em produção com ela.
4. **Primeiro deploy:** push na `main` → a Vercel roda as migrações e o build. Conferir o log "migrations applied".
5. **Primeiro super-admin**, a partir da máquina local, apontando para o banco de produção:
   `DATABASE_URL="<url direta do Neon>" ADMIN_PASSWORD="<senha forte>" npm run admin:ensure -- voce@exemplo.com "Seu Nome"`.
   Avisar que a senha não fica no histórico do shell se o comando começar com espaço (bash/zsh com `HIST_IGNORE_SPACE`).
6. **Domínio:** em *Settings → Domains*, adicionar o domínio. Configurar o DNS no registrador conforme a Vercel mostrar (A `76.76.21.21` para o domínio raiz, CNAME `cname.vercel-dns.com` para `www`). Depois atualizar `BETTER_AUTH_URL` e `APP_URL` e fazer *Redeploy*.
7. **Loja de demonstração em produção (opcional):** `seed:demo` recusa `NODE_ENV=production`. Para uma demo, rode da máquina local com `DATABASE_URL` do Neon (`NODE_ENV` não definido). Ele **apaga e recria** a loja `pizzaria-demo` e nada mais.
8. **Checklist de fumaça depois do deploy**, com caixinhas:
   - cardápio abre no celular por HTTPS;
   - pedido completo com WhatsApp;
   - painel: "Iniciar atendimento" (precisa clicar de novo a cada recarga da página), alerta sonoro, notificação do navegador (só funciona em HTTPS), tela não apaga (Wake Lock, só HTTPS);
   - impressão em impressora térmica 80 mm. Chrome com `--kiosk-printing` imprime sem diálogo: atalho do Windows com `chrome.exe --kiosk-printing https://<domínio>/painel`;
   - convite de dono e "Acessar como loja";
   - 11 pedidos seguidos do mesmo celular → mensagem "Muitas tentativas…";
   - upload de logo vai para o Blob (URL `*.public.blob.vercel-storage.com`);
   - erro de teste aparece no Sentry.
9. **Custos e limites:**
   - planos gratuitos: Neon 0,5 GB, Upstash 10 mil comandos/dia, Blob 1 GB;
   - o painel consulta a fila a cada 5 s por aparelho aberto; ~17 mil requisições/dia por tablet ligado 24 h;
   - quando migrar de plano.

- [ ] **Step 3: README**

Em `README.md`, acrescente a seção `## Deploy` com uma linha apontando para `docs/deploy.md` e a lista curta das variáveis obrigatórias em produção.

- [ ] **Step 4: Final checks and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build`
Expected: PASS

Run: `PORT=3001 npm run test:e2e`
Expected: todos passam.

```bash
git add package.json drizzle.config.ts .env.example docs/deploy.md README.md
git commit -m "docs: deploy guide and Vercel build with migrations"
```
