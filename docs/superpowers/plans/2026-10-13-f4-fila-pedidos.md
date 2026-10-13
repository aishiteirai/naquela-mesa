# F4 Fila de Pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono atende os pedidos em `/painel`: vê a fila por status, recebe alerta sonoro de pedido novo, aceita/avança/cancela com segurança entre aparelhos, imprime a comanda em 80 mm e avisa o cliente pelo WhatsApp — e o cliente vê o novo status no acompanhamento.

**Architecture:** O módulo `orders` ganha a máquina de status (pura) e serviços de fila (`listQueue`, `getQueueVersion`, `transitionOrder`, `getStoreOrder`), sempre filtrados por `storeId` da sessão. A fila em `/painel` é renderizada no servidor; um componente client consulta a cada 5 s só a "versão" da fila (`GET /api/painel/pedidos/versao`) e chama `router.refresh()` quando muda — sem duplicar a renderização dos cards no navegador. Mudança de status usa `UPDATE ... WHERE status = <esperado>` (quem chega depois recebe `INVALID_TRANSITION`). O módulo `whatsapp` ganha a mensagem de status para "Avisar cliente".

**Tech Stack:** Next.js 16.4 (cacheComponents, Server Actions, route handlers), React 19, Drizzle 0.45 + Postgres 17, Zod 4, Tailwind 4 (variante `print:`), Web Audio API, Wake Lock API, Notifications API, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md` (seção 7 "Máquina de status", "Fila de pedidos", "Impressão"; seção 8 `INVALID_TRANSITION`; seção 10 "Dois aparelhos no painel", "Painel sem conexão"; fase F4 da seção 12)

## Global Constraints

- Textos de interface em português do Brasil. Dinheiro só via `formatBRL`.
- `src/app/` nunca acessa o banco; só módulos. Módulos só via `@/modules/<nome>` ou `@/modules/<nome>/client`; `../` proibido em `src/` (exceto `schema.ts`). Client components só importam `/client` de módulos ou `import type`.
- **`storeId` sempre da sessão** (`requireStoreAccess()` nas páginas/actions; na rota de versão, `getCurrentUser` + `getMembershipStoreId`). Todo serviço da fila filtra por `storeId`; pedido de outra loja → `NOT_FOUND`.
- Server Actions do painel chamam `requireStoreAccess()` **antes** de ler o formulário.
- Máquina de status (spec §7), exatamente:
  - delivery: `received → preparing → out_for_delivery → completed`
  - pickup e dine_in: `received → preparing → ready → completed`
  - `cancelled` a partir de qualquer status não final, com motivo obrigatório.
- Transição com `UPDATE ... WHERE id = $id AND store_id = $store AND status = $esperado`; 0 linhas → `INVALID_TRANSITION`. Toda transição grava `order_status_events` (com `by_user_id`) na mesma transação e atualiza `orders.updated_at`.
- Telefone e endereço do cliente aparecem **só** no painel e na comanda (nunca no acompanhamento público).
- Polling: 5 s com a aba visível; pausa com a aba oculta; em falha, faixa "Sem conexão — tentando reconectar" e intervalo dobrando até 30 s.
- Som só depois de interação do usuário ("Iniciar atendimento"), por exigência dos navegadores.
- Next 16 `cacheComponents`: leituras de sessão dentro de `<Suspense>`; a fila não usa cache.
- Worktree `/home/ryan/workspace/personalprojects/ecom-menu-f2`, branch `f4-fila`, banco `naquela_mesa_f2`, porta 3001; nunca `pkill`.
- Commits terminam com linha em branco + trailer `Co-Authored-By:` do modelo que escreveu.

## Review Focus

1. Dois aparelhos clicam "Aceitar" no mesmo pedido → só um vence; o outro vê "Este pedido já foi atualizado em outro aparelho." e a tela recarrega. Testes: Task 2 (integração, em paralelo) e Task 7 (E2E).
2. Dono da loja A envia id de pedido da loja B (aceitar, cancelar, imprimir, avisar) → `NOT_FOUND`, nada muda. Teste: Task 2.
3. Transição fora da ordem (ex.: `received → completed`, delivery para `ready`, qualquer coisa a partir de `completed`/`cancelled`) → `INVALID_TRANSITION`. Teste: Task 1 e Task 2.
4. Cancelar sem motivo (ou só espaços) → recusado com erro no campo. Teste: Task 2 e Task 7.
5. Pedido novo chega com o painel aberto → aparece sozinho em até ~7 s e o título da aba mostra "(1) Novo pedido". Teste: Task 7.

---

## File Structure

```
src/modules/orders/
  status.ts (+ status.test.ts)          # máquina de status pura + rótulos dos botões
  queue.ts (+ queue.int.test.ts)        # listQueue, getQueueVersion, transitionOrder, getStoreOrder
  service.ts                            # exporta loadPlacedOrder para reuso (mesmo módulo)
  index.ts, client.ts
src/modules/whatsapp/
  status-message.ts (+ status-message.test.ts)   # buildStatusMessage
  index.ts
src/app/api/painel/pedidos/versao/route.ts
src/app/painel/
  page.tsx                              # fila (substitui o redirect)
  layout.tsx                            # link "Pedidos"; cabeçalho some na impressão
  pedidos/actions.ts
  pedidos/_components/order-card.tsx, advance-button.tsx, cancel-form.tsx, queue-poller.tsx, alert-sound.ts
  pedidos/[id]/imprimir/page.tsx, pedidos/[id]/imprimir/_components/print-on-load.tsx
  loja/actions.ts, loja/_components/operations-form.tsx   # "Imprimir comanda ao aceitar"
src/app/[slug]/sacola/_components/checkout.tsx           # polimentos
e2e/helpers.ts, e2e/painel-auth.spec.ts, e2e/painel.spec.ts, e2e/painel-pedidos.spec.ts
```

---

### Task 1: Máquina de status e mensagem de status do WhatsApp (puras)

**Files:**
- Create: `src/modules/orders/status.ts`, `src/modules/orders/status.test.ts`
- Create: `src/modules/whatsapp/status-message.ts`, `src/modules/whatsapp/status-message.test.ts`
- Modify: `src/modules/orders/index.ts`, `src/modules/orders/client.ts`, `src/modules/whatsapp/index.ts`

**Interfaces:**
- Consumes: `OrderStatus`, `Fulfillment` (`./types`); `formatOrderNumber`, `statusLabel` (`@/modules/orders/client` no módulo whatsapp).
- Produces (via `@/modules/orders` e `@/modules/orders/client`):
  - `FINAL_STATUSES: ReadonlySet<OrderStatus>` (`completed`, `cancelled`); `isFinalStatus(status): boolean`.
  - `nextStatus(fulfillment, status): OrderStatus | null` (próximo passo do fluxo; `null` se final).
  - `canTransition(fulfillment, from, to): boolean` (só o próximo passo, ou `cancelled` a partir de não final).
  - `advanceLabel(fulfillment, status): string | null` — `received` → "Aceitar"; `preparing` → "Saiu para entrega" (delivery) ou "Pronto" (pickup/dine_in); `out_for_delivery` e `ready` → "Concluir"; final → `null`.
- Produces (via `@/modules/whatsapp`): `buildStatusMessage(input: { customerName: string; number: number; status: OrderStatus; fulfillment: Fulfillment; storeName: string; trackingUrl: string; cancelReason: string | null }): string` (textos no teste).

- [ ] **Step 1: Branch**

Já existe: `f4-fila` no worktree. Não criar.

- [ ] **Step 2: Teste que falha — `src/modules/orders/status.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { advanceLabel, canTransition, isFinalStatus, nextStatus } from "./status";

describe("máquina de status", () => {
  it.each([
    ["delivery", "received", "preparing"],
    ["delivery", "preparing", "out_for_delivery"],
    ["delivery", "out_for_delivery", "completed"],
    ["pickup", "preparing", "ready"],
    ["pickup", "ready", "completed"],
    ["dine_in", "preparing", "ready"],
  ] as const)("%s: %s → %s", (fulfillment, from, to) => {
    expect(nextStatus(fulfillment, from)).toBe(to);
    expect(canTransition(fulfillment, from, to)).toBe(true);
  });

  it.each([
    ["delivery", "received", "completed"],
    ["delivery", "preparing", "ready"],
    ["pickup", "preparing", "out_for_delivery"],
    ["pickup", "received", "ready"],
    ["delivery", "completed", "cancelled"],
    ["pickup", "cancelled", "preparing"],
    ["delivery", "preparing", "received"],
  ] as const)("%s: recusa %s → %s", (fulfillment, from, to) => {
    expect(canTransition(fulfillment, from, to)).toBe(false);
  });

  it("cancelar vale a partir de qualquer status não final", () => {
    for (const status of ["received", "preparing", "out_for_delivery"] as const) {
      expect(canTransition("delivery", status, "cancelled")).toBe(true);
    }
    expect(canTransition("pickup", "ready", "cancelled")).toBe(true);
  });

  it("finais não têm próximo passo", () => {
    expect(nextStatus("delivery", "completed")).toBeNull();
    expect(nextStatus("pickup", "cancelled")).toBeNull();
    expect(isFinalStatus("completed")).toBe(true);
    expect(isFinalStatus("ready")).toBe(false);
  });

  it.each([
    ["delivery", "received", "Aceitar"],
    ["delivery", "preparing", "Saiu para entrega"],
    ["pickup", "preparing", "Pronto"],
    ["dine_in", "preparing", "Pronto"],
    ["delivery", "out_for_delivery", "Concluir"],
    ["pickup", "ready", "Concluir"],
    ["delivery", "completed", null],
  ] as const)("advanceLabel(%s, %s) → %s", (fulfillment, status, label) => {
    expect(advanceLabel(fulfillment, status)).toBe(label);
  });
});
```

Run: `npm test -- src/modules/orders/status.test.ts`
Expected: FAIL — `Failed to resolve import "./status"`.

- [ ] **Step 3: Implementar `src/modules/orders/status.ts`**

```ts
import type { Fulfillment, OrderStatus } from "./types";

export const FINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["completed", "cancelled"]);

const FLOWS: Record<Fulfillment, OrderStatus[]> = {
  delivery: ["received", "preparing", "out_for_delivery", "completed"],
  pickup: ["received", "preparing", "ready", "completed"],
  dine_in: ["received", "preparing", "ready", "completed"],
};

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL_STATUSES.has(status);
}

export function nextStatus(fulfillment: Fulfillment, status: OrderStatus): OrderStatus | null {
  if (isFinalStatus(status)) return null;
  const flow = FLOWS[fulfillment];
  const index = flow.indexOf(status);
  return index === -1 ? null : (flow[index + 1] ?? null);
}

export function canTransition(fulfillment: Fulfillment, from: OrderStatus, to: OrderStatus): boolean {
  if (isFinalStatus(from)) return false;
  if (to === "cancelled") return true;
  return nextStatus(fulfillment, from) === to;
}

export function advanceLabel(fulfillment: Fulfillment, status: OrderStatus): string | null {
  switch (status) {
    case "received":
      return "Aceitar";
    case "preparing":
      return fulfillment === "delivery" ? "Saiu para entrega" : "Pronto";
    case "out_for_delivery":
    case "ready":
      return "Concluir";
    default:
      return null;
  }
}
```

Acrescentar `export * from "./status";` em `src/modules/orders/index.ts` e em `src/modules/orders/client.ts`.

Run: `npm test -- src/modules/orders/status.test.ts`
Expected: PASS.

- [ ] **Step 4: Teste que falha — `src/modules/whatsapp/status-message.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildStatusMessage } from "./status-message";

const base = {
  customerName: "Maria Silva",
  number: 7,
  fulfillment: "delivery" as const,
  storeName: "Pizzaria Demo",
  trackingUrl: "https://app.test/pizzaria-demo/pedido/t",
  cancelReason: null,
};

describe("buildStatusMessage", () => {
  it.each([
    ["received", "delivery", "Olá, Maria! Recebemos seu pedido #0007 na Pizzaria Demo."],
    ["preparing", "delivery", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está em preparo."],
    ["out_for_delivery", "delivery", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo saiu para entrega."],
    ["ready", "pickup", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está pronto para retirada."],
    ["ready", "dine_in", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está pronto."],
    ["completed", "delivery", "Olá, Maria! Obrigado pelo pedido #0007 na Pizzaria Demo."],
  ] as const)("%s (%s)", (status, fulfillment, first) => {
    expect(buildStatusMessage({ ...base, status, fulfillment })).toBe(`${first}\nAcompanhe: ${base.trackingUrl}`);
  });

  it("cancelado leva o motivo", () => {
    expect(buildStatusMessage({ ...base, status: "cancelled", cancelReason: "acabou a massa" })).toBe(
      `Olá, Maria! Seu pedido #0007 da Pizzaria Demo foi cancelado. Motivo: acabou a massa\nAcompanhe: ${base.trackingUrl}`,
    );
  });
});
```

Run: `npm test -- src/modules/whatsapp/status-message.test.ts`
Expected: FAIL — `Failed to resolve import "./status-message"`.

- [ ] **Step 5: Implementar `src/modules/whatsapp/status-message.ts`**

```ts
import { formatOrderNumber, type Fulfillment, type OrderStatus } from "@/modules/orders/client";

export type StatusMessageInput = {
  customerName: string;
  number: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  storeName: string;
  trackingUrl: string;
  cancelReason: string | null;
};

export function buildStatusMessage(input: StatusMessageInput): string {
  const firstName = input.customerName.trim().split(/\s+/)[0] ?? input.customerName;
  const order = formatOrderNumber(input.number);
  const prefix = `Olá, ${firstName}!`;
  const lines: Record<OrderStatus, string> = {
    received: `${prefix} Recebemos seu pedido ${order} na ${input.storeName}.`,
    preparing: `${prefix} Seu pedido ${order} da ${input.storeName} está em preparo.`,
    out_for_delivery: `${prefix} Seu pedido ${order} da ${input.storeName} saiu para entrega.`,
    ready:
      input.fulfillment === "pickup"
        ? `${prefix} Seu pedido ${order} da ${input.storeName} está pronto para retirada.`
        : `${prefix} Seu pedido ${order} da ${input.storeName} está pronto.`,
    completed: `${prefix} Obrigado pelo pedido ${order} na ${input.storeName}.`,
    cancelled: `${prefix} Seu pedido ${order} da ${input.storeName} foi cancelado.${input.cancelReason ? ` Motivo: ${input.cancelReason}` : ""}`,
  };
  return `${lines[input.status]}\nAcompanhe: ${input.trackingUrl}`;
}
```

Em `src/modules/whatsapp/index.ts`, acrescentar `export { buildStatusMessage, type StatusMessageInput } from "./status-message";`.

Run: `npm test -- src/modules/whatsapp/status-message.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificar e commitar**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add order status machine and whatsapp status message"
```

---

### Task 2: Serviços da fila — listar, versão, transição, pedido da loja

**Files:**
- Create: `src/modules/orders/queue.ts`, `src/modules/orders/queue.int.test.ts`
- Modify: `src/modules/orders/service.ts` (exportar `loadPlacedOrder` para uso interno do módulo), `src/modules/orders/index.ts`

**Interfaces:**
- Consumes: tabelas `orders`, `orderStatusEvents` (`./schema`); `loadPlacedOrder`, `PlacedOrder` (`./service`); `describeLine` (`./pricing`); `canTransition`, `isFinalStatus` (`./status`); `DomainError`; `db`; `createOrder` e helpers de loja nos testes.
- Produces (via `@/modules/orders`):
  - `type QueueOrder = { id: string; number: number; status: OrderStatus; fulfillment: Fulfillment; customerName: string; customerPhone: string; address: OrderAddress | null; tableLabel: string | null; paymentMethod: PaymentMethod; changeForCents: number | null; notes: string | null; cancelReason: string | null; subtotalCents: number; deliveryFeeCents: number; totalCents: number; publicToken: string; createdAt: string; updatedAt: string; items: { description: string; quantity: number; totalCents: number; options: string[]; notes: string | null }[] }`
  - `listQueue(storeId: string, now?: Date): Promise<QueueOrder[]>` — todos os não finais + finais criados nas últimas 24 h; ordenado por `createdAt` crescente; no máximo 200.
  - `getQueueVersion(storeId: string): Promise<{ version: string; received: number }>` — `version` muda a cada pedido novo ou transição (`<total de pedidos>:<maior updated_at em ms>`); `received` = quantidade em `received`.
  - `transitionOrder(storeId: string, orderId: string, to: OrderStatus, actor: { userId: string; cancelReason?: string | null }): Promise<void>` — pedido de outra loja/inexistente → `NOT_FOUND`; transição inválida ou status mudou no meio → `INVALID_TRANSITION`; cancelar sem motivo (após `trim`, < 3 caracteres) → `VALIDATION` em `cancelReason`; motivo > 200 → `VALIDATION`.
  - `getStoreOrder(storeId: string, orderId: string): Promise<PlacedOrder & { status: OrderStatus; cancelReason: string | null; createdAt: string }>` — outra loja → `NOT_FOUND`.

- [ ] **Step 1: Exportar `loadPlacedOrder`**

Em `src/modules/orders/service.ts`, trocar `async function loadPlacedOrder(` por `export async function loadPlacedOrder(` (não exportar no `index.ts`: uso interno do módulo).

- [ ] **Step 2: Teste de integração que falha — `src/modules/orders/queue.int.test.ts`**

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getMenu, importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, setManualStatus } from "@/modules/stores";
import { ensureUser } from "@/modules/auth";
import { pool } from "@/shared/db/client";
import { getQueueVersion, getStoreOrder, listQueue, transitionOrder } from "./queue";
import { createOrder } from "./service";

async function setupStore(slug: string) {
  const { id: storeId } = await createStore({
    slug,
    name: slug,
    whatsappPhone: "+5511999990000",
    rules: { minOrderCents: 0, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  });
  await setManualStatus(storeId, "force_open");
  await importCatalog(storeId, { categories: [{ name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] }] });
  const coca = (await getMenu(storeId)).categories[0]!.products[0]!.id;
  return { storeId, coca };
}

async function placeOrder(slug: string, coca: string, fulfillment: "delivery" | "pickup" = "pickup") {
  return createOrder(slug, {
    idempotencyKey: randomUUID(),
    items: [{ kind: "simple", productId: coca, optionIds: [], quantity: 2, notes: "bem gelada" }],
    fulfillment,
    customer: { name: "Maria Silva", phone: "(11) 98888-7777" },
    address:
      fulfillment === "delivery"
        ? { street: "Rua A", number: "10", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null }
        : null,
    tableLabel: null,
    payment: { method: "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: fulfillment === "delivery" ? 3400 : 2800,
  });
}

describe("fila de pedidos", () => {
  let actor: { userId: string };

  beforeEach(async () => {
    await deleteStoreBySlug("fila-a");
    await deleteStoreBySlug("fila-b");
    const user = await ensureUser({ email: "dono-fila@exemplo.com", password: "senha-forte-123", name: "Dono" });
    actor = { userId: user.id };
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lista pedidos com dados para o painel e muda a versão a cada evento", async () => {
    const a = await setupStore("fila-a");
    const v0 = await getQueueVersion(a.storeId);
    const placed = await placeOrder("fila-a", a.coca, "delivery");
    const v1 = await getQueueVersion(a.storeId);

    expect(v1.version).not.toBe(v0.version);
    expect(v1.received).toBe(1);

    const [order] = await listQueue(a.storeId);
    expect(order).toMatchObject({
      id: placed.orderId,
      number: 1,
      status: "received",
      fulfillment: "delivery",
      customerPhone: "+5511988887777",
      address: { street: "Rua A", neighborhood: "Centro" },
      totalCents: 3400,
      items: [{ description: "Coca-Cola 2L", quantity: 2, totalCents: 2800, options: [], notes: "bem gelada" }],
    });

    await transitionOrder(a.storeId, placed.orderId, "preparing", actor);
    const v2 = await getQueueVersion(a.storeId);
    expect(v2.version).not.toBe(v1.version);
    expect(v2.received).toBe(0);
  });

  it("segue o fluxo da retirada até concluir", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    for (const status of ["preparing", "ready", "completed"] as const) {
      await transitionOrder(a.storeId, orderId, status, actor);
    }
    expect((await getStoreOrder(a.storeId, orderId)).status).toBe("completed");
  });

  it("recusa transição fora da ordem e a partir de final", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    await expect(transitionOrder(a.storeId, orderId, "completed", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(transitionOrder(a.storeId, orderId, "out_for_delivery", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: "cliente desistiu" });
    await expect(transitionOrder(a.storeId, orderId, "preparing", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("cancelar exige motivo", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    for (const reason of [undefined, null, "  ", "ab"]) {
      await expect(transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: reason })).rejects.toMatchObject({
        code: "VALIDATION",
        details: { issues: [{ path: "cancelReason" }] },
      });
    }
    await transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: "  acabou a massa  " });
    expect(await getStoreOrder(a.storeId, orderId)).toMatchObject({ status: "cancelled", cancelReason: "acabou a massa" });
  });

  it("dois aparelhos aceitando ao mesmo tempo: só um vence", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    const results = await Promise.allSettled([
      transitionOrder(a.storeId, orderId, "preparing", actor),
      transitionOrder(a.storeId, orderId, "preparing", actor),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("pedido de outra loja → NOT_FOUND e nada muda", async () => {
    const a = await setupStore("fila-a");
    const b = await setupStore("fila-b");
    const { orderId } = await placeOrder("fila-b", b.coca);

    await expect(transitionOrder(a.storeId, orderId, "preparing", actor)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getStoreOrder(a.storeId, orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listQueue(a.storeId)).toEqual([]);
    expect((await getStoreOrder(b.storeId, orderId)).status).toBe("received");
  });

  it("finais antigos saem da fila; não finais antigos ficam", async () => {
    const a = await setupStore("fila-a");
    const done = await placeOrder("fila-a", a.coca);
    const open = await placeOrder("fila-a", a.coca);
    await transitionOrder(a.storeId, done.orderId, "cancelled", { ...actor, cancelReason: "teste antigo" });

    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect((await listQueue(a.storeId, tomorrow)).map((order) => order.id)).toEqual([open.orderId]);
  });
});
```

Run: `npm run test:int -- src/modules/orders/queue.int.test.ts`
Expected: FAIL — `Failed to resolve import "./queue"`.

- [ ] **Step 3: Implementar `src/modules/orders/queue.ts`**

```ts
import { and, asc, count, eq, gte, inArray, max, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { describeLine } from "./pricing";
import { orderItemOptions, orderItems, orders, orderStatusEvents } from "./schema";
import { loadPlacedOrder, type PlacedOrder } from "./service";
import { canTransition, FINAL_STATUSES } from "./status";
import type { Fulfillment, OrderAddress, OrderStatus, PaymentMethod } from "./types";

export type QueueOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  tableLabel: string | null;
  paymentMethod: PaymentMethod;
  changeForCents: number | null;
  notes: string | null;
  cancelReason: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  items: { description: string; quantity: number; totalCents: number; options: string[]; notes: string | null }[];
};

const QUEUE_LIMIT = 200;
const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;
const FINAL = [...FINAL_STATUSES];

export async function listQueue(storeId: string, now: Date = new Date()): Promise<QueueOrder[]> {
  const since = new Date(now.getTime() - FINISHED_WINDOW_MS);
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), or(notInArray(orders.status, FINAL), gte(orders.createdAt, since))))
    .orderBy(asc(orders.createdAt))
    .limit(QUEUE_LIMIT);
  if (rows.length === 0) return [];

  const orderIds = rows.map((row) => row.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.position));
  const options =
    items.length === 0
      ? []
      : await db
          .select()
          .from(orderItemOptions)
          .where(
            inArray(
              orderItemOptions.orderItemId,
              items.map((item) => item.id),
            ),
          );

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    fulfillment: row.fulfillment,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    address: row.address,
    tableLabel: row.tableLabel,
    paymentMethod: row.paymentMethod,
    changeForCents: row.changeForCents,
    notes: row.notes,
    cancelReason: row.cancelReason,
    subtotalCents: row.subtotalCents,
    deliveryFeeCents: row.deliveryFeeCents,
    totalCents: row.totalCents,
    publicToken: row.publicToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: items
      .filter((item) => item.orderId === row.id)
      .map((item) => ({
        description: describeLine(item),
        quantity: item.quantity,
        totalCents: item.totalCents,
        notes: item.notes,
        options: options
          .filter((option) => option.orderItemId === item.id)
          .map((option) => `${option.groupName}: ${option.optionName}`),
      })),
  }));
}

export async function getQueueVersion(storeId: string): Promise<{ version: string; received: number }> {
  const [row] = await db
    .select({
      total: count(),
      lastUpdate: max(orders.updatedAt),
      received: sql<number>`count(*) filter (where ${orders.status} = 'received')`.mapWith(Number),
    })
    .from(orders)
    .where(eq(orders.storeId, storeId));
  return {
    version: `${row?.total ?? 0}:${row?.lastUpdate?.getTime() ?? 0}`,
    received: row?.received ?? 0,
  };
}

function invalid(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

export async function transitionOrder(
  storeId: string,
  orderId: string,
  to: OrderStatus,
  actor: { userId: string; cancelReason?: string | null },
): Promise<void> {
  let cancelReason: string | null = null;
  if (to === "cancelled") {
    cancelReason = actor.cancelReason?.trim() ?? "";
    if (cancelReason.length < 3) throw invalid("cancelReason", "informe o motivo do cancelamento");
    if (cancelReason.length > 200) throw invalid("cancelReason", "motivo muito longo");
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: orders.status, fulfillment: orders.fulfillment })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);
    if (!current) throw new DomainError("NOT_FOUND");
    if (!canTransition(current.fulfillment, current.status, to)) {
      throw new DomainError("INVALID_TRANSITION", { from: current.status, to });
    }

    // Só atualiza se ninguém mudou o status desde a leitura (outro aparelho).
    const updated = await tx
      .update(orders)
      .set({ status: to, updatedAt: new Date(), ...(to === "cancelled" ? { cancelReason } : {}) })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), eq(orders.status, current.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new DomainError("INVALID_TRANSITION", { from: current.status, to });

    await tx.insert(orderStatusEvents).values({ orderId, status: to, byUserId: actor.userId });
  });
}

export async function getStoreOrder(
  storeId: string,
  orderId: string,
): Promise<PlacedOrder & { status: OrderStatus; cancelReason: string | null; createdAt: string }> {
  const [row] = await db
    .select({ status: orders.status, cancelReason: orders.cancelReason, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1);
  if (!row) throw new DomainError("NOT_FOUND");
  const placed = await loadPlacedOrder(orderId);
  return { ...placed, status: row.status, cancelReason: row.cancelReason, createdAt: row.createdAt.toISOString() };
}
```

Notas:
- Dois `UPDATE` concorrentes no mesmo pedido: o segundo espera o lock da linha e, ao reavaliar o `WHERE status = <lido>`, não casa → 0 linhas → `INVALID_TRANSITION`.
- Se o `count(*) filter (...)` não tipar com `sql<number>`, use `sql<string>` e `Number(...)`; registre no relatório.

Em `src/modules/orders/index.ts`, acrescentar:

```ts
export { getQueueVersion, getStoreOrder, listQueue, transitionOrder, type QueueOrder } from "./queue";
```

- [ ] **Step 4: Rodar e commitar**

Run: `npm run test:int -- src/modules/orders/queue.int.test.ts && npm run test:int && npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add order queue listing, versioning and guarded status transitions"
```

---

### Task 3: Tela da fila em `/painel` — quadro por status, aceitar/avançar/cancelar, avisar cliente

**Files:**
- Replace: `src/app/painel/page.tsx`
- Modify: `src/app/painel/layout.tsx` (link "Pedidos" primeiro; `print:hidden` no `<header>`)
- Create: `src/app/painel/pedidos/actions.ts`
- Create: `src/app/painel/pedidos/_components/queue-notice.tsx`, `advance-button.tsx`, `cancel-form.tsx`, `order-card.tsx`
- Modify: `e2e/helpers.ts`, `e2e/painel-auth.spec.ts`, `e2e/painel.spec.ts` (login agora cai na fila)

**Interfaces:**
- Consumes: `listQueue`, `transitionOrder`, `QueueOrder`, `advanceLabel`, `nextStatus`, `isFinalStatus`, `formatOrderNumber`, `statusLabel`, `FULFILLMENT_LABELS`, `PAYMENT_LABELS`, `ORDER_STATUSES` (`@/modules/orders`; nos componentes client só `@/modules/orders/client` ou `import type`); `buildStatusMessage`, `waMeLink` (`@/modules/whatsapp`); `requireStoreAccess`; `actionError`, `idleState`, `ActionState`, `success`; `formatBRL`; `getEnv`.
- Produces:
  - Actions `(prev: ActionState, form: FormData) => Promise<ActionState>`: `advanceOrderAction` (campos `orderId`, `to`) e `cancelOrderAction` (campos `orderId`, `cancelReason`). `INVALID_TRANSITION` → `{ status: "error", message: "Este pedido já foi atualizado em outro aparelho.", fieldErrors: {} }`; `NOT_FOUND` → "Pedido não encontrado."; validação → erros por campo.
  - `QueueNoticeProvider` + `useQueueNotice()` (client): aviso único da fila em `<p role="status" data-testid="queue-notice">`, que sobrevive ao `router.refresh()`.
  - Página "Pedidos" (`<h1>`), quatro colunas `<section aria-label=...>`: "Novos" (`received`), "Em preparo" (`preparing`), "Prontos e em entrega" (`ready`, `out_for_delivery`), "Finalizados (24 h)" (`completed`, `cancelled`); cada coluna com contagem no título.
  - Card `<article aria-label="Pedido #0001">` com hora (fuso da loja), status (`statusLabel`), tipo, nome e telefone (`tel:`), endereço ou mesa, itens (quantidade, descrição, adicionais, observação), observação do pedido, pagamento e troco, total, motivo se cancelado.
  - Botões/links com `aria-label` exatos: `"<Aceitar|Saiu para entrega|Pronto|Concluir> #0001"`, `"Cancelar pedido #0001"` (abre campo "Motivo do cancelamento" + botão "Confirmar cancelamento"), link `"Avisar cliente #0001"` (`wa.me` para o telefone do cliente com `buildStatusMessage` do status atual, nova aba).
  - `loginAsOwner(page, next = "/painel")` passa a abrir `/login?next=...` e esperar a URL de `next`.

- [ ] **Step 1: Ajustar os E2E existentes ao novo destino do login**

`e2e/helpers.ts` — trocar `loginAsOwner` por:

```ts
export async function loginAsOwner(page: Page, next = "/painel"): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Senha").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}
```

`e2e/painel.spec.ts`: no `beforeEach`, trocar `await loginAsOwner(page);` por `await loginAsOwner(page, "/painel/cardapio");`.

`e2e/painel-auth.spec.ts`:
- no teste "dono entra e cai no cardápio do painel da própria loja": renomear para "dono entra e cai na fila de pedidos da própria loja" e trocar a asserção do título por `await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();`;
- no teste "login respeita next interno e ignora next externo", a última asserção passa a ser `await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/painel$/);`.

(Esses testes falham até o Step 5: hoje `/painel` redireciona para o cardápio.)

- [ ] **Step 2: Actions — `src/app/painel/pedidos/actions.ts`**

```ts
"use server";

import { ORDER_STATUSES, transitionOrder, type OrderStatus } from "@/modules/orders";
import { isDomainError } from "@/shared/errors";
import { actionError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

const STALE: ActionState = { status: "error", message: "Este pedido já foi atualizado em outro aparelho.", fieldErrors: {} };

async function transition(form: FormData, to: OrderStatus, cancelReason?: string): Promise<ActionState> {
  const { user, store } = await requireStoreAccess();
  try {
    await transitionOrder(store.id, String(form.get("orderId") ?? ""), to, { userId: user.id, cancelReason });
  } catch (error) {
    if (isDomainError(error) && error.code === "INVALID_TRANSITION") return STALE;
    return actionError(error);
  }
  return success(to === "cancelled" ? "Pedido cancelado." : "Pedido atualizado.");
}

export async function advanceOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const to = ORDER_STATUSES.find((status) => status === form.get("to"));
  if (!to || to === "cancelled") return STALE;
  return transition(form, to);
}

export async function cancelOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  return transition(form, "cancelled", String(form.get("cancelReason") ?? ""));
}
```

(`NOT_FOUND` já vira "Item não encontrado." via `actionError`; na fila isso só acontece com pedido de outra loja.)

- [ ] **Step 3: Componentes client**

`src/app/painel/pedidos/_components/queue-notice.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const NoticeContext = createContext<(message: string) => void>(() => {});

export function QueueNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <NoticeContext value={setMessage}>
      {message && (
        <p role="status" data-testid="queue-notice" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50">
          {message}
        </p>
      )}
      {children}
    </NoticeContext>
  );
}

export function useQueueNotice(): (message: string) => void {
  return useContext(NoticeContext);
}
```

`src/app/painel/pedidos/_components/advance-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { OrderStatus } from "@/modules/orders/client";
import { idleState } from "@/app/_lib/action-state";
import { advanceOrderAction } from "@/app/painel/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

export function AdvanceButton({ orderId, to, label, orderLabel, printUrl }: { orderId: string; to: OrderStatus; label: string; orderLabel: string; printUrl?: string }) {
  const [state, formAction, pending] = useActionState(advanceOrderAction, idleState);
  const router = useRouter();
  const notice = useQueueNotice();

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "error") notice(state.message);
    router.refresh();
  }, [state, router, notice]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Abre a comanda no clique (gesto do usuário), para o navegador não bloquear a janela.
        if (printUrl) window.open(printUrl, "_blank");
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={to} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${label} ${orderLabel}`}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {label}
      </button>
    </form>
  );
}
```

`src/app/painel/pedidos/_components/cancel-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FieldError } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { cancelOrderAction } from "@/app/painel/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

export function CancelForm({ orderId, orderLabel }: { orderId: string; orderLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(cancelOrderAction, idleState);
  const router = useRouter();
  const notice = useQueueNotice();

  useEffect(() => {
    if (state.status === "success") {
      notice(`Pedido ${orderLabel} cancelado.`);
      router.refresh();
    } else if (state.status === "error" && Object.keys(state.fieldErrors).length === 0) {
      notice(state.message);
      router.refresh();
    }
  }, [state, router, notice, orderLabel]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`Cancelar pedido ${orderLabel}`} className={secondaryButtonClass}>
        Cancelar
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex flex-col gap-1 text-sm">
        Motivo do cancelamento
        <input name="cancelReason" maxLength={200} className={inputClass} />
      </label>
      <FieldError state={state} name="cancelReason" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          Confirmar cancelamento
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Voltar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Card (server) — `src/app/painel/pedidos/_components/order-card.tsx`**

```tsx
import {
  advanceLabel,
  FULFILLMENT_LABELS,
  formatOrderNumber,
  isFinalStatus,
  nextStatus,
  PAYMENT_LABELS,
  statusLabel,
  type QueueOrder,
} from "@/modules/orders";
import { buildStatusMessage, waMeLink } from "@/modules/whatsapp";
import { getEnv } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { AdvanceButton } from "./advance-button";
import { CancelForm } from "./cancel-form";

type Props = { order: QueueOrder; storeName: string; storeSlug: string; timezone: string; autoPrintOnAccept: boolean };

export function OrderCard({ order, storeName, storeSlug, timezone, autoPrintOnAccept }: Props) {
  const orderLabel = formatOrderNumber(order.number);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt));
  const next = nextStatus(order.fulfillment, order.status);
  const label = advanceLabel(order.fulfillment, order.status);
  const trackingUrl = new URL(`/${storeSlug}/pedido/${order.publicToken}`, getEnv().BETTER_AUTH_URL).toString();
  const notifyUrl = waMeLink(
    order.customerPhone,
    buildStatusMessage({
      customerName: order.customerName,
      number: order.number,
      status: order.status,
      fulfillment: order.fulfillment,
      storeName,
      trackingUrl,
      cancelReason: order.cancelReason,
    }),
  );
  const changeCents = order.changeForCents ? order.changeForCents - order.totalCents : null;

  return (
    <article aria-label={`Pedido ${orderLabel}`} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold">{orderLabel}</span>
        <span className="text-neutral-700 dark:text-neutral-300">{time}</span>
      </div>
      <p className="font-medium">
        {statusLabel(order.status, order.fulfillment)} · {FULFILLMENT_LABELS[order.fulfillment]}
      </p>
      <p>
        {order.customerName} ·{" "}
        <a href={`tel:${order.customerPhone}`} className="underline">
          {order.customerPhone}
        </a>
      </p>
      {order.address && (
        <p>
          {order.address.street}, {order.address.number}
          {order.address.complement ? ` - ${order.address.complement}` : ""} — {order.address.neighborhood}
          {order.address.reference ? ` (ref.: ${order.address.reference})` : ""}
        </p>
      )}
      {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
      <ul className="flex flex-col gap-1 border-y border-neutral-200 py-2 dark:border-neutral-800">
        {order.items.map((item, index) => (
          <li key={index}>
            <span className="font-medium">
              {item.quantity}x {item.description}
            </span>
            {item.options.map((option) => (
              <span key={option} className="block pl-3 text-neutral-700 dark:text-neutral-300">
                + {option}
              </span>
            ))}
            {item.notes && <span className="block pl-3 italic">Obs.: {item.notes}</span>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="italic">Obs. do pedido: {order.notes}</p>}
      <p>
        {PAYMENT_LABELS[order.paymentMethod]}
        {order.changeForCents ? ` · troco para ${formatBRL(order.changeForCents)}` : ""}
        {changeCents !== null && changeCents > 0 ? ` (levar ${formatBRL(changeCents)})` : ""}
      </p>
      <p className="font-semibold">Total {formatBRL(order.totalCents)}</p>
      {order.status === "cancelled" && order.cancelReason && <p className="text-red-700 dark:text-red-400">Motivo: {order.cancelReason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {next && label && (
          <AdvanceButton
            orderId={order.id}
            to={next}
            label={label}
            orderLabel={orderLabel}
            printUrl={autoPrintOnAccept && order.status === "received" ? `/painel/pedidos/${order.id}/imprimir` : undefined}
          />
        )}
        <a href={notifyUrl} target="_blank" rel="noreferrer" aria-label={`Avisar cliente ${orderLabel}`} className="text-sm underline">
          Avisar cliente
        </a>
        {!isFinalStatus(order.status) && <CancelForm orderId={order.id} orderLabel={orderLabel} />}
      </div>
    </article>
  );
}
```

(O link de impressão entra na Task 5; aqui `printUrl` já fica pronto para "imprimir ao aceitar".)

- [ ] **Step 5: Página e layout**

`src/app/painel/page.tsx` (substituir o redirect):

```tsx
import { Suspense } from "react";
import { listQueue, type QueueOrder } from "@/modules/orders";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { OrderCard } from "./pedidos/_components/order-card";
import { QueueNoticeProvider } from "./pedidos/_components/queue-notice";

const COLUMNS: { title: string; statuses: QueueOrder["status"][] }[] = [
  { title: "Novos", statuses: ["received"] },
  { title: "Em preparo", statuses: ["preparing"] },
  { title: "Prontos e em entrega", statuses: ["ready", "out_for_delivery"] },
  { title: "Finalizados (24 h)", statuses: ["completed", "cancelled"] },
];

async function Queue() {
  const { store } = await requireStoreAccess();
  const orders = await listQueue(store.id);

  return (
    <QueueNoticeProvider>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => column.statuses.includes(order.status));
          return (
            <section key={column.title} aria-label={column.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {column.title} <span className="text-neutral-700 dark:text-neutral-300">({columnOrders.length})</span>
              </h2>
              {columnOrders.length === 0 && <p className="text-sm text-neutral-700 dark:text-neutral-300">Nenhum pedido.</p>}
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  storeName={store.name}
                  storeSlug={store.slug}
                  timezone={store.timezone}
                  autoPrintOnAccept={store.rules.autoPrintOnAccept}
                />
              ))}
            </section>
          );
        })}
      </div>
    </QueueNoticeProvider>
  );
}

export default function PedidosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <Suspense fallback={<p>Carregando pedidos...</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}
```

`src/app/painel/layout.tsx`:
- em `links`, acrescentar como **primeiro** item `{ href: "/painel", label: "Pedidos" }`;
- no `<header ...>`, acrescentar a classe `print:hidden`;
- trocar `max-w-4xl` do `<main>` por `max-w-7xl` (quatro colunas).

- [ ] **Step 6: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sem erros.

Run: `npm run db:migrate && PORT=3001 CI=1 npm run test:e2e`
Expected: PASS (23; os de painel com o novo destino do login).

```bash
git add -A
git commit -m "feat: add panel order queue with guarded accept, advance, cancel and notify"
```

---

### Task 4: Atualização automática e alertas de pedido novo

**Files:**
- Create: `src/app/api/painel/pedidos/versao/route.ts`
- Create: `src/app/painel/pedidos/_components/alert-sound.ts`, `src/app/painel/pedidos/_components/queue-poller.tsx`
- Modify: `src/app/painel/page.tsx` (montar o poller)

**Interfaces:**
- Consumes: `getCurrentUser` (`@/modules/auth`); `getMembershipStoreId` (`@/modules/stores`); `getQueueVersion` (`@/modules/orders`).
- Produces:
  - `GET /api/painel/pedidos/versao` → `200 { version: string; received: number }` com `Cache-Control: no-store`; sem sessão → `401 { error: "unauthenticated" }`; sem loja → `403 { error: "forbidden" }`.
  - `QueuePoller({ initialVersion, initialReceived })` (client): consulta a cada 5 s com a aba visível; versão diferente → `router.refresh()`; `received` maior que o anterior → alerta (som em loop se o atendimento foi iniciado; título `"(<N>) Novo pedido — Painel"`; notificação do navegador se permitida). Alerta para com qualquer clique na página ou quando `received` volta a 0. Falha de rede → faixa `role="status"` "Sem conexão — tentando reconectar" e intervalo dobrando até 30 s; volta a 5 s ao reconectar.
  - Botão "Iniciar atendimento" (desbloqueia áudio, pede Wake Lock e permissão de notificação); depois mostra "Atendimento ativo: alerta sonoro ligado".

- [ ] **Step 1: Rota — `src/app/api/painel/pedidos/versao/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getQueueVersion } from "@/modules/orders";
import { getMembershipStoreId } from "@/modules/stores";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  const storeId = await getMembershipStoreId(user.id);
  if (!storeId) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  return NextResponse.json(await getQueueVersion(storeId), { headers: NO_STORE });
}
```

- [ ] **Step 2: Som — `src/app/painel/pedidos/_components/alert-sound.ts`**

```ts
/** Bipe repetido via Web Audio (sem arquivo). Só toca depois de `unlock()` num clique do usuário. */
export function createAlertSound() {
  let context: AudioContext | null = null;
  let timer: number | null = null;

  function beep() {
    if (!context) return;
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
    start() {
      if (!context || timer !== null) return;
      beep();
      timer = window.setInterval(beep, 1200);
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    },
  };
}
```

- [ ] **Step 3: Poller — `src/app/painel/pedidos/_components/queue-poller.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createAlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const MAX_INTERVAL = 30_000;
const BASE_TITLE = "Painel | Naquela Mesa";

export function QueuePoller({ initialVersion, initialReceived }: { initialVersion: string; initialReceived: number }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const sound = useRef(createAlertSound());
  const version = useRef(initialVersion);
  const received = useRef(initialReceived);
  const startedRef = useRef(false);

  useEffect(() => {
    let delay = BASE_INTERVAL;
    let timer: number;
    let cancelled = false;

    async function tick() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/painel/pedidos/versao", { cache: "no-store" });
          if (!response.ok) throw new Error(String(response.status));
          const data = (await response.json()) as { version: string; received: number };
          setOffline(false);
          delay = BASE_INTERVAL;
          if (data.version !== version.current) {
            version.current = data.version;
            router.refresh();
          }
          if (data.received > received.current) {
            document.title = `(${data.received}) Novo pedido — Painel`;
            setAlerting(true);
            if (startedRef.current) sound.current.start();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
            }
          } else if (data.received === 0) {
            sound.current.stop();
            setAlerting(false);
            document.title = BASE_TITLE;
          }
          received.current = data.received;
        } catch {
          setOffline(true);
          delay = Math.min(delay * 2, MAX_INTERVAL);
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, delay);
    }

    timer = window.setTimeout(tick, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    if (!alerting) return;
    function stopAlert() {
      sound.current.stop();
      setAlerting(false);
      document.title = BASE_TITLE;
    }
    document.addEventListener("pointerdown", stopAlert, { once: true });
    return () => document.removeEventListener("pointerdown", stopAlert);
  }, [alerting]);

  async function start() {
    sound.current.unlock();
    startedRef.current = true;
    setStarted(true);
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      // Wake Lock é opcional (nem todo navegador oferece).
    }
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {offline && (
        <p role="status" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          Sem conexão — tentando reconectar
        </p>
      )}
      {started ? (
        <p className="text-sm text-green-800 dark:text-green-300">Atendimento ativo: alerta sonoro ligado</p>
      ) : (
        <button type="button" onClick={start} className="self-start rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white">
          Iniciar atendimento
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Montar na página**

Em `src/app/painel/page.tsx`, dentro de `Queue()`:
- buscar também a versão: `const [orders, version] = await Promise.all([listQueue(store.id), getQueueVersion(store.id)]);` (importar `getQueueVersion`);
- renderizar `<QueuePoller initialVersion={version.version} initialReceived={version.received} />` logo dentro do `<QueueNoticeProvider>`, antes do grid (importar de `./pedidos/_components/queue-poller`).

- [ ] **Step 5: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sem erros; rota `/api/painel/pedidos/versao` no build.

Verificação rápida da rota (servidor na 3001 iniciado em segundo plano, guardando o PID):

```bash
PORT=3001 npm run start > /tmp/naquela-f4.log 2>&1 & echo $! > /tmp/naquela-f4.pid; sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/painel/pedidos/versao
kill "$(cat /tmp/naquela-f4.pid)"
```

Expected: `401`.

```bash
git add -A
git commit -m "feat: poll queue version with new-order alerts and offline banner"
```

---

### Task 5: Comanda 80 mm e "imprimir ao aceitar"

**Files:**
- Create: `src/app/painel/pedidos/[id]/imprimir/page.tsx`, `src/app/painel/pedidos/[id]/imprimir/_components/print-on-load.tsx`
- Modify: `src/app/painel/pedidos/_components/order-card.tsx` (link "Imprimir comanda")
- Modify: `src/app/painel/loja/_components/operations-form.tsx`, `src/app/painel/loja/actions.ts` (opção "Imprimir comanda ao aceitar")

**Interfaces:**
- Consumes: `getStoreOrder`, `formatOrderNumber`, `describeLine`, `FULFILLMENT_LABELS`, `PAYMENT_LABELS` (`@/modules/orders`); `requireStoreAccess`; `formatBRL`; `z.uuid()`.
- Produces:
  - Página `/painel/pedidos/<id>/imprimir`: comanda em largura de 80 mm (`@page { size: 80mm auto; margin: 3mm }`), fonte monoespaçada; abre o diálogo de impressão ao carregar; botões "Imprimir" e "Fechar" escondidos na impressão. Conteúdo: nome da loja, "Pedido #0001", data/hora (fuso da loja), tipo, nome e telefone, endereço/referência ou mesa, itens `"<qtd>x <descrição>"` com valor, adicionais e "Obs.:", subtotal/entrega/total, pagamento + troco (e "levar R$ X"), observação do pedido; se cancelado, "CANCELADO — <motivo>". Id inválido ou de outra loja → 404.
  - No card: link `aria-label="Imprimir comanda #0001"` (nova aba).
  - Em "Entrega, retirada e pagamento" (Loja), caixa "Imprimir comanda ao aceitar" ligada a `rules.autoPrintOnAccept`.

- [ ] **Step 1: `print-on-load.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
    window.print();
  }, []);

  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded border px-3 py-1.5 text-sm">
        Imprimir
      </button>
      <button type="button" onClick={() => window.close()} className="rounded border px-3 py-1.5 text-sm">
        Fechar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` da comanda**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { describeLine, FULFILLMENT_LABELS, formatOrderNumber, getStoreOrder, PAYMENT_LABELS } from "@/modules/orders";
import { isDomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { PrintOnLoad } from "./_components/print-on-load";

async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStoreAccess();

  let order;
  try {
    order = await getStoreOrder(store.id, id);
  } catch (error) {
    if (isDomainError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const when = new Intl.DateTimeFormat("pt-BR", { timeZone: store.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt));
  const change = order.changeForCents ? order.changeForCents - order.totalCents : 0;

  return (
    <div className="mx-auto w-[74mm] font-mono text-[12px] leading-snug text-black">
      <title>{`Comanda ${formatOrderNumber(order.number)}`}</title>
      <style>{"@page { size: 80mm auto; margin: 3mm } @media print { body { background: #fff } }"}</style>
      <PrintOnLoad />
      <p className="text-center font-bold">{store.name}</p>
      <p className="text-center text-[16px] font-bold">Pedido {formatOrderNumber(order.number)}</p>
      <p className="text-center">{when}</p>
      {order.status === "cancelled" && <p className="text-center font-bold">CANCELADO — {order.cancelReason}</p>}
      <hr className="my-1 border-dashed border-black" />
      <p className="font-bold">{FULFILLMENT_LABELS[order.fulfillment]}</p>
      <p>
        {order.customerName} · {order.customerPhone}
      </p>
      {order.address && (
        <>
          <p>
            {order.address.street}, {order.address.number}
            {order.address.complement ? ` - ${order.address.complement}` : ""}
          </p>
          <p>{order.address.neighborhood}</p>
          {order.address.reference && <p>Ref.: {order.address.reference}</p>}
        </>
      )}
      {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
      <hr className="my-1 border-dashed border-black" />
      {order.lines.map((line, index) => (
        <div key={index} className="mb-1">
          <div className="flex justify-between gap-2">
            <span>
              {line.quantity}x {describeLine(line)}
            </span>
            <span>{formatBRL(line.totalCents)}</span>
          </div>
          {line.options.map((option) => (
            <p key={option.optionName} className="pl-2">
              + {option.groupName}: {option.optionName}
            </p>
          ))}
          {line.notes && <p className="pl-2">Obs.: {line.notes}</p>}
        </div>
      ))}
      <hr className="my-1 border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatBRL(order.subtotalCents)}</span>
      </div>
      {order.fulfillment === "delivery" && (
        <div className="flex justify-between">
          <span>Entrega</span>
          <span>{formatBRL(order.deliveryFeeCents)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{formatBRL(order.totalCents)}</span>
      </div>
      <p>
        Pagamento: {PAYMENT_LABELS[order.paymentMethod]}
        {order.changeForCents ? ` · troco para ${formatBRL(order.changeForCents)}` : ""}
      </p>
      {change > 0 && <p className="font-bold">Levar troco: {formatBRL(change)}</p>}
      {order.notes && <p>Obs. do pedido: {order.notes}</p>}
    </div>
  );
}

export default function PrintPage({ params }: PageProps<"/painel/pedidos/[id]/imprimir">) {
  return (
    <Suspense fallback={<p>Carregando comanda...</p>}>
      <Ticket params={params} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Link no card**

Em `order-card.tsx`, dentro da `div` de ações, antes de "Avisar cliente":

```tsx
        <a
          href={`/painel/pedidos/${order.id}/imprimir`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Imprimir comanda ${orderLabel}`}
          className="text-sm underline"
        >
          Imprimir comanda
        </a>
```

- [ ] **Step 4: Opção "Imprimir comanda ao aceitar"**

`src/app/painel/loja/_components/operations-form.tsx`: no fieldset "Regras", após "Tempo de entrega (min)":

```tsx
        <Check name="autoPrintOnAccept" label="Imprimir comanda ao aceitar" defaultChecked={rules.autoPrintOnAccept} />
```

`src/app/painel/loja/actions.ts` (`saveOperationsAction`): trocar `autoPrintOnAccept: store.rules.autoPrintOnAccept,` por `autoPrintOnAccept: checked(form, "autoPrintOnAccept"),`. Se a variável `store` ficar sem uso, manter só `await requireStoreAccess();` no início.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sem erros; rota `/painel/pedidos/[id]/imprimir` no build.

```bash
git add -A
git commit -m "feat: add 80mm order ticket and optional print on accept"
```

---

### Task 6: Polimentos pendentes do checkout e testes de borda

**Files:**
- Modify: `src/app/[slug]/sacola/_components/checkout.tsx`
- Modify: `src/modules/orders/pricing.test.ts`

**Interfaces:**
- Consumes: código existente.
- Produces: "Revisar pedido" desabilitado até a sacola carregar; erro anterior limpo ao confirmar; testes de borda de quantidade e observação.

- [ ] **Step 1: Testes de borda (devem passar — cobrem código existente)**

Em `src/modules/orders/pricing.test.ts`, no `describe("priceItem")`:

```ts
  it.each([1, 50])("aceita quantidade %d", (quantity) => {
    expect(priceItem(ctx, simple(COCA, quantity), 0).quantity).toBe(quantity);
  });

  it("observação do item é aparada; só espaços vira null", () => {
    expect(priceItem(ctx, { ...simple(COCA), notes: "  bem gelada  " }, 0).notes).toBe("bem gelada");
    expect(priceItem(ctx, { ...simple(COCA), notes: "   " }, 0).notes).toBeNull();
  });
```

Run: `npm test -- src/modules/orders/pricing.test.ts`
Expected: PASS.

- [ ] **Step 2: Checkout**

Em `src/app/[slug]/sacola/_components/checkout.tsx`:
- em `confirm()`, dentro do `startTransition(async () => { ... })`, primeira linha: `setError(null);`;
- no botão "Revisar pedido": `disabled={pending || !cart.ready}`.

- [ ] **Step 3: Verificar e commitar**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "fix: polish checkout review state and cover pricing edge cases"
```

---

### Task 7: E2E da fila, README

**Files:**
- Modify: `e2e/helpers.ts` (`setStoreStatus`, `placePickupOrder`), `e2e/pedido.spec.ts` (usar `setStoreStatus` do helper)
- Create: `e2e/painel-pedidos.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: rótulos das Tasks 3–5; checkout/acompanhamento da F3; seed demo (Coca-Cola 2L R$ 14,00; WhatsApp do cliente digitado no teste).
- Produces:
  - `setStoreStatus(browser, label: "Abrir agora" | "Fechar agora" | "Automático")` e `placePickupOrder(page): Promise<{ orderLabel: string; trackingPath: string }>` em `e2e/helpers.ts`.
  - Suíte `painel-pedidos.spec.ts` (projeto `painel`): pedido novo aparece sozinho com alerta; fluxo aceitar → pronto → concluir refletindo no acompanhamento; avisar cliente; comanda; cancelamento exige motivo; dois aparelhos.

- [ ] **Step 1: Helpers**

Mover `setStoreStatus` de `e2e/pedido.spec.ts` para `e2e/helpers.ts` (exportado, mesma implementação; ajustar o `loginAsOwner(page)` dentro dele para continuar funcionando com o novo destino `/painel`), importar de `./helpers` em `pedido.spec.ts`, e acrescentar:

```ts
export async function placePickupOrder(page: Page): Promise<{ orderLabel: string; trackingPath: string }> {
  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
  const dialog = page.getByRole("dialog", { name: "Coca-Cola 2L" });
  await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  await dialog.getByRole("button", { name: /^Adicionar ·/ }).click();
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("radio", { name: "Pix" }).check();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await expect(page.getByTestId("quote-total")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  const heading = page.getByRole("heading", { name: /^Pedido #\d+ recebido!$/ });
  await expect(heading).toBeVisible();
  const orderLabel = /#\d+/.exec((await heading.textContent()) ?? "")![0];
  const trackingPath = (await page.getByRole("link", { name: "Acompanhar pedido" }).getAttribute("href"))!;
  return { orderLabel, trackingPath };
}
```

(`import { expect, type Browser, type Page } from "@playwright/test";` no topo.)

- [ ] **Step 2: `e2e/painel-pedidos.spec.ts`**

```ts
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAsOwner, placePickupOrder, setStoreStatus } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test.afterAll(async ({ browser }) => {
  await setStoreStatus(browser, "Automático");
});

async function ownerPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await loginAsOwner(page);
  return page;
}

async function customerOrder(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  const order = await placePickupOrder(page);
  return { page, ...order };
}

function card(page: Page, column: string, orderLabel: string) {
  return page.getByRole("region", { name: column }).getByRole("article", { name: `Pedido ${orderLabel}` });
}

test("pedido novo aparece sozinho e muda o título da aba", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.getByRole("button", { name: "Iniciar atendimento" }).click();
  await expect(owner.getByText("Atendimento ativo: alerta sonoro ligado")).toBeVisible();

  const { orderLabel } = await customerOrder(browser);

  await expect(card(owner, "Novos", orderLabel)).toBeVisible({ timeout: 15_000 });
  await expect(owner).toHaveTitle(/^\(\d+\) Novo pedido/);
});

test("aceitar, pronto e concluir aparecem no acompanhamento; avisar e comanda", async ({ browser }) => {
  const { page: customer, orderLabel, trackingPath } = await customerOrder(browser);
  const owner = await ownerPage(browser);

  await owner.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(card(owner, "Em preparo", orderLabel)).toBeVisible();
  await customer.goto(trackingPath);
  await expect(customer.getByTestId("order-status")).toHaveText("Em preparo");

  await owner.getByRole("button", { name: `Pronto ${orderLabel}` }).click();
  await expect(card(owner, "Prontos e em entrega", orderLabel)).toBeVisible();
  await customer.reload();
  await expect(customer.getByTestId("order-status")).toHaveText("Pronto para retirada");

  const notify = owner.getByRole("link", { name: `Avisar cliente ${orderLabel}` });
  const href = (await notify.getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
  expect(decodeURIComponent(href.split("?text=")[1] ?? "")).toContain(`Seu pedido ${orderLabel} da Pizzaria Demo está pronto para retirada.`);

  const ticketHref = (await owner.getByRole("link", { name: `Imprimir comanda ${orderLabel}` }).getAttribute("href"))!;
  const ticket = await owner.context().newPage();
  await ticket.goto(ticketHref);
  await expect(ticket.getByText(`Pedido ${orderLabel}`)).toBeVisible();
  await expect(ticket.getByText("3x Coca-Cola 2L")).toBeVisible();
  await expect(ticket.getByText("Retirada no balcão")).toBeVisible();
  await expect(ticket.getByText("+5511988887777", { exact: false })).toBeVisible();

  await owner.getByRole("button", { name: `Concluir ${orderLabel}` }).click();
  await expect(card(owner, "Finalizados (24 h)", orderLabel)).toBeVisible();
  await customer.reload();
  await expect(customer.getByTestId("order-status")).toHaveText("Concluído");
});

test("cancelar exige motivo e aparece para o cliente", async ({ browser }) => {
  const { page: customer, orderLabel, trackingPath } = await customerOrder(browser);
  const owner = await ownerPage(browser);

  await owner.getByRole("button", { name: `Cancelar pedido ${orderLabel}` }).click();
  const novos = card(owner, "Novos", orderLabel);
  await novos.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(novos.getByText("informe o motivo do cancelamento")).toBeVisible();

  await novos.getByLabel("Motivo do cancelamento").fill("acabou a massa");
  await novos.getByRole("button", { name: "Confirmar cancelamento" }).click();
  const finalizado = card(owner, "Finalizados (24 h)", orderLabel);
  await expect(finalizado).toContainText("Cancelado");
  await expect(finalizado).toContainText("Motivo: acabou a massa");

  await customer.goto(trackingPath);
  await expect(customer.getByTestId("order-status")).toHaveText("Cancelado");
});

test("dois aparelhos: só o primeiro aceite vale", async ({ browser }) => {
  const { orderLabel } = await customerOrder(browser);
  const deviceA = await ownerPage(browser);
  const deviceB = await ownerPage(browser);
  await expect(card(deviceB, "Novos", orderLabel)).toBeVisible();
  // Sem polling no aparelho B: a tela dele fica desatualizada até o clique.
  await deviceB.route("**/api/painel/pedidos/versao", (route) => route.abort());

  await deviceA.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(card(deviceA, "Em preparo", orderLabel)).toBeVisible();

  await deviceB.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(deviceB.getByTestId("queue-notice")).toHaveText("Este pedido já foi atualizado em outro aparelho.");
  await expect(card(deviceB, "Em preparo", orderLabel)).toBeVisible();
});
```

- [ ] **Step 3: Rodar**

Run: `npm run db:migrate && npm run build && PORT=3001 CI=1 npm run test:e2e`
Expected: PASS — publico 8, pedido 5, painel 14 (painel-auth 3 + painel 7 + painel-pedidos 4). Se um seletor não bater com a tela, ajustar a **tela** aos rótulos das Interfaces das Tasks 3–5 (não afrouxar o teste).

- [ ] **Step 4: README**

Acrescentar ao `README.md`, após "Pedido do cliente":

```markdown
## Fila de pedidos (painel)

- `/painel` mostra os pedidos por status (Novos, Em preparo, Prontos e em entrega, Finalizados nas últimas 24 h) e se atualiza sozinho a cada 5 s.
- Clique em **Iniciar atendimento** para ligar o alerta sonoro (exigência dos navegadores) e manter a tela acesa.
- Cada pedido: avançar status, cancelar (com motivo), **Avisar cliente** (WhatsApp com o status) e **Imprimir comanda** (80 mm). Em Loja → "Imprimir comanda ao aceitar" abre a comanda automaticamente ao aceitar.
- Dica para impressão sem diálogo: abra o Chrome com `--kiosk-printing` e defina a térmica como impressora padrão.
```

- [ ] **Step 5: Suíte completa e commit**

Run: `make check PORT=3001`
Expected: tudo passa.

```bash
git add -A
git commit -m "test: cover the panel order queue end to end"
```

