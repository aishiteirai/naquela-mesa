# Retirada sem escolha de pagamento + rota /cart · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Pedido de retirada não pergunta forma de pagamento: assume "pagar na retirada". (2) A sacola passa de `/[slug]/sacola` para `/[slug]/cart`, com redirect do caminho antigo.

**Architecture:** Novo método de pagamento `on_pickup` (texto no banco, enum só no TypeScript — sem migração). Servidor amarra `on_pickup` ⇔ `fulfillment === "pickup"`. A rota muda com `git mv` da pasta e um redirect em `next.config.ts`.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Drizzle, Zod 4, Vitest, Playwright.

**Spec:** pedido do usuário em 2026-10-21 ("ao clicar em retirar o pedido, assumir que o pagamento será na retirada"; "alterar path /sacola para /cart"). Sem spec separado.

## Global Constraints

- Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código Next.
- Imports com `@/…`; o lint proíbe `../`.
- Commits em inglês, com o Co-Authored-By do modelo que você é. Nunca alterar `git config`.
- Textos de interface em português, exatamente como aqui.
- Sem migração SQL (`payment_method` é `text` sem CHECK no banco).
- Consumo no local (`dine_in`) e delivery continuam escolhendo pagamento como hoje.
- A chave do localStorage da sacola (`naquela-mesa:sacola:<slug>`) **não muda** (sacolas abertas continuam valendo).
- Verificação: `npm run lint` (0 erros, 0 warnings) `&& npm run typecheck && npm test`; tarefas que tocam `src/modules/**` também `npm run test:int` (Docker: `COMPOSE_PROJECT_NAME=ecom-menu`). Não rodar `make e2e` (o controlador roda).
- Repo: worktree `/home/ryan/workspace/personalprojects/ecom-menu-lote1`, branch `piloto-lote-1`.

## Review Focus

1. Cliente escolhe Retirada, depois volta e escolhe Delivery: a forma de pagamento volta a aparecer e não fica presa em `on_pickup` — teste E2E na Task 1.
2. Requisição forjada com `fulfillment: "delivery"` e `payment.method: "on_pickup"` (ou retirada com `pix`) é recusada no servidor — teste de integração na Task 1.
3. Link antigo `/<loja>/sacola` (favorito, histórico) leva para `/<loja>/cart` — teste E2E na Task 2.

---

### Task 1: Retirada assume "pagar na retirada"

**Files:**
- Modify: `src/modules/orders/types.ts` (`PAYMENT_METHODS`)
- Modify: `src/modules/orders/labels.ts`, `labels.test.ts`
- Modify: `src/modules/orders/service.ts` (`assertOperation`)
- Modify: `src/modules/orders/service.int.test.ts`
- Modify: `src/app/[slug]/sacola/_components/checkout.tsx`, `payment-step.tsx`
- Modify: `src/app/[slug]/sacola/messages.ts` se houver código de erro novo (ver Step 3)
- Modify: `e2e/helpers.ts` (`placePickupOrder`), `e2e/pedido.spec.ts`, e qualquer outro spec que marque pagamento numa retirada (`grep -rn "Retirada no balcão" e2e`)

**Interfaces:**
- Produces: `PaymentMethod` ganha `"on_pickup"`; `PAYMENT_LABELS.on_pickup === "Pagar na retirada"`.

- [ ] **Step 1: Testes que falham.**
  - `labels.test.ts`: `expect(PAYMENT_LABELS.on_pickup).toBe("Pagar na retirada")` e `expect(paymentLabel("on_pickup", "pickup")).toBe("Pagar na retirada")`.
  - `service.int.test.ts` (use o helper `checkout(ids, overrides)` do arquivo; a loja de teste precisa ter `pickup` habilitado — conferir `setupStore`):

```ts
  it("retirada assume pagamento na retirada e o servidor amarra os dois", async () => {
    const ids = await setupStore();
    const pickup = { fulfillment: "pickup", address: null, payment: { method: "on_pickup", changeForCents: null } };
    await expect(quoteOrder(SLUG, checkout(ids, pickup))).resolves.toMatchObject({ deliveryFeeCents: 0 });
    await expect(
      quoteOrder(SLUG, checkout(ids, { ...pickup, payment: { method: "pix", changeForCents: null } })),
    ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
    await expect(
      quoteOrder(SLUG, checkout(ids, { payment: { method: "on_pickup", changeForCents: null } })),
    ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
  });
```

  (Se `setupStore` não habilita pickup ou pix, ajuste o override do teste — não a regra.) Rodar → FAIL.

- [ ] **Step 2: Tipos e rótulos.**
  - `types.ts`: `export const PAYMENT_METHODS = ["cash", "card_on_delivery", "pix", "on_pickup"] as const;`
  - `labels.ts`: em `PAYMENT_LABELS`, `on_pickup: "Pagar na retirada"`. `paymentLabel` não muda.
  - Corrigir todo `Record<PaymentMethod, …>` que o typecheck apontar.

- [ ] **Step 3: Regra no servidor** (`assertOperation` em `service.ts`): na retirada, o único método aceito é `on_pickup`; fora da retirada, `on_pickup` é recusado. Ambos com o erro existente `PAYMENT_DISABLED`:

```ts
  // Retirada paga no balcão: o cliente não escolhe forma de pagamento.
  if ((input.fulfillment === "pickup") !== (input.payment.method === "on_pickup")) {
    throw new DomainError("PAYMENT_DISABLED", { method: input.payment.method });
  }
  const paymentEnabled: Record<PaymentMethod, boolean> = {
    cash: store.paymentMethods.cash,
    card_on_delivery: store.paymentMethods.cardOnDelivery,
    pix: store.paymentMethods.pixKey !== null,
    on_pickup: true,
  };
```

  (A checagem vem depois de `FULFILLMENT_DISABLED`.) Troco (`changeForCents`) com `on_pickup` deve ser ignorado/nulo: se o schema de entrada já só aceita troco com `cash`, nada a fazer; senão, no `computeQuote` a regra de troco só vale para `cash` (já é assim).

- [ ] **Step 4: Checkout.**
  - `checkout.tsx`: o método efetivo é `const effectivePayment: PaymentMethod = fulfillment === "pickup" ? "on_pickup" : payment;` e `buildPayload` usa `effectivePayment` (troco só quando `effectivePayment === "cash"`). O estado `payment` continua guardando a última escolha para delivery/mesa, então voltar de Retirada para Delivery mostra de novo as opções.
  - `payment-step.tsx`: recebe `fulfillment` (já recebe). Quando `fulfillment === "pickup"`, no lugar de `ChoiceCards` + Pix/troco, renderiza:

```tsx
      <p data-testid="pay-on-pickup" className="rounded-xl border bg-card p-4 text-sm">
        Pagamento na retirada, direto no balcão.
      </p>
```

    A legenda do fieldset continua "Forma de pagamento"; observações e o resumo (subtotal/total) continuam aparecendo.
  - Se não houver nenhuma forma de pagamento habilitada para delivery/mesa, mas pickup estiver habilitado, a retirada ainda funciona (não depende de `payments`).

- [ ] **Step 5: E2E.**
  - `e2e/helpers.ts` `placePickupOrder`: remover `await page.getByRole("radio", { name: "Pix" }).check();` e, no lugar, `await expect(page.getByTestId("pay-on-pickup")).toBeVisible();`.
  - Ajustar outros specs que escolhem pagamento numa retirada (grep acima). Specs do painel que conferem "Pix" num pedido de retirada passam a conferir "Pagar na retirada" (comanda, card, WhatsApp — `grep -rn "Pix" e2e`).
  - Novo teste em `e2e/pedido.spec.ts`:

```ts
test("retirada não pergunta forma de pagamento; voltar para delivery pergunta de novo", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Coca-Cola 2L", 3);
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("pay-on-pickup")).toHaveText("Pagamento na retirada, direto no balcão.");
  await expect(page.getByRole("radio", { name: "Pix" })).toHaveCount(0);
  await expect(page.getByTestId("quote-total")).toBeVisible();

  await page.goBack();
  await page.goBack();
  await page.getByRole("radio", { name: "Delivery" }).check();
  // delivery precisa de endereço: só conferimos que a etapa 4 voltaria a ter opções
  await expect(page.getByTestId("pay-on-pickup")).toHaveCount(0);
});
```

  (Ajuste `goToCheckout`/nomes conforme os helpers locais do arquivo; o essencial: na retirada, `pay-on-pickup` visível e nenhum radio de pagamento; o pedido de retirada do helper continua sendo confirmado.)

- [ ] **Step 6:** `npm run lint && npm run typecheck && npm test && npm run test:int`. Commit: `feat: pickup orders pay at the counter without choosing a payment method`.

---

### Task 2: Sacola em `/[slug]/cart`

**Files:**
- Move: `src/app/[slug]/sacola/` → `src/app/[slug]/cart/` (`git mv`, pasta inteira)
- Modify: imports `@/app/[slug]/sacola/…` → `@/app/[slug]/cart/…` (grep em `src`)
- Modify: `PageProps<"/[slug]/sacola">` → `PageProps<"/[slug]/cart">`
- Modify: `src/app/[slug]/_components/cart-bar.tsx` (`href`)
- Modify: `next.config.ts` (redirect)
- Modify: `e2e/*.ts` (`/sacola` → `/cart`)
- Test: `e2e/pedido.spec.ts`

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md` (ou o arquivo equivalente: `grep -rl "async redirects" node_modules/next/dist/docs`).

- [ ] **Step 2: E2E que falha.** Em `e2e/pedido.spec.ts`, trocar `toHaveURL(/\/pizzaria-demo\/sacola$/)` por `toHaveURL(/\/pizzaria-demo\/cart$/)`, trocar `page.goto("/pizzaria-demo/sacola")` por `/cart` em todos os specs, e acrescentar:

```ts
test("link antigo da sacola leva para /cart", async ({ page }) => {
  await page.goto("/pizzaria-demo/sacola");
  await expect(page).toHaveURL(/\/pizzaria-demo\/cart$/);
});
```

- [ ] **Step 3: Mover a rota.** `git mv "src/app/[slug]/sacola" "src/app/[slug]/cart"`; atualizar imports, `PageProps`, `href` do `cart-bar.tsx` para `` `/${slug}/cart` ``. Não renomear componentes, textos ("Sacola", "Ver sacola") nem a chave do localStorage.

- [ ] **Step 4: Redirect** em `next.config.ts`, dentro do array de `redirects()` existente:

```ts
      // A sacola mudou de /sacola para /cart (links e favoritos antigos).
      { source: "/:slug/sacola", destination: "/:slug/cart", permanent: false },
```

- [ ] **Step 5:** `grep -rn "sacola" src e2e` — sobra só texto de interface, a chave do localStorage, nomes de variáveis/componentes e comentários; nenhum caminho `/sacola` nem import da pasta antiga. `npm run lint && npm run typecheck && npm test && npm run build`. Commit: `feat: move the bag route from /sacola to /cart with a redirect`.
