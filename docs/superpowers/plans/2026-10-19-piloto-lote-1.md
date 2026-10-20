# Piloto — Lote 1 (bloqueadores e importantes) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o que bloqueia ou atrapalha o piloto com restaurantes reais: formulários que apagam o que foi digitado, telas inalcançáveis, painel que cai inteiro num erro, alerta de pedido que só funciona numa página, sacola que trava com item fora do cardápio, PII indo para o Sentry, mais os itens importantes da análise de 2026-10-17 e as issues #1 e #2 do GitHub.

**Architecture:** Mudanças pequenas e locais, cada uma com teste. Três peças novas e reutilizáveis: `ActionForm` (form sem o reset automático do React 19), `repriceCart` (sacola recalculada com o cardápio atual no cliente) e o `NewOrdersProvider` reescrito como único observador da fila (polling, som, título, notificação) montado no shell do painel. O servidor continua sendo a autoridade de preço, horário e validação; o cliente só avisa antes.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind v4, shadcn, Drizzle + Postgres, Zod 4, Vitest (unit + integration), Playwright, Sentry.

**Spec:** não há spec separado. A fonte é a análise registrada na conversa de 2026-10-17/19 (itens A1–A9, B1–B12, issues #1 e #2). Cada tarefa diz qual item resolve.

## Global Constraints

- Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código Next (exigência do `AGENTS.md`). Em Next 16.4, `error.tsx` e `global-error.tsx` recebem `retry` (não `reset`).
- Imports com `@/…`; o lint proíbe `../`.
- Commits em inglês, terminando com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Nunca alterar `git config`.
- Textos de interface em português, exatamente como escritos aqui.
- Nada de migração SQL neste lote.
- `FULFILLMENT_LABELS`, `statusLabel` e `PAYMENT_LABELS` **não mudam**; rótulo dependente do tipo de pedido vai numa função nova (`paymentLabel`).
- Cor da loja nunca como cor de texto sobre fundo claro.
- Verificação de cada tarefa: `npm run lint && npm run typecheck && npm test`; quando a tarefa toca `src/modules/**`, também `npm run test:int`. Tarefas com E2E: o controlador roda `make e2e` nos pontos de checagem (depois das Tasks 6, 13 e 19). Um spec isolado pode ser rodado com `DATABASE_URL=postgres://naquela:naquela@localhost:5434/naquela_mesa_e2e CI=1 npx playwright test e2e/<arquivo>` depois de um `make build`. Nunca rodar E2E contra o banco do dev (`naquela_mesa`).
- Dev server do usuário em :3001 — não matar processos dele.
- Trabalhar na branch `piloto-lote-1` (criada a partir de `frontend-shadcn`).

## Review Focus

1. Dono digita preço inválido num produto novo com nome, descrição e adicionais marcados: depois do erro tudo continua preenchido — teste E2E na Task 1.
2. Dono recarrega o painel no meio do expediente: "Atendimento ativo" continua e o som volta no primeiro toque na página, sem precisar achar o botão de novo — teste E2E na Task 6.
3. Cliente com sacola antiga (produto que o dono marcou como esgotado depois) abre a sacola: vê qual item saiu e não consegue avançar até remover — teste E2E na Task 10.
4. Erro inesperado no servidor (falha de query) com dados do cliente na mensagem: o evento do Sentry sai sem nome/telefone/endereço e sem token na URL — teste unitário na Task 5.
5. Queda de rede ao clicar "Aceitar" com impressão automática: o painel não cai, aparece aviso e a aba em branco da comanda fecha — teste unitário do wrapper na Task 7 (o caminho do navegador fica no smoke test).

---

### Task 0: Branch

- [ ] **Step 1:** `git switch -c piloto-lote-1` (a partir de `frontend-shadcn` atualizada). Sem commit.

---

### Task 1: `ActionForm` — formulários não apagam o que foi digitado (A1)

**Problema:** com `<form action={fn}>`, o React 19 reseta os campos não controlados quando a action termina, inclusive em erro. Produto novo com preço inválido perde nome, descrição, preços e adicionais.

**Files:**
- Create: `src/app/_components/action-form.tsx`
- Modify: `src/app/_components/form-fields.tsx` (SubmitButton)
- Modify: `src/app/painel/(shell)/cardapio/_components/category-form.tsx`, `product-form.tsx`, `sizes-editor.tsx` (só os dois forms com `useActionState`)
- Modify: `src/app/painel/(shell)/cardapio/adicionais/_components/forms.tsx`
- Modify: `src/app/painel/(shell)/loja/_components/profile-form.tsx`, `operations-form.tsx`, `hours-editor.tsx`, `zones-editor.tsx`
- Modify: `src/app/convite/[token]/_components/accept-form.tsx`
- Modify: `src/app/admin/_components/create-store-form.tsx`
- Test: `e2e/painel.spec.ts`

**Interfaces:**
- Produces: `ActionForm({ action, pending, ...formProps })` e `useActionFormPending(): boolean` em `@/app/_components/action-form`.

- [ ] **Step 1: Escrever o teste E2E que falha.** Em `e2e/painel.spec.ts`, substituir o teste `"preço digitado errado mostra erro no painel e não salva"` por:

```ts
test("preço digitado errado mostra erro, mantém o que foi digitado e não salva", async ({ page }) => {
  await page.getByRole("button", { name: "Editar Mussarela" }).click();
  const sheet = page.getByRole("dialog", { name: "Editar produto" });
  await sheet.getByLabel("Nome", { exact: true }).fill("Mussarela Especial");
  await sheet.getByLabel("Descrição").fill("Com orégano fresco");
  await sheet.getByLabel("Preço Broto").fill("12.50");
  await sheet.getByRole("button", { name: "Salvar produto" }).click();

  await expect(sheet.getByText("preço inválido (use 34,90)")).toBeVisible();
  await expect(sheet.getByLabel("Nome", { exact: true })).toHaveValue("Mussarela Especial");
  await expect(sheet.getByLabel("Descrição")).toHaveValue("Com orégano fresco");
  await expect(sheet.getByLabel("Preço Broto")).toHaveValue("12.50");
  await expect(page).toHaveURL(/\?produto=/);
  await expect(await publicCard(page, "Mussarela")).toContainText(/a partir de R\$\s32,90/);
});
```

- [ ] **Step 2: Criar `src/app/_components/action-form.tsx`:**

```tsx
"use client";

import { type ComponentProps, createContext, startTransition, useContext } from "react";

const PendingContext = createContext(false);

/** `pending` do ActionForm mais próximo; o SubmitButton usa porque `useFormStatus` só enxerga `<form action>`. */
export function useActionFormPending(): boolean {
  return useContext(PendingContext);
}

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  /** O `formAction` devolvido por `useActionState`. */
  action: (form: FormData) => void;
  pending: boolean;
};

/**
 * `<form>` que chama a action sem o reset automático do React 19 (`<form action>` limpa os campos não
 * controlados quando a action termina, inclusive em erro): o que a pessoa digitou continua na tela.
 * Formulários que precisam limpar depois do sucesso chamam `form.reset()` por conta própria.
 */
export function ActionForm({ action, pending, children, ...props }: Props) {
  return (
    <PendingContext value={pending}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(event.currentTarget, submitter);
          startTransition(() => action(data));
        }}
      >
        {children}
      </form>
    </PendingContext>
  );
}
```

- [ ] **Step 3: `SubmitButton` enxerga os dois tipos de form.** Em `src/app/_components/form-fields.tsx`:

```tsx
import { useActionFormPending } from "@/app/_components/action-form";
// ...
export function SubmitButton({
  children,
  pendingText = "Salvando...",
  ...props
}: { children: ReactNode; pendingText?: string } & Omit<ComponentProps<typeof Button>, "type">) {
  const { pending: formPending } = useFormStatus();
  const actionPending = useActionFormPending();
  const pending = formPending || actionPending;
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
```

- [ ] **Step 4: Migrar cada formulário.** Em todos os arquivos listados, o padrão é o mesmo:

```tsx
// antes
const [state, formAction] = useActionState(saveProductAction, idleState);
// ...
<form action={formAction} className="flex flex-col gap-6">
  ...
</form>

// depois
const [state, formAction, pending] = useActionState(saveProductAction, idleState);
// ...
<ActionForm action={formAction} pending={pending} className="flex flex-col gap-6">
  ...
</ActionForm>
```

com `import { ActionForm } from "@/app/_components/action-form";`. Detalhes por arquivo:
  - `operations-form.tsx`: manter `key={savedKey}` (agora no `ActionForm`) — ele ainda remonta com o valor salvo depois do sucesso. Atualizar o comentário da linha 45 para: `// Depois de salvar, a key remonta o form com o valor salvo (os controles Radix guardam o valor do mount).`
  - `sizes-editor.tsx`: só os dois forms com `useActionState` (`SizeRow` e `NewSizeForm`). Os forms `moveSizeAction`/`deleteSizeAction` mudam na Task 8. No `NewSizeForm`, passar `ref={formRef}` ao `ActionForm`; o `formRef.current?.reset()` no sucesso continua (o campo novo deve limpar só depois de salvar). Atualizar o comentário da linha 36 para: `{/* key: depois de salvar, remonta com o valor salvo (o Select guarda o valor do mount). */}`.
  - `create-store-form.tsx`: depois de criar a loja os campos devem limpar. Adicionar:

```tsx
const formRef = useRef<HTMLFormElement>(null);
useEffect(() => {
  if (state.status === "link") formRef.current?.reset();
}, [state]);
// ...
<ActionForm ref={formRef} action={formAction} pending={pending} aria-label="Nova loja" className="flex flex-col gap-4">
```

  - `accept-form.tsx`, `profile-form.tsx`, `category-form.tsx`, `product-form.tsx`, `forms.tsx` (OptionGroupForm e OptionForm), `hours-editor.tsx`, `zones-editor.tsx`: só o padrão acima.
  - Não migrar `new-link-dialog.tsx`, `advance-button.tsx`, `cancel-form.tsx` (sem campos digitados, ou tratados na Task 7).

- [ ] **Step 5: Verificar.** `npm run lint && npm run typecheck && npm test`. Conferir `grep -rn "action={formAction}" src` → só `new-link-dialog.tsx` e `advance-button.tsx`.

- [ ] **Step 6: Commit.**

```bash
git add src/app/_components/action-form.tsx src/app/_components/form-fields.tsx src/app/painel src/app/convite src/app/admin e2e/painel.spec.ts
git commit -m "fix: keep typed values in panel forms after a validation error"
```

---

### Task 2: Link para Adicionais (A2)

**Problema:** `/painel/cardapio/adicionais` não tem link em lugar nenhum.

**Files:**
- Modify: `src/app/painel/(shell)/cardapio/page.tsx`
- Modify: `src/app/painel/_lib/nav.ts`
- Test: `src/app/painel/_lib/nav.test.ts`, `e2e/painel.spec.ts`

- [ ] **Step 1: Teste unitário que falha.** Em `nav.test.ts`, trocar a linha da tabela de `pageTrail` `["/painel/cardapio/adicionais", ["Cardápio"]]` por `["/painel/cardapio/adicionais", ["Cardápio", "Adicionais"]]`. Rodar `npx vitest run src/app/painel/_lib/nav.test.ts` → FAIL.

- [ ] **Step 2:** Em `nav.ts`, incluir na `TRAILS` **antes** de `/painel/cardapio` (o primeiro que casa ganha):

```ts
  { href: "/painel/cardapio/adicionais", trail: ["Cardápio", "Adicionais"] },
```

- [ ] **Step 3: Botão no cabeçalho do Cardápio.** Em `cardapio/page.tsx`, trocar o bloco do título por:

```tsx
import Link from "next/link";
import { ListPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
// ...
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Cardápio</h1>
          <p className="text-sm text-muted-foreground">Clique num produto para editar. A chave marca o que acabou: o cardápio atualiza na hora.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/painel/cardapio/adicionais">
            <ListPlusIcon />
            Adicionais
          </Link>
        </Button>
      </div>
```

- [ ] **Step 4: E2E.** No fim de `e2e/painel.spec.ts`:

```ts
test("cardápio tem link para os adicionais", async ({ page }) => {
  await page.getByRole("link", { name: "Adicionais" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio\/adicionais$/);
});
```

- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: link the add-ons page from the menu editor`.

---

### Task 3: WhatsApp da loja aceita "(11) 99999-9999" (A3)

**Files:**
- Modify: `src/app/painel/(shell)/loja/actions.ts` (`saveProfileAction`)
- Modify: `src/app/painel/(shell)/loja/_components/profile-form.tsx` (placeholder)
- Test: `e2e/painel.spec.ts`

- [ ] **Step 1: E2E que falha.** Em `e2e/painel.spec.ts`, depois do teste `"prévia muda ao trocar a cor…"`:

```ts
test("whatsapp da loja aceita número com máscara", async ({ page }) => {
  await page.goto("/painel/loja");
  const appearance = page.getByRole("tabpanel", { name: "Aparência" });
  await appearance.getByLabel("WhatsApp").fill("(11) 97777-6666");
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Aparência salva.");
  await page.reload();
  await expect(appearance.getByLabel("WhatsApp")).toHaveValue("+5511977776666");
  // restaura o número do seed (scripts/demo/pizzaria-demo.ts)
  await appearance.getByLabel("WhatsApp").fill("+5511999999999");
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Aparência salva.");
});
```

- [ ] **Step 2:** Em `saveProfileAction`, normalizar antes de validar (número inválido segue cru para o zod mostrar o erro do campo):

```ts
import { normalizeBrazilPhone } from "@/modules/orders";
// ...
        whatsappPhone: normalizeBrazilPhone(text(form, "whatsappPhone")) ?? text(form, "whatsappPhone"),
```

- [ ] **Step 3:** Em `profile-form.tsx`, no campo WhatsApp: `placeholder="(11) 99999-9999"` e `inputMode="tel"`.

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: accept a masked Brazilian number for the store WhatsApp`.

---

### Task 4: Telas de erro por área + `global-error` com `retry` (A4)

**Problema:** não existe `error.tsx`; qualquer erro derruba a página inteira na tela global. Além disso, `global-error.tsx` usa `reset`, que no Next 16.4 se chama `retry` — o botão "Tentar de novo" hoje não faz nada.

**Files:**
- Create: `src/app/_components/error-fallback.tsx`
- Create: `src/app/painel/(shell)/error.tsx`, `src/app/[slug]/error.tsx`, `src/app/admin/error.tsx`
- Modify: `src/app/global-error.tsx`

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.

- [ ] **Step 2: Criar `src/app/_components/error-fallback.tsx`:**

```tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Corpo comum dos `error.tsx`: avisa, reporta ao Sentry e deixa tentar de novo sem perder o resto da tela. */
export function ErrorFallback({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
    }
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-col items-start gap-3 px-4 py-16">
      <h2 className="text-xl font-semibold">Algo deu errado.</h2>
      <p className="text-muted-foreground">Pode ter sido uma falha de conexão. Tente de novo; se continuar, recarregue a página.</p>
      <Button type="button" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Criar os três `error.tsx`** (mesmo conteúdo, nome de função diferente):

```tsx
// src/app/painel/(shell)/error.tsx — fica dentro do shell: a barra lateral continua na tela.
"use client";

import { ErrorFallback } from "@/app/_components/error-fallback";

export default function PainelError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback {...props} />;
}
```

`src/app/[slug]/error.tsx` → `StoreError`; `src/app/admin/error.tsx` → `AdminError`.

- [ ] **Step 4: `global-error.tsx`:** trocar `reset` por `retry` na assinatura e no `onClick` (`onClick={() => retry()}`).

- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test`. O `typecheck` roda `next typegen`, que confere as props dos arquivos de convenção. Commit: `fix: per-area error screens and working retry on the global error page`.

---

### Task 5: Sentry sem PII e sem tokens (A8, B10)

**Problema:** o drizzle põe os parâmetros da query na mensagem (`Failed query: …\nparams: Maria,11988887777,…`) e o Postgres põe valores em `Key (email)=(x@y)`; o Sentry recebe tudo. URLs com token de convite/pedido também vão.

**Files:**
- Modify: `src/shared/sentry-filter.ts`
- Modify: `src/shared/sentry-filter.test.ts`
- Modify: `src/instrumentation.ts`, `src/instrumentation-client.ts`

**Interfaces:**
- Produces: `scrubText(text: string): string`, `scrubEvent<T>(event: T): T`, `beforeSend<T>(event: T, hint): T | null` em `@/shared/sentry-filter`.

- [ ] **Step 1: Testes que falham.** Acrescentar em `sentry-filter.test.ts`:

```ts
import { beforeSend, scrubEvent, scrubText } from "./sentry-filter";

describe("scrubText", () => {
  it("remove parâmetros de query do drizzle", () => {
    expect(scrubText('Failed query: insert into "orders" ("customer_name") values ($1)\nparams: Maria Silva,+5511988887777')).toBe(
      'Failed query: insert into "orders" ("customer_name") values ($1)\nparams: [removido]',
    );
  });

  it("remove valores de violação de chave do Postgres", () => {
    expect(scrubText("Key (email)=(dono@loja.com) already exists.")).toBe("Key (email)=([removido]) already exists.");
  });

  it("troca tokens de convite e de pedido nas URLs", () => {
    expect(scrubText("https://x.app/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12")).toBe("https://x.app/convite/[token]");
    expect(scrubText("/pizzaria/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12?x=1")).toBe("/pizzaria/pedido/[token]?x=1");
  });

  it("não mexe em texto comum", () => {
    expect(scrubText("TypeError: x is undefined")).toBe("TypeError: x is undefined");
  });
});

describe("scrubEvent", () => {
  it("limpa mensagem, exceções, request e breadcrumbs", () => {
    const event = {
      message: "Key (email)=(a@b.c) already exists.",
      exception: { values: [{ type: "Error", value: "Failed query: select 1\nparams: segredo" }] },
      request: { url: "https://x.app/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12", data: { name: "Maria" }, query_string: "a=1", cookies: { s: "1" } },
      breadcrumbs: [{ message: "GET /p/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12", data: { url: "/p/pedido/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12" } }],
      transaction: "/convite/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12",
    };
    expect(scrubEvent(event)).toEqual({
      message: "Key (email)=([removido]) already exists.",
      exception: { values: [{ type: "Error", value: "Failed query: select 1\nparams: [removido]" }] },
      request: { url: "https://x.app/convite/[token]" },
      breadcrumbs: [{ message: "GET /p/pedido/[token]", data: { url: "/p/pedido/[token]" } }],
      transaction: "/convite/[token]",
    });
  });
});

describe("beforeSend", () => {
  it("descarta esperados e limpa o resto", () => {
    expect(beforeSend({ message: "x" }, { originalException: new DomainError("STORE_CLOSED") })).toBeNull();
    expect(beforeSend({ message: "Key (id)=(1) x" }, { originalException: new Error("boom") })).toEqual({ message: "Key (id)=([removido]) x" });
  });
});
```

Rodar `npx vitest run src/shared/sentry-filter.test.ts` → FAIL.

- [ ] **Step 2: Implementar** (acrescentar a `sentry-filter.ts`, mantendo `dropExpectedErrors`):

```ts
const REDACTED = "[removido]";
const QUERY_PARAMS = /\nparams: [\s\S]*$/;
const KEY_VALUES = /Key \(([^)]*)\)=\([^)]*\)/g;
const URL_TOKENS = /\/(convite|pedido)\/[A-Za-z0-9_-]{20,}/g;

/** Tira dados pessoais e tokens de um texto que vai para o Sentry. */
export function scrubText(text: string): string {
  return text
    .replace(QUERY_PARAMS, `\nparams: ${REDACTED}`)
    .replace(KEY_VALUES, `Key ($1)=(${REDACTED})`)
    .replace(URL_TOKENS, "/$1/[token]");
}

type ScrubbableEvent = {
  message?: string;
  transaction?: string;
  exception?: { values?: { value?: string }[] };
  request?: { url?: string; data?: unknown; query_string?: unknown; cookies?: unknown };
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
};

/** Limpa um evento do Sentry: mensagens, exceções, URL e breadcrumbs; corpo, query e cookies da requisição saem. */
export function scrubEvent<T>(event: T): T {
  const source = event as ScrubbableEvent;
  const copy: ScrubbableEvent = { ...source };
  if (copy.message) copy.message = scrubText(copy.message);
  if (copy.transaction) copy.transaction = scrubText(copy.transaction);
  if (copy.exception?.values) {
    copy.exception = { ...copy.exception, values: copy.exception.values.map((value) => (value.value ? { ...value, value: scrubText(value.value) } : value)) };
  }
  if (copy.request) {
    const { data: _data, query_string: _query, cookies: _cookies, ...request } = copy.request;
    copy.request = request.url ? { ...request, url: scrubText(request.url) } : request;
  }
  if (copy.breadcrumbs) {
    copy.breadcrumbs = copy.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.message ? { message: scrubText(crumb.message) } : {}),
      ...(crumb.data
        ? { data: Object.fromEntries(Object.entries(crumb.data).map(([key, value]) => [key, typeof value === "string" ? scrubText(value) : value])) }
        : {}),
    }));
  }
  return copy as T;
}

/** beforeSend do Sentry: descarta o esperado e limpa o resto. */
export function beforeSend<T>(event: T, hint: { originalException?: unknown }): T | null {
  const kept = dropExpectedErrors(event, hint);
  return kept === null ? null : scrubEvent(kept);
}
```

Se o lint reclamar das variáveis `_data/_query/_cookies` não usadas, trocar a desestruturação por `const request = { url: copy.request.url }` mais os campos que sobram (`method`, `headers` não existem no tipo, então `{ url }` basta) e ajustar o teste — o esperado é `request: { url: "…/[token]" }`.

- [ ] **Step 3:** Em `instrumentation.ts` e `instrumentation-client.ts`, trocar `dropExpectedErrors` por `beforeSend` (import e opção `beforeSend: beforeSend`). No servidor, acrescentar `sendDefaultPii: false` explícito.

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: scrub customer data and URL tokens from Sentry events`.

---

### Task 6: Alerta de pedido em todo o painel (A5, B7)

**Problema:** polling, som, título e notificação só existem na página Pedidos (`QueuePoller`). Em Cardápio/Loja/Métricas o dono não é avisado. Além disso: qualquer clique desliga o som; pedidos que já esperavam ao clicar "Iniciar atendimento" não tocam; recarregar exige achar o botão de novo; o iOS pode deixar o `AudioContext` suspenso.

**Decisão:** o `NewOrdersProvider` (já montado no shell) vira o único observador: consulta `/api/painel/pedidos/versao` (5 s visível, 15 s oculta, backoff até 30 s), guarda contagem/versão, toca o som e troca o título. O alerta continua até não haver pedido aguardando (`received === 0`) ou até o dono clicar **Silenciar**; um pedido novo depois disso alerta de novo. "Atendimento ativo" fica em `sessionStorage` (vale por aba, sobrevive a recarregar); depois de recarregar, o primeiro toque/tecla na página destrava o áudio.

**Files:**
- Move: `src/app/painel/(shell)/pedidos/_components/alert-sound.ts` → `src/app/painel/_components/alert-sound.ts`
- Rewrite: `src/app/painel/_components/new-orders-context.tsx`
- Create: `src/app/painel/_components/order-alert-bar.tsx`
- Create: `src/app/painel/(shell)/pedidos/_components/queue-controls.tsx`
- Delete: `src/app/painel/(shell)/pedidos/_components/queue-poller.tsx`
- Modify: `src/app/painel/(shell)/layout.tsx`, `src/app/painel/(shell)/page.tsx`, `src/app/painel/_components/new-orders-badge.tsx` (só se a API mudar)
- Test: `e2e/painel-pedidos.spec.ts`

**Interfaces:**
- Produces: `useNewOrders(): { count: number; version: string; offline: boolean; attending: boolean; alerting: boolean; startAttending(): void; silence(): void }` e `NewOrdersProvider({ initialCount, initialTotal, initialVersion, children })`.

- [ ] **Step 1: E2E que falha.** Em `e2e/painel-pedidos.spec.ts`, depois do primeiro teste, acrescentar:

```ts
test("atendimento continua depois de recarregar e alerta fora da página de pedidos", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.getByRole("button", { name: "Iniciar atendimento" }).click();
  await owner.reload();
  await expect(owner.getByText("Atendimento ativo: alerta sonoro ligado")).toBeVisible();

  await owner.getByRole("link", { name: "Cardápio" }).first().click();
  await expect(owner).toHaveURL(/\/painel\/cardapio$/);
  await customerOrder(browser);

  const alert = owner.getByTestId("new-order-alert");
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(owner).toHaveTitle(/^\(\d+\) Novo pedido/);
  await alert.getByRole("button", { name: "Silenciar" }).click();
  await expect(alert).toBeHidden();

  await customerOrder(browser);
  await expect(owner.getByTestId("new-order-alert")).toBeVisible({ timeout: 15_000 });
  await owner.getByTestId("new-order-alert").getByRole("link", { name: "Ver pedidos" }).click();
  await expect(owner).toHaveURL(/\/painel$/);
});
```

- [ ] **Step 2: Mover e ajustar o som.** `git mv src/app/painel/\(shell\)/pedidos/_components/alert-sound.ts src/app/painel/_components/alert-sound.ts` e trocar o conteúdo por:

```ts
/** Bipe repetido via Web Audio (sem arquivo). Só soa depois de `unlock()` num gesto do usuário. */
export function createAlertSound() {
  let context: AudioContext | null = null;
  let timer: number | null = null;

  function beep() {
    if (!context) return;
    // iOS suspende o contexto quando a aba vai para o fundo: retoma a cada bipe.
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  }

  return {
    unlock() {
      context ??= new AudioContext();
      void context.resume();
    },
    /** Começa a bipar; antes do `unlock` o intervalo roda em silêncio e passa a soar quando o áudio for liberado. */
    start() {
      if (timer !== null) return;
      beep();
      timer = window.setInterval(beep, 1200);
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    },
  };
}

export type AlertSound = ReturnType<typeof createAlertSound>;
```

- [ ] **Step 3: Reescrever `src/app/painel/_components/new-orders-context.tsx`:**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createAlertSound, type AlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const HIDDEN_INTERVAL = 15_000;
const MAX_INTERVAL = 30_000;
const FETCH_TIMEOUT = 8_000;
const ATTENDING_KEY = "naquela-mesa:atendimento";

type NewOrders = {
  /** Pedidos aguardando aceite (selo da barra lateral). */
  count: number;
  /** Muda a cada pedido novo ou mudança de status; a fila recarrega quando muda. */
  version: string;
  offline: boolean;
  /** "Iniciar atendimento" clicado nesta aba (vale até fechar a aba). */
  attending: boolean;
  /** Pedido novo sem resposta: som (se atendendo) e título piscando. */
  alerting: boolean;
  startAttending: () => void;
  silence: () => void;
};

const NewOrdersCtx = createContext<NewOrders | null>(null);

export function useNewOrders(): NewOrders {
  const ctx = useContext(NewOrdersCtx);
  if (!ctx) throw new Error("useNewOrders precisa estar dentro de NewOrdersProvider");
  return ctx;
}

function readAttending(): boolean {
  try {
    return window.sessionStorage.getItem(ATTENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Único observador da fila no painel: polling, contagem, som, título e notificação, em qualquer página. */
export function NewOrdersProvider({
  initialCount,
  initialTotal,
  initialVersion,
  children,
}: {
  initialCount: number;
  initialTotal: number;
  initialVersion: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [version, setVersion] = useState(initialVersion);
  const [offline, setOffline] = useState(false);
  const [attending, setAttending] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const total = useRef(initialTotal);
  const sound = useRef<AlertSound | null>(null);
  const attendingRef = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const baseTitle = useRef<string | null>(null);

  const getSound = useCallback(() => (sound.current ??= createAlertSound()), []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Wake Lock é opcional (nem todo navegador oferece).
    }
  }, []);

  // Atendimento iniciado antes de recarregar: o áudio só volta depois de um gesto na página.
  useEffect(() => {
    if (!readAttending()) return;
    attendingRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage só existe no cliente */
    setAttending(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const unlock = () => {
      getSound().unlock();
      void requestWakeLock();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [getSound, requestWakeLock]);

  // Polling da versão da fila.
  useEffect(() => {
    let failures = 0;
    let timer: number | undefined;
    let cancelled = false;
    let inFlight = false;

    function nextDelay() {
      const base = document.visibilityState === "visible" ? BASE_INTERVAL : HIDDEN_INTERVAL;
      return Math.min(Math.max(base, BASE_INTERVAL * 2 ** failures), MAX_INTERVAL);
    }

    function notify() {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
        }
      } catch {
        // Android lança "Illegal constructor"; a notificação é opcional.
      }
    }

    async function tick() {
      if (inFlight || cancelled) return;
      inFlight = true;
      const controller = new AbortController();
      const abortTimer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const response = await fetch("/api/painel/pedidos/versao", { cache: "no-store", signal: controller.signal });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          // Sessão/loja inválida: a página redireciona para /login. Para de consultar.
          cancelled = true;
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { version: string; received: number; total: number };
        if (cancelled) return;
        failures = 0;
        setOffline(false);
        const hasNew = data.total > total.current;
        total.current = data.total;
        setCount(data.received);
        setVersion(data.version);
        if (hasNew) {
          setAlerting(true);
          notify();
        } else if (data.received === 0) {
          setAlerting(false);
        }
      } catch {
        if (cancelled) return;
        setOffline(true);
        failures += 1;
      } finally {
        window.clearTimeout(abortTimer);
        inFlight = false;
      }
      if (!cancelled) timer = window.setTimeout(tick, nextDelay());
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void tick();
      if (attendingRef.current) void requestWakeLock();
    }

    timer = window.setTimeout(tick, nextDelay());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, requestWakeLock]);

  // Som enquanto houver alerta e o atendimento estiver ativo.
  useEffect(() => {
    if (!alerting || !attending) return;
    const current = getSound();
    current.start();
    return () => current.stop();
  }, [alerting, attending, getSound]);

  // Título "(N) Novo pedido — …" enquanto alerta; o refresh do Next reaplica o título do metadata, então reafirma.
  useEffect(() => {
    if (!alerting) return;
    baseTitle.current ??= document.title;
    const alertTitle = `(${count}) Novo pedido — ${baseTitle.current}`;
    document.title = alertTitle;
    const observer = new MutationObserver(() => {
      if (document.title !== alertTitle) document.title = alertTitle;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [alerting, count]);

  useEffect(() => {
    if (alerting || baseTitle.current === null) return;
    document.title = baseTitle.current;
    baseTitle.current = null;
  }, [alerting]);

  useEffect(
    () => () => {
      sound.current?.stop();
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    },
    [],
  );

  const startAttending = useCallback(() => {
    getSound().unlock();
    attendingRef.current = true;
    setAttending(true);
    try {
      window.sessionStorage.setItem(ATTENDING_KEY, "1");
    } catch {
      // modo privado: vale só até recarregar
    }
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    void requestWakeLock();
    // Pedidos que já esperavam antes do clique também tocam.
    if (count > 0) setAlerting(true);
  }, [count, getSound, requestWakeLock]);

  const silence = useCallback(() => setAlerting(false), []);

  const value = useMemo(
    () => ({ count, version, offline, attending, alerting, startAttending, silence }),
    [count, version, offline, attending, alerting, startAttending, silence],
  );
  return <NewOrdersCtx.Provider value={value}>{children}</NewOrdersCtx.Provider>;
}
```

- [ ] **Step 4: Barra de alerta (todas as páginas do shell).** Criar `src/app/painel/_components/order-alert-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRingIcon, WifiOffIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "./new-orders-context";

function waitingText(count: number): string {
  if (count === 1) return "1 pedido novo aguardando";
  if (count > 1) return `${count} pedidos novos aguardando`;
  return "Pedido novo";
}

/** Aviso de conexão e de pedido novo no topo de qualquer página do painel. */
export function OrderAlertBar() {
  const { count, offline, alerting, silence } = useNewOrders();
  const onQueue = usePathname() === "/painel";
  if (!offline && !alerting) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {offline && (
        <Alert variant="destructive" role="status">
          <WifiOffIcon />
          <AlertTitle>Sem conexão — tentando reconectar</AlertTitle>
        </Alert>
      )}
      {alerting && (
        <Alert role="alert" data-testid="new-order-alert">
          <BellRingIcon />
          <AlertTitle>{waitingText(count)}</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-1">
            {!onQueue && (
              <Button asChild size="sm">
                <Link href="/painel">Ver pedidos</Link>
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={silence}>
              Silenciar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Controles da fila.** Criar `src/app/painel/(shell)/pedidos/_components/queue-controls.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BellRingIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "@/app/painel/_components/new-orders-context";

/** Botão "Iniciar atendimento" e recarga da fila quando a versão muda. */
export function QueueControls() {
  const router = useRouter();
  const { version, attending, startAttending } = useNewOrders();
  const shown = useRef(version);

  useEffect(() => {
    if (version === shown.current) return;
    shown.current = version;
    router.refresh();
  }, [version, router]);

  return attending ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
      Atendimento ativo: alerta sonoro ligado
    </p>
  ) : (
    <Button type="button" onClick={startAttending} className="self-start">
      <BellRingIcon />
      Iniciar atendimento
    </Button>
  );
}
```

- [ ] **Step 6: Ligar no shell e na fila.**
  - `(shell)/layout.tsx`: `const [{ received, total, version }, openStatus] = await Promise.all([...])` e `<NewOrdersProvider initialCount={received} initialTotal={total} initialVersion={version}>`. Dentro do container de conteúdo: `<div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28"><OrderAlertBar />{children}</div>` (import de `@/app/painel/_components/order-alert-bar`).
  - `(shell)/page.tsx`: remover `getQueueVersion` e o import do `QueuePoller`; trocar `<QueuePoller … />` por `<QueueControls />` (import `./pedidos/_components/queue-controls`). Remover o comentário "Versão ANTES da lista…".
  - `git rm src/app/painel/\(shell\)/pedidos/_components/queue-poller.tsx`.
  - `new-orders-badge.tsx` continua usando `useNewOrders().count` (sem mudança se compilar).
  - `grep -rn "claimPolling\|QueuePoller\|setCount" src` → nada.

- [ ] **Step 7:** `npm run lint && npm run typecheck && npm test`. Commit: `feat: watch new orders on every panel page; alert until accepted or silenced`.

- [ ] **Step 8 (controlador): checkpoint E2E.** `make e2e`. Tudo verde antes de seguir.

---

### Task 7: Ações da fila não derrubam o painel (B8)

**Problema:** se `advanceOrderAction`/`cancelOrderAction` rejeitar (sem rede), o erro sobe para o error boundary e a aba em branco da comanda fica aberta.

**Files:**
- Modify: `src/app/_lib/action-state.ts`, `src/app/_lib/action-state.test.ts`
- Modify: `src/app/painel/(shell)/pedidos/_components/advance-button.tsx`, `cancel-form.tsx`

**Interfaces:**
- Produces: `CONNECTION_ERROR: string`, `connectionErrorState(): ActionState`, `withConnectionError<A extends unknown[]>(action: (...args: A) => Promise<ActionState>): (...args: A) => Promise<ActionState>` em `@/app/_lib/action-state`. A Task 8 usa `connectionErrorState`.

- [ ] **Step 1: Teste que falha** em `action-state.test.ts`:

```ts
import { CONNECTION_ERROR, success, withConnectionError } from "./action-state";

describe("withConnectionError", () => {
  it("devolve o resultado da action", async () => {
    await expect(withConnectionError(async () => success("ok"))()).resolves.toEqual(success("ok"));
  });

  it("transforma falha (rede, servidor fora) em estado de erro", async () => {
    const failing = withConnectionError(async (_prev: unknown) => {
      throw new TypeError("Failed to fetch");
    });
    await expect(failing(null)).resolves.toEqual({ status: "error", message: CONNECTION_ERROR, fieldErrors: {} });
  });
});
```

- [ ] **Step 2:** Em `action-state.ts`:

```ts
export const CONNECTION_ERROR = "Não foi possível salvar. Confira a conexão e tente de novo.";

export function connectionErrorState(): ActionState {
  return { status: "error", message: CONNECTION_ERROR, fieldErrors: {} };
}

/** Falha ao chamar a action (sem rede, servidor fora) vira estado de erro em vez de derrubar a tela. */
export function withConnectionError<A extends unknown[]>(action: (...args: A) => Promise<ActionState>) {
  return async (...args: A): Promise<ActionState> => {
    try {
      return await action(...args);
    } catch {
      return connectionErrorState();
    }
  };
}
```

- [ ] **Step 3:** `advance-button.tsx`: `useActionState(withConnectionError(advanceOrderAction), idleState)` — o efeito existente já fecha a aba e mostra o aviso em `status === "error"`. Para não recriar a função a cada render, declarar fora do componente: `const advance = withConnectionError(advanceOrderAction);`.

- [ ] **Step 4:** `cancel-form.tsx`: dentro do wrapper existente, chamar `await safeCancel(prev, form)` com `const safeCancel = withConnectionError(cancelOrderAction);` fora do componente.

- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: network failure on accept or cancel shows a notice instead of crashing the panel`.

---

### Task 8: Ações sem formulário mostram erro (B6)

**Problema:** `moveCategoryAction`, `moveSizeAction`, `deleteSizeAction`, `moveProductAction` e `setManualStatusAction` retornam `void` e descartam o erro; os botões de status da loja não mostram pendência nem erro.

**Files:**
- Modify: `src/app/painel/(shell)/cardapio/actions.ts`, `src/app/painel/(shell)/loja/actions.ts`
- Create: `src/app/painel/_components/run-panel-action.ts`
- Modify: `src/app/painel/(shell)/cardapio/_components/product-row.tsx`, `category-panel.tsx`, `sizes-editor.tsx`
- Modify: `src/app/painel/(shell)/loja/_components/status-buttons.tsx`
- Test: `e2e/helpers.ts` continua passando (usa `aria-pressed`)

**Interfaces:**
- Consumes: `connectionErrorState()` (Task 7).
- Produces: `runPanelAction(call: () => Promise<ActionState>): Promise<ActionState>`.

- [ ] **Step 1:** As cinco actions passam a retornar o estado:

```ts
export async function moveCategoryAction(form: FormData): Promise<ActionState> {
  return mutate((storeId) => moveCategory(storeId, text(form, "categoryId"), direction(form)), "Ordem salva.");
}
// moveSizeAction, moveProductAction: idem, mensagem "Ordem salva."
// deleteSizeAction: mensagem "Tamanho removido."
```

```ts
export async function setManualStatusAction(form: FormData): Promise<ActionState> {
  const status = MANUAL_STATUSES.find((value) => value === form.get("status"));
  if (!status) return fieldError("status", "status inválido");
  return mutate((storeId) => setManualStatus(storeId, status), "Status da loja atualizado.");
}
```

(`fieldError` já existe em `@/app/_lib/action-state`; importar se faltar.)

- [ ] **Step 2: Criar `src/app/painel/_components/run-panel-action.ts`:**

```ts
import { toast } from "sonner";
import { connectionErrorState, type ActionState } from "@/app/_lib/action-state";

/** Para ações sem formulário (mover, remover, status): erro vira toast; falha de rede também. */
export async function runPanelAction(call: () => Promise<ActionState>): Promise<ActionState> {
  let state: ActionState;
  try {
    state = await call();
  } catch {
    state = connectionErrorState();
  }
  if (state.status === "error") toast.error(state.message);
  return state;
}
```

- [ ] **Step 3: Usar nos chamadores.**
  - `product-row.tsx` → `move`: `await runPanelAction(() => moveProductAction(formWith({ productId: product.id, direction })));`
  - `category-panel.tsx` → `move`: `await runPanelAction(() => moveCategoryAction(form));`
  - `sizes-editor.tsx`: `<form action={(form) => runPanelAction(() => moveSizeAction(form))} …>` e `<form action={(form) => runPanelAction(() => deleteSizeAction(form))} onSubmit={…confirm…} …>` (o `onSubmit` com `window.confirm` continua).

- [ ] **Step 4: `status-buttons.tsx` vira client component** (o `aria-pressed` vem do `current` que o servidor manda depois do refresh disparado pelo `updateTag`):

```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ManualStatus } from "@/modules/stores";
import { runPanelAction } from "@/app/painel/_components/run-panel-action";
import { setManualStatusAction } from "@/app/painel/(shell)/loja/actions";

const OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "force_open", label: "Abrir agora" },
  { value: "force_closed", label: "Fechar agora" },
];

/** Botões segmentados; `aria-pressed` marca o status atual. */
export function StatusButtons({ current }: { current: ManualStatus }) {
  const [pending, startTransition] = useTransition();

  function choose(status: ManualStatus) {
    const form = new FormData();
    form.set("status", status);
    startTransition(async () => {
      await runPanelAction(() => setManualStatusAction(form));
    });
  }

  return (
    <div role="group" aria-label="Status da loja" aria-busy={pending || undefined} className="inline-flex w-fit flex-wrap rounded-lg border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          variant={current === option.value ? "default" : "ghost"}
          disabled={pending}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
```

`ManualStatus` é tipo; conferir que `@/modules/stores` pode ser importado de client component só como `import type` (sim, é só tipo).

- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: show errors from reorder, size removal and store status buttons`.

---

### Task 9: Erro de preço por tamanho destaca o campo certo (B5)

**Problema:** preço acima do máximo numa categoria com tamanhos volta como `sizePrices.0.priceCents`; o form só mostra `price:<sizeId>`/`sizePrices`, então aparece "Confira os campos destacados." sem nada destacado.

**Files:**
- Create: `src/app/painel/(shell)/cardapio/_lib/size-price-errors.ts`, `size-price-errors.test.ts`
- Modify: `src/app/painel/(shell)/cardapio/actions.ts` (`saveProductAction`)

- [ ] **Step 1: Teste que falha:**

```ts
import { describe, expect, it } from "vitest";
import { success } from "@/app/_lib/action-state";
import { mapSizePriceErrors } from "./size-price-errors";

describe("mapSizePriceErrors", () => {
  const sizes = [{ sizeId: "broto" }, { sizeId: "grande" }];

  it("aponta o erro do índice para o campo do tamanho", () => {
    const state = { status: "error" as const, message: "Confira os campos destacados.", fieldErrors: { "sizePrices.1.priceCents": "preço acima do limite", name: "obrigatório" } };
    expect(mapSizePriceErrors(state, sizes)).toEqual({
      ...state,
      fieldErrors: { "price:grande": "preço acima do limite", name: "obrigatório" },
    });
  });

  it("mantém a chave quando o índice não existe e não mexe em sucesso", () => {
    const state = { status: "error" as const, message: "x", fieldErrors: { "sizePrices.9.priceCents": "y" } };
    expect(mapSizePriceErrors(state, sizes)).toEqual(state);
    expect(mapSizePriceErrors(success("ok"), sizes)).toEqual(success("ok"));
  });
});
```

- [ ] **Step 2: Implementar:**

```ts
import type { ActionState } from "@/app/_lib/action-state";

/** Erros do schema por índice (`sizePrices.0.priceCents`) passam a apontar para o campo do tamanho (`price:<id>`). */
export function mapSizePriceErrors(state: ActionState, sizePrices: { sizeId: string }[]): ActionState {
  if (state.status !== "error") return state;
  const fieldErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(state.fieldErrors)) {
    const match = /^sizePrices\.(\d+)/.exec(key);
    const sizeId = match ? sizePrices[Number(match[1])]?.sizeId : undefined;
    fieldErrors[sizeId ? `price:${sizeId}` : key] = message;
  }
  return { ...state, fieldErrors };
}
```

- [ ] **Step 3:** Em `saveProductAction`: `return mapSizePriceErrors(await mutate(…), parsed.input.sizePrices);`

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: highlight the size price field that failed validation`.

---

### Task 10: Sacola recalculada com o cardápio atual (A6, B3)

**Problema:** a sacola guarda o preço do momento em que o item foi adicionado. Se o dono muda preço ou marca o item como esgotado, a sacola mostra valor velho, o aviso de pedido mínimo erra, e o erro só aparece no fim ("item não está disponível", sem dizer qual).

**Decisão:** a página da sacola já tem o cardápio em cache (`getStorePageData`); ele vai para o cliente e cada linha é recalculada com o mesmo `priceItem` do servidor. Linha que não dá mais para pedir aparece marcada, e "Continuar" fica bloqueado até remover. O servidor continua conferindo tudo na revisão.

**Files:**
- Create: `src/app/[slug]/_lib/reprice-cart.ts`, `reprice-cart.test.ts`
- Modify: `src/app/[slug]/sacola/page.tsx`, `src/app/[slug]/sacola/_components/checkout.tsx`, `cart-step.tsx`
- Modify: `src/app/[slug]/sacola/messages.ts`, `messages.test.ts`
- Test: `e2e/pedido.spec.ts`

**Interfaces:**
- Consumes: `priceItem`, `PricingContext`, `CartItemInput` de `@/modules/orders/client`; `CartLine` de `@/app/[slug]/_components/cart-storage`.
- Produces: `repriceCart(ctx: PricingContext, lines: CartLine[]): { lines: RepricedLine[]; subtotalCents: number; hasProblems: boolean }`, `type RepricedLine = { line: CartLine; totalCents: number | null; problem: string | null }`. `CheckoutStore` ganha `pricing: PricingContext` (a Task 11 acrescenta `closedMessage`).

- [ ] **Step 1: Teste unitário que falha** (`src/app/[slug]/_lib/reprice-cart.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { Menu } from "@/modules/catalog";
import type { PricingContext } from "@/modules/orders/client";
import type { CartLine } from "@/app/[slug]/_components/cart-storage";
import { repriceCart } from "./reprice-cart";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COCA = id(1);
const AGUA = id(2);

const menu: Menu = {
  categories: [
    {
      id: id(100),
      name: "Bebidas",
      sizes: [],
      products: [
        { id: COCA, name: "Coca-Cola 2L", description: null, imageUrl: null, priceCents: 1500, sizePrices: [], allowsHalf: false, available: true, optionGroupIds: [] },
        { id: AGUA, name: "Água", description: null, imageUrl: null, priceCents: 400, sizePrices: [], allowsHalf: false, available: false, optionGroupIds: [] },
      ],
    },
  ],
  optionGroups: [],
};
const ctx: PricingContext = { menu, halfPriceRule: "highest", halfAndHalfEnabled: true, addonsEnabled: true };

function line(productId: string, quantity: number, unitPriceCents: number): CartLine {
  return { key: productId, label: "x", unitPriceCents, input: { kind: "simple", productId, optionIds: [], quantity, notes: null } };
}

describe("repriceCart", () => {
  it("usa o preço atual do cardápio, não o guardado", () => {
    const result = repriceCart(ctx, [line(COCA, 2, 1400)]);
    expect(result.subtotalCents).toBe(3000);
    expect(result.hasProblems).toBe(false);
    expect(result.lines[0]).toMatchObject({ totalCents: 3000, problem: null });
  });

  it("marca item esgotado ou removido e não soma no subtotal", () => {
    const result = repriceCart(ctx, [line(COCA, 1, 1400), line(AGUA, 1, 400), line(id(99), 1, 900)]);
    expect(result.subtotalCents).toBe(1500);
    expect(result.hasProblems).toBe(true);
    expect(result.lines[1]).toMatchObject({ totalCents: null, problem: "não está mais disponível" });
    expect(result.lines[2]).toMatchObject({ totalCents: null, problem: "não está mais disponível" });
  });
});
```

- [ ] **Step 2: Implementar `src/app/[slug]/_lib/reprice-cart.ts`:**

```ts
import { priceItem, type PricingContext } from "@/modules/orders/client";
import { isDomainError } from "@/shared/errors";
import type { CartLine } from "@/app/[slug]/_components/cart-storage";

export type RepricedLine = { line: CartLine; totalCents: number | null; problem: string | null };

const PROBLEMS: Record<string, string> = {
  ITEM_UNAVAILABLE: "não está mais disponível",
  INVALID_OPTIONS: "mudou no cardápio",
};

/** Recalcula a sacola com o cardápio atual: preço de agora por linha, ou por que não dá mais para pedir. */
export function repriceCart(ctx: PricingContext, lines: CartLine[]): { lines: RepricedLine[]; subtotalCents: number; hasProblems: boolean } {
  const repriced = lines.map((line, index): RepricedLine => {
    try {
      return { line, totalCents: priceItem(ctx, line.input, index).totalCents, problem: null };
    } catch (error) {
      if (!isDomainError(error)) throw error;
      return { line, totalCents: null, problem: PROBLEMS[error.code] ?? "mudou no cardápio" };
    }
  });
  return {
    lines: repriced,
    subtotalCents: repriced.reduce((sum, item) => sum + (item.totalCents ?? 0), 0),
    hasProblems: repriced.some((item) => item.problem !== null),
  };
}
```

Rodar o teste → PASS.

- [ ] **Step 3: Sacola recebe o cardápio.** Em `sacola/page.tsx`, `const { store, zones, menu } = data;` e no objeto `store` do `<Checkout>`:

```tsx
              pricing: {
                menu,
                halfPriceRule: store.rules.halfPriceRule,
                halfAndHalfEnabled: store.features.halfAndHalf,
                addonsEnabled: store.features.addons,
              },
```

- [ ] **Step 4: `checkout.tsx`.**
  - `CheckoutStore` ganha `pricing: PricingContext` (import type de `@/modules/orders/client`).
  - `const repriced = useMemo(() => repriceCart(store.pricing, cart.lines), [store.pricing, cart.lines]);` (import `useMemo`).
  - `missingForMinCents` passa a usar `repriced.subtotalCents` no lugar de `cart.estimatedSubtotalCents`; o rodapé idem (`formatBRL(step === 4 && quote ? quote.totalCents : repriced.subtotalCents)`).
  - O botão Continuar: `disabled={!cart.ready || cart.lines.length === 0 || (step === 1 && (missingForMinCents > 0 || repriced.hasProblems))}`.
  - `<CartStep … lines={repriced.lines} />`.
  - No `Alert` de erro, mostrar "Voltar à sacola" também para item indisponível: `{["BELOW_MIN_ORDER", "ITEM_UNAVAILABLE", "INVALID_OPTIONS"].includes(error.code) && (…botão…)}`.

- [ ] **Step 5: `cart-step.tsx`** recebe `lines: RepricedLine[]` e itera sobre elas (`{lines.map(({ line, totalCents, problem }) => …)}`), mantendo os botões que usam `cart.setQuantity`/`cart.remove`. Preço da linha: `{totalCents === null ? "—" : formatBRL(totalCents)}`. Logo abaixo do rótulo, quando `problem`:

```tsx
            {problem && (
              <p data-testid="cart-line-problem" className="text-sm text-destructive">
                Este item {problem}. Remova para continuar.
              </p>
            )}
```

- [ ] **Step 6: Mensagem do servidor diz qual item.** Em `messages.ts`:

```ts
    case "ITEM_UNAVAILABLE":
      return plain(
        error.code,
        `O item ${Number(details.itemIndex ?? 0) + 1} da sacola não está mais disponível (${String(details.name ?? "item")}). Volte à sacola para remover.`,
      );
```

e em `messages.test.ts` a linha correspondente vira:

```ts
    [new DomainError("ITEM_UNAVAILABLE", { itemIndex: 0, name: "Calabresa" }), "O item 1 da sacola não está mais disponível (Calabresa). Volte à sacola para remover."],
```

- [ ] **Step 7: E2E.** Em `e2e/pedido.spec.ts` (importar `loginAsOwner` de `./helpers`):

```ts
test("item que saiu do cardápio fica marcado na sacola e bloqueia o avanço", async ({ page, browser }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Coca-Cola 2L", 3);

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAsOwner(owner, "/painel/cardapio");
  const toggle = owner.getByRole("switch", { name: "Disponível: Coca-Cola 2L" });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  try {
    await page.goto("/pizzaria-demo/sacola");
    await expect(page.getByTestId("cart-line-problem")).toContainText("não está mais disponível");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await page.getByRole("button", { name: "Remover Coca-Cola 2L" }).click();
    await expect(page.getByText("Sua sacola está vazia.")).toBeVisible();
  } finally {
    await toggle.click();
    await expect(toggle).toBeChecked();
    await ownerContext.close();
  }
});
```

- [ ] **Step 8:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: reprice the bag against the current menu and flag items that left it`.

---

### Task 11: Loja fechada avisa já na sacola (A7)

**Files:**
- Modify: `src/app/[slug]/sacola/page.tsx`, `src/app/[slug]/sacola/_components/checkout.tsx`
- Test: `e2e/pedido.spec.ts` (teste `"loja fechada bloqueia a revisão do pedido"`)

**Interfaces:**
- Consumes: `CheckoutStore` da Task 10. Produces: `CheckoutStore.closedMessage: string | null`.

- [ ] **Step 1: E2E que falha.** Substituir o teste `"loja fechada bloqueia a revisão do pedido"` por:

```ts
test("loja fechada avisa na sacola e não deixa continuar", async ({ page, browser }) => {
  await setStoreStatus(browser, "Fechar agora");
  try {
    await page.goto("/pizzaria-demo");
    await addSimple(page, "Coca-Cola 2L", 3);
    await page.getByRole("link", { name: "Ver sacola" }).click();
    await expect(page.getByTestId("store-closed")).toContainText("A loja está fechada agora.");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  } finally {
    await setStoreStatus(browser, "Abrir agora");
  }
});
```

- [ ] **Step 2: Página calcula o status.** Em `sacola/page.tsx`, dentro de `CheckoutContent` (já está dentro de `Suspense`):

```tsx
import { connection } from "next/server";
import { formatOpenStatus, getOpenStatus, SLUG_PATTERN } from "@/modules/stores";
// ...
  // Aberto/fechado depende da hora: calculado a cada requisição (os dados da loja continuam em cache).
  await connection();
  const status = getOpenStatus({ hours: store.hours, manualStatus: store.manualStatus, timeZone: store.timezone, now: new Date() });
// ... no objeto store do Checkout:
              closedMessage: status.isOpen ? null : formatOpenStatus(status),
```

- [ ] **Step 3: `checkout.tsx`.** `CheckoutStore` ganha `closedMessage: string | null`. Logo no início do conteúdo (antes do `<CartStep>`):

```tsx
        {store.closedMessage !== null && (
          <Alert data-testid="store-closed">
            <AlertDescription>A loja está fechada agora. {store.closedMessage}</AlertDescription>
          </Alert>
        )}
```

Botão Continuar: acrescentar `|| store.closedMessage !== null` ao `disabled`; botão "Revisar pedido": idem.

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: tell customers the store is closed before they fill the checkout`.

---

### Task 12: Telefone inválido barrado já na revisão (B2)

**Files:**
- Modify: `src/modules/orders/service.ts` (`quoteOrder`)
- Test: `src/modules/orders/service.int.test.ts`

- [ ] **Step 1: Teste de integração que falha** (dentro do `describe("orders service")`):

```ts
  it("revisão já recusa telefone inválido", async () => {
    const ids = await setupStore();
    await expect(quoteOrder(SLUG, checkout(ids, { customer: { name: "Maria", phone: "123" } }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "customer.phone" }] },
    });
  });
```

Rodar `npm run test:int -- src/modules/orders/service.int.test.ts` → FAIL.

- [ ] **Step 2:** Extrair a checagem para uma função usada pelos dois caminhos:

```ts
function assertPhone(input: ParsedCheckout): string {
  const phone = normalizeBrazilPhone(input.customer.phone);
  if (!phone) throw validation("customer.phone", "telefone inválido (use DDD + número)");
  return phone;
}

export async function quoteOrder(slug: string, rawInput: unknown, now: Date = new Date()): Promise<OrderQuote> {
  const input = parseCheckout(rawInput);
  assertPhone(input);
  const store = await loadStore(slug);
  return quoteFor(store, input, now);
}
```

e em `createOrder`: `const phone = assertPhone(input);` no lugar das duas linhas atuais.

- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test && npm run test:int`. Commit: `fix: reject an invalid phone at review time, not at confirmation`.

---

### Task 13: Pagamento e entrega com rótulos certos; motivo do cancelamento para o cliente (B4, A9)

**Files:**
- Modify: `src/modules/orders/labels.ts`, `labels.test.ts`
- Modify: `src/modules/orders/service.ts` (`OrderTracking`, `getOrderTracking`)
- Modify: `src/app/[slug]/pedido/[token]/page.tsx`, `_components/order-timeline.tsx`
- Modify: `src/app/[slug]/sacola/_components/checkout.tsx`, `payment-step.tsx`
- Modify: `src/app/painel/(shell)/pedidos/_components/order-card.tsx`, `history-list.tsx`, `src/app/painel/pedidos/[id]/imprimir/page.tsx`
- Test: `e2e/painel-pedidos.spec.ts`, `src/modules/orders/service.int.test.ts`

**Interfaces:**
- Produces: `paymentLabel(method: PaymentMethod, fulfillment: Fulfillment): string` exportada por `@/modules/orders` e `@/modules/orders/client` (via `export *` de `labels`). `OrderTracking.cancelReason: string | null`.

- [ ] **Step 1: Testes que falham.** Em `labels.test.ts`:

```ts
describe("paymentLabel", () => {
  it("cartão só é 'na entrega' no delivery", () => {
    expect(paymentLabel("card_on_delivery", "delivery")).toBe("Cartão na entrega");
    expect(paymentLabel("card_on_delivery", "pickup")).toBe("Cartão (maquininha)");
    expect(paymentLabel("card_on_delivery", "dine_in")).toBe("Cartão (maquininha)");
    expect(paymentLabel("pix", "pickup")).toBe("Pix");
  });
});
```

Em `service.int.test.ts`, no teste existente que cancela um pedido (procurar `cancelReason` / `"cancelled"`), acrescentar `expect((await getOrderTracking(token))?.cancelReason).toBe(<motivo usado no teste>)`. Se nenhum teste de integração cancela, criar um que cria o pedido com `createOrder`, chama `transitionOrder(storeId, orderId, "cancelled", { userId, cancelReason: "acabou a massa" })` como os testes de `queue.int.test.ts` fazem, e confere o `cancelReason` do tracking.

No E2E `"cancelar exige motivo e aparece para o cliente"`, depois de `toHaveText("Cancelado")`:

```ts
  await expect(customer.getByText("Motivo: acabou a massa")).toBeVisible();
```

- [ ] **Step 2: `labels.ts`:**

```ts
/** "Cartão na entrega" só faz sentido no delivery; na retirada e na mesa é a maquininha da loja. */
export function paymentLabel(method: PaymentMethod, fulfillment: Fulfillment): string {
  if (method === "card_on_delivery" && fulfillment !== "delivery") return "Cartão (maquininha)";
  return PAYMENT_LABELS[method];
}
```

- [ ] **Step 3: Trocar `PAYMENT_LABELS[order.paymentMethod]` por `paymentLabel(order.paymentMethod, order.fulfillment)`** em `pedido/[token]/page.tsx`, `order-card.tsx`, `history-list.tsx` e `imprimir/page.tsx` (todos têm `order.fulfillment`). Remover o import de `PAYMENT_LABELS` onde ficar sem uso.

- [ ] **Step 4: Checkout.** Em `checkout.tsx`, o rótulo do cartão depende do tipo escolhido: mover a montagem de `payments` para depois do `useState` de `fulfillment` e usar `paymentLabel("card_on_delivery", fulfillment)` no lugar de `"Cartão na entrega"` (as outras opções continuam "Dinheiro" e "Pix"). Atenção: `payment` inicial usa `payments[0]`; calcular a lista de métodos habilitados (sem rótulo) antes do `useState` e o rótulo depois.

- [ ] **Step 5: Linha "Entrega" só no delivery.** `payment-step.tsx` ganha a prop `fulfillment: Fulfillment` (passada pelo `checkout.tsx`) e renderiza o par `Entrega` só quando `fulfillment === "delivery"`. Na página de acompanhamento, idem com `order.fulfillment === "delivery"`.

- [ ] **Step 6: Motivo do cancelamento.**
  - `OrderTracking` ganha `cancelReason: string | null`; `getOrderTracking` devolve `cancelReason: order.cancelReason`.
  - `OrderTimeline` recebe `cancelReason?: string | null` e, no alerta de cancelado:

```tsx
        <AlertDescription>
          {cancelReason ? `Motivo: ${cancelReason}. ` : ""}Fale com a loja pelo WhatsApp se tiver dúvidas.
        </AlertDescription>
```

  - A página passa `cancelReason={order.cancelReason}`.

- [ ] **Step 7:** `npm run lint && npm run typecheck && npm test && npm run test:int`. Commit: `fix: card label by order type, delivery row only for delivery, cancel reason on tracking`.

- [ ] **Step 8 (controlador): checkpoint E2E.** `make e2e`.

---

### Task 14: Título da aba por contexto e prévia do link (issue #2, B1)

**Alvo (issue #2):** landing `Naquela Mesa`; cardápio `<Loja>`; painel (todas as páginas) `<Loja> - Painel`; admin `Naquela Mesa - Admin`. Sacola `<Loja> - Sacola`; acompanhamento `Pedido #0001 - <Loja>`. Link do cardápio no WhatsApp mostra nome, descrição e capa (ou logo).

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[slug]/page.tsx`, `src/app/[slug]/sacola/page.tsx`, `src/app/[slug]/pedido/[token]/page.tsx`, `src/app/painel/(shell)/layout.tsx`, `src/app/admin/layout.tsx`
- Test: `e2e/menu.spec.ts`, `e2e/painel.spec.ts`, `e2e/admin.spec.ts`

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` (seções `metadataBase`, `openGraph` e "With Cache Components").

- [ ] **Step 2: E2E que falham.**
  - `menu.spec.ts`: trocar `toHaveTitle("Pizzaria Demo | Naquela Mesa")` por `toHaveTitle("Pizzaria Demo")` e acrescentar:

```ts
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Pizzaria Demo");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /Pizzaria Demo/);
```

  - `painel.spec.ts`, no teste do link de adicionais (Task 2): `await expect(page).toHaveTitle("Pizzaria Demo - Painel");` antes de clicar.
  - `admin.spec.ts`, no primeiro teste depois de entrar: `await expect(page).toHaveTitle("Naquela Mesa - Admin");`.

- [ ] **Step 3: Root layout com `metadataBase`.** Em `src/app/layout.tsx`, trocar o `export const metadata` por:

```tsx
import { appUrl } from "@/shared/env";
// ...
export function generateMetadata(): Metadata {
  return {
    // URLs relativas do openGraph (/uploads/…) viram absolutas com o endereço público do app.
    metadataBase: new URL(appUrl()),
    title: "Naquela Mesa",
    description: "Cardápio digital e pedidos para restaurantes da região.",
  };
}
```

- [ ] **Step 4: Landing.** `src/app/page.tsx`: `title: "Naquela Mesa"` (descrição igual) e `openGraph: { title: "Naquela Mesa", description: <mesma descrição>, type: "website" }`.

- [ ] **Step 5: Cardápio.** `src/app/[slug]/page.tsx`:

```tsx
export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) return {};
  const data = await getStorePageData(slug);
  if (!data) return {};
  const { store } = data;
  const description = `Cardápio e pedidos online de ${store.name}. Peça pelo celular, sem baixar app.`;
  const image = store.bannerUrl ?? store.logoUrl;
  return {
    title: store.name,
    description,
    openGraph: { title: store.name, description, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
  };
}
```

- [ ] **Step 6:** Sacola: `title: \`${data.store.name} - Sacola\``. Acompanhamento: `title: \`Pedido ${formatOrderNumber(order.number)} - ${order.store.name}\``.

- [ ] **Step 7: Painel.** Em `src/app/painel/(shell)/layout.tsx`:

```tsx
import type { Metadata } from "next";
// ...
// Vale para todas as páginas do shell (nenhuma define título próprio). O shell já é dinâmico (sessão).
export async function generateMetadata(): Promise<Metadata> {
  const { store } = await requireStoreAccess();
  return { title: `${store.name} - Painel` };
}
```

- [ ] **Step 8: Admin.** `src/app/admin/layout.tsx`: `export const metadata: Metadata = { title: "Naquela Mesa - Admin" };`.

- [ ] **Step 9:** `npm run lint && npm run typecheck && npm test && npm run build` (o build pega erro de prerender de metadata com `cacheComponents`). Commit: `feat: tab titles per context and link preview for store menus`.

---

### Task 15: Upload de logo/capa/foto com botão (issue #1)

**Files:**
- Modify: `src/app/_components/image-upload-field.tsx`
- Test: `e2e/painel.spec.ts` (o teste de logo usa `getByLabel("Logo").setInputFiles` e deve continuar passando)

- [ ] **Step 1:** Trocar o `<Input type="file">` visível por input escondido + botão; limpar o valor do input depois do envio (permite escolher o mesmo arquivo de novo); limpar o erro ao remover; primeira letra maiúscula na mensagem do servidor.

```tsx
import { ImageUpIcon } from "lucide-react";
import { useRef } from "react";
// ...
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("file", await resizeForUpload(file), "imagem");
      try {
        const response = await fetch("/api/painel/upload", { method: "POST", body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (result.url) setUrl(result.url);
        else setError(capitalize(result.error ?? "não foi possível enviar a imagem."));
      } catch {
        setError("Não foi possível enviar a imagem.");
      }
    });
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input ref={inputRef} id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={pending} className="sr-only" />
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center gap-3">
        {url && <Image src={url} alt={`Prévia: ${label}`} width={80} height={80} unoptimized className="size-20 rounded-md border object-cover" />}
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
          <ImageUpIcon />
          {pending ? "Enviando..." : url ? "Trocar imagem" : "Escolher imagem"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUrl("");
              setError(null);
            }}
          >
            Remover imagem
          </Button>
        )}
      </div>
      <FieldDescription>JPG, PNG ou WebP, até 5 MB.</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
```

com, no mesmo arquivo:

```ts
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
```

Remover o `{pending && <FieldDescription>Enviando imagem...</FieldDescription>}` (o botão mostra "Enviando..."). Remover o import de `Input` se ficar sem uso.

- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test`. Commit: `feat: button to pick logo, cover and product images`.

---

### Task 16: Login com mensagens certas (B9)

**Files:**
- Create: `src/app/login/login-error.ts`, `login-error.test.ts`
- Modify: `src/app/login/login-form.tsx`

- [ ] **Step 1: Teste que falha:**

```ts
import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./login-error";

describe("loginErrorMessage", () => {
  it("credencial errada", () => {
    expect(loginErrorMessage(401)).toBe("Email ou senha inválidos.");
    expect(loginErrorMessage(400)).toBe("Email ou senha inválidos.");
  });
  it("muitas tentativas", () => {
    expect(loginErrorMessage(429)).toBe("Muitas tentativas. Tente novamente em instantes.");
  });
  it("servidor fora ou sem rede não culpa a senha", () => {
    expect(loginErrorMessage(500)).toBe("Não foi possível entrar agora. Tente de novo em instantes.");
    expect(loginErrorMessage(undefined)).toBe("Não foi possível entrar agora. Tente de novo em instantes.");
  });
});
```

- [ ] **Step 2: `login-error.ts`:**

```ts
/** Mensagem do login a partir do status HTTP do Better Auth (sem status: falha de rede). */
export function loginErrorMessage(status: number | undefined): string {
  if (status === 429) return "Muitas tentativas. Tente novamente em instantes.";
  if (status === 400 || status === 401 || status === 403) return "Email ou senha inválidos.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}
```

- [ ] **Step 3: `login-form.tsx`:**

```tsx
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (signInError) {
        setError(loginErrorMessage(signInError.status));
        return;
      }
      const isSuperAdminUser = data?.user && "role" in data.user && data.user.role === "super_admin";
      router.push(safeNextPath(searchParams.get("next")) ?? (isSuperAdminUser ? "/admin" : "/painel"));
      router.refresh();
    } catch {
      setError(loginErrorMessage(undefined));
    } finally {
      setPending(false);
    }
  }
```

(Conferir que `e2e/auth.spec.ts` continua esperando `"Email ou senha inválidos."` para senha errada; o Better Auth responde 401.)

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `fix: login tells a server failure apart from a wrong password`.

---

### Task 17: Health check (B12)

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `e2e/health.spec.ts`
- Modify: `playwright.config.ts` (projeto `publico` passa a incluir `**/health.spec.ts`)

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

- [ ] **Step 2: E2E:**

```ts
import { expect, test } from "@playwright/test";

test("health check responde com o banco no ar", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ ok: true });
});
```

- [ ] **Step 3: Rota:**

```ts
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { db } from "@/shared/db/client";

const NO_STORE = { "Cache-Control": "no-store" };

/** Para monitor de uptime: 200 com o banco respondendo, 503 sem detalhes caso contrário. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
```

(Juntar os dois imports de `next/server` numa linha. Se o lint de fronteiras proibir `@/shared/db/client` em `src/app`, expor uma função `checkDatabase(): Promise<boolean>` em `src/shared/db/` e usá-la.)

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit: `feat: health check endpoint for uptime monitoring`.

---

### Task 18: Dependências (B11)

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm outdated`. Atualizar só patch/minor dentro do mesmo major: `next` e `eslint-config-next` (mesma versão, 16.4.x), `better-auth` (1.7.x), `@sentry/nextjs` (11.x), `@vercel/blob` (2.x), `react` e `react-dom` (19.3.x, mesma versão). Exemplo: `npm install next@16.4.2 eslint-config-next@16.4.2 better-auth@1.7.10 react@19.3.1 react-dom@19.3.1 @sentry/nextjs@^11 @vercel/blob@^2` (usar as versões que o `npm outdated` mostrar em "Wanted").
- [ ] **Step 2:** Mover `shadcn` de `dependencies` para `devDependencies` (é CLI; o `globals.css` importa `shadcn/tailwind.css` só no build, e a Vercel instala devDependencies no build): `npm uninstall shadcn && npm install -D shadcn@<versão atual>`.
- [ ] **Step 3:** `npm audit --omit=dev` — anotar o resultado no relatório (não forçar downgrade).
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build`. Commit: `chore: patch updates for next, better-auth, react and sentry; shadcn as dev dependency`.

---

### Task 19: Verificação final (controlador)

- [ ] **Step 1:** `make test` (lint, tipos, unit, integração).
- [ ] **Step 2:** `make e2e`. Tudo verde.
- [ ] **Step 3:** Revisão final da branch inteira (subagente revisor) contra este plano.
- [ ] **Step 4:** Reiniciar o dev do usuário em :3001 (só o PID dele, `rm -rf .next/dev`) e avisar para dar Ctrl+Shift+R — vários arquivos foram movidos/removidos.
