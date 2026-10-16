# Painel — aplicar as propostas do canvas · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no painel da loja (`/painel/*`) as pranchas aprovadas: tema Naquela Mesa, barra lateral nova, Primeiros passos flutuante, card de pedido, Histórico, Métricas, Cardápio unificado e Configurações com barra de salvar.

**Architecture:** Primeiro as peças de servidor pequenas e testáveis (Tasks 1-6), depois a camada de tema (7), o shell (8-9) e cada tela (10-17). Tokens do shadcn são redefinidos só dentro de `[data-panel-theme]`, então as telas herdam a paleta sem tocar em cor por cor. Estado de tela continua em parâmetros de URL.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind v4, shadcn 4.21.5 (radix-nova), Drizzle + Postgres, Zod, Vitest (unit + integration), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-painel-propostas-design.md` (aprovado em 2026-10-16). Executores leem a seção do spec indicada em cada tarefa.

**Pranchas (referência visual):** `/tmp/claude-1000/-home-ryan-workspace-personalprojects-ecom-menu/da191e20-c033-4b29-b6f3-85ac058e0e52/scratchpad/painel-design/project/` — `Sidebar.dc.html` (ramo `brand=yes`), `PropostaMenuLoja`, `PropostaPrimeirosPassos`, `PropostaHistorico`, `PropostaMetricas`, `PropostaCardapio`, `PropostaProduto`, `PropostaGrupo`, `PropostaLoja`. São HTML com estilos inline: copiar medidas, textos e estrutura; cores sempre via tokens (`bg-primary`, `bg-muted`, `border-border`, `text-muted-foreground`, …), nunca hex solto nas telas.

## Global Constraints

- Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código Next (exigência do `AGENTS.md`).
- Imports com `@/…`; o lint proíbe `../`.
- Commits em inglês, terminando com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Nunca alterar `git config`.
- Textos de interface em português, exatamente como no spec.
- Nada de migração SQL. Mapas globais `FULFILLMENT_LABELS`, `statusLabel`, `PERIOD_LABELS` **não mudam**; rótulos curtos ficam em `src/app/painel/_lib/labels.ts`.
- Cor da loja nunca como cor de texto sobre fundo claro.
- Login, admin, cardápio público e impressão (`/painel/pedidos/[id]/imprimir`) não mudam de visual.
- Verificação de cada tarefa: `npm run lint && npm run typecheck && npm test` e, quando a tarefa tocar servidor, `npm run test:int`. Tarefas de UI rodam o(s) spec(s) E2E indicados com `make e2e` (ou `DATABASE_URL=postgres://naquela:naquela@localhost:5434/naquela_mesa_e2e npx playwright test e2e/<arquivo>` depois de um `make e2e` completo ter criado o banco). Nunca rodar E2E contra o banco do dev.
- Dev server do usuário em :3001 — não matar processos dele.

## Review Focus

1. Loja com `theme` salvo antes desta mudança (sem `panelColors`) abre o painel no tema Naquela sem erro — teste em Task 2.
2. Turno que vira a meia-noite mostra "fecha 00:30" tanto às 23h quanto à 0h10 do dia seguinte — teste em Task 1.
3. Grupo de adicionais salvo com uma opção nova e uma editada na mesma ação não perde nem duplica opções; falha de validação não grava nada — teste em Task 5.
4. Primeiros passos fechado não volta ao recarregar a página, mas volta após sair e entrar — teste unitário em Task 3, E2E em Task 9.
5. Pix ligado sem chave é rejeitado com "Informe a chave Pix" e nada é gravado (operação e bairros juntos) — teste em Task 6.

---

### Task 1: Horário de fechamento no status da loja

**Files:**
- Modify: `src/modules/stores/hours.ts`
- Test: `src/modules/stores/hours.test.ts`

**Interfaces:**
- Produces: `OpenStatus = { isOpen: boolean; nextOpening: NextOpening | null; closesAt: string | null }`; `formatStoreStatus(status: OpenStatus, manualStatus: ManualStatus): string`.

- [ ] **Step 1: Atualizar testes existentes e escrever os novos**

Em `hours.test.ts`, todo `toEqual({ isOpen: true, nextOpening: null })` e `toEqual({ isOpen: false, ... })` ganha `closesAt`. Exemplos concretos (manter os demais casos ajustando da mesma forma):

```ts
it("aberto dentro do turno (sexta 19:00)", () => {
  expect(statusAt("2026-10-16T22:00:00Z")).toEqual({ isOpen: true, nextOpening: null, closesAt: "23:30" });
});

it("fechamento é exclusivo: sexta 23:30 fechado, próxima abertura amanhã 18:00", () => {
  expect(statusAt("2026-10-17T02:30:00Z")).toEqual({
    isOpen: false,
    nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" },
    closesAt: null,
  });
});

it("manual não tem horário de fechamento", () => {
  expect(statusAt("2026-10-12T22:00:00Z", "force_open")).toEqual({ isOpen: true, nextOpening: null, closesAt: null });
  expect(statusAt("2026-10-16T22:00:00Z", "force_closed")).toEqual({ isOpen: false, nextOpening: null, closesAt: null });
});

it("turno que vira a meia-noite fecha 00:30 antes e depois da meia-noite", () => {
  // sábado 23:00 em São Paulo = domingo 02:00Z
  expect(statusAt("2026-10-18T02:00:00Z").closesAt).toBe("00:30");
  // domingo 00:10 em São Paulo = domingo 03:10Z
  expect(statusAt("2026-10-18T03:10:00Z").closesAt).toBe("00:30");
});

describe("formatStoreStatus", () => {
  it("aberto no automático mostra o fechamento", () => {
    expect(formatStoreStatus({ isOpen: true, nextOpening: null, closesAt: "23:30" }, "auto")).toBe("Aberto · fecha às 23:30");
  });
  it("fechado no automático mostra a próxima abertura", () => {
    expect(formatStoreStatus({ isOpen: false, nextOpening: { dayOffset: 0, weekday: 5, time: "18:00" }, closesAt: null }, "auto")).toBe("Fechado · abre hoje às 18:00");
  });
  it("fechado sem próxima abertura", () => {
    expect(formatStoreStatus({ isOpen: false, nextOpening: null, closesAt: null }, "auto")).toBe("Fechado");
  });
  it("manual", () => {
    expect(formatStoreStatus({ isOpen: true, nextOpening: null, closesAt: null }, "force_open")).toBe("Aberto agora (manual)");
    expect(formatStoreStatus({ isOpen: false, nextOpening: null, closesAt: null }, "force_closed")).toBe("Fechado agora (manual)");
  });
});
```

Importar `formatStoreStatus` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run --project unit src/modules/stores/hours.test.ts`. Esperado: falhas por `closesAt` ausente e `formatStoreStatus` inexistente.

- [ ] **Step 3: Implementar**

```ts
export type OpenStatus = { isOpen: boolean; nextOpening: NextOpening | null; closesAt: string | null };

// em getOpenStatus:
if (input.manualStatus === "force_open") return { isOpen: true, nextOpening: null, closesAt: null };
if (input.manualStatus === "force_closed") return { isOpen: false, nextOpening: null, closesAt: null };

const { weekday, minutes } = localClock(input.now, input.timeZone);
const current = input.hours.find((shift) => isWithinShift(shift, weekday, minutes));
if (current) return { isOpen: true, nextOpening: null, closesAt: current.closesAt };
return { isOpen: false, nextOpening: findNextOpening(input.hours, weekday, minutes), closesAt: null };
```

```ts
/** Texto curto do status para o painel (barra lateral e Configurações). */
export function formatStoreStatus(status: OpenStatus, manualStatus: ManualStatus): string {
  if (manualStatus === "force_open") return "Aberto agora (manual)";
  if (manualStatus === "force_closed") return "Fechado agora (manual)";
  if (status.isOpen) return status.closesAt ? `Aberto · fecha às ${status.closesAt}` : "Aberto agora";
  if (!status.nextOpening) return "Fechado";
  return `Fechado · ${formatOpenStatus(status).replace(/^Abre/, "abre")}`;
}
```

Exportar `formatStoreStatus` em `src/modules/stores/index.ts` ao lado de `formatOpenStatus`. Rodar `grep -rn "nextOpening: null }" src e2e` e ajustar outros `toEqual` que comparem `OpenStatus` inteiro.

- [ ] **Step 4: Rodar e ver passar** — `npm test` e `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: closing time in store open status`

---

### Task 2: Preferência "Cores do painel" na loja

**Files:**
- Modify: `src/modules/stores/settings.ts`, `src/modules/stores/settings-service.ts`, `src/app/painel/(shell)/loja/actions.ts`
- Test: `src/modules/stores/settings-service.int.test.ts`

**Interfaces:**
- Produces: `StoreTheme.panelColors: "naquela" | "store"` (padrão `"naquela"`); `StoreProfileInput.theme.panelColors?: "naquela" | "store"`; `saveProfileAction` lê o campo de formulário `panelColors`.

- [ ] **Step 1: Testes** — em `settings-service.int.test.ts`, o teste de perfil (perto da linha 60) passa a esperar `theme: { primary, secondary, font, panelColors: "naquela" }`. Adicionar:

```ts
it("cores do painel: padrão naquela, salva store e preserva quando omitido", async () => {
  // usar a loja criada no beforeEach do arquivo (mesmo padrão dos testes vizinhos)
  expect((await getStoreById(storeId))!.theme.panelColors).toBe("naquela");
  await updateStoreProfile(storeId, { ...baseProfile, theme: { primary: "#B91C1C", secondary: "#F59E0B", panelColors: "store" } });
  expect((await getStoreById(storeId))!.theme.panelColors).toBe("store");
  await updateStoreProfile(storeId, { ...baseProfile, theme: { primary: "#B91C1C", secondary: "#F59E0B" } });
  expect((await getStoreById(storeId))!.theme.panelColors).toBe("store");
});

it("cores do painel: valor inválido é rejeitado", async () => {
  await expect(
    updateStoreProfile(storeId, { ...baseProfile, theme: { primary: "#B91C1C", secondary: "#F59E0B", panelColors: "roxo" as never } }),
  ).rejects.toMatchObject({ code: "VALIDATION" });
});

it("loja com tema antigo (sem panelColors) lê como naquela", async () => {
  await db.update(stores).set({ theme: { primary: "#B91C1C", secondary: "#F59E0B", font: "sans" } as never }).where(eq(stores.id, storeId));
  expect((await getStoreById(storeId))!.theme.panelColors).toBe("naquela");
});
```

`baseProfile` = o objeto de perfil já usado no teste existente do arquivo (nome, endereço, whatsapp, logo, capa); se não existir como constante, extrair.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run --project integration src/modules/stores/settings-service.int.test.ts`.
- [ ] **Step 3: Implementar**

```ts
// settings.ts
export const storeThemeSchema = z.object({
  primary: hexColor.default("#B91C1C"),
  secondary: hexColor.default("#F59E0B"),
  font: z.enum(["sans", "serif"]).default("sans"),
  panelColors: z.enum(["naquela", "store"]).default("naquela"),
});
```

```ts
// settings-service.ts
.extend({
  theme: storeThemeSchema.pick({ primary: true, secondary: true }).extend({
    font: storeThemeSchema.shape.font.unwrap().optional(),
    panelColors: storeThemeSchema.shape.panelColors.unwrap().optional(),
  }),
});
```

Em `saveProfileAction`: `panelColors: form.get("panelColors") === "store" ? "store" : form.get("panelColors") === "naquela" ? "naquela" : undefined` dentro de `theme`.

- [ ] **Step 4: Rodar e ver passar** — `npm run test:int`, `npm test`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: store setting for panel colors`

---

### Task 3: Id da sessão e regra do Primeiros passos

**Files:**
- Modify: `src/modules/auth/guards.ts`
- Create: `src/app/painel/_lib/checklist-visibility.ts`
- Test: `src/app/painel/_lib/checklist-visibility.test.ts`

**Interfaces:**
- Produces: `SessionUser.sessionId: string`; `CHECKLIST_DISMISS_KEY = "primeiros-passos-fechado"`; `shouldShowChecklist(input: { sessionId: string; dismissedFor: string | null; pending: number }): boolean`.

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import { shouldShowChecklist } from "./checklist-visibility";

describe("shouldShowChecklist", () => {
  it("mostra quando nunca foi fechado", () => {
    expect(shouldShowChecklist({ sessionId: "s1", dismissedFor: null, pending: 2 })).toBe(true);
  });
  it("esconde quando fechado nesta sessão", () => {
    expect(shouldShowChecklist({ sessionId: "s1", dismissedFor: "s1", pending: 2 })).toBe(false);
  });
  it("volta numa sessão nova", () => {
    expect(shouldShowChecklist({ sessionId: "s2", dismissedFor: "s1", pending: 2 })).toBe(true);
  });
  it("some quando tudo concluído", () => {
    expect(shouldShowChecklist({ sessionId: "s2", dismissedFor: null, pending: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**

```ts
export const CHECKLIST_DISMISS_KEY = "primeiros-passos-fechado";

export function shouldShowChecklist(input: { sessionId: string; dismissedFor: string | null; pending: number }): boolean {
  if (input.pending === 0) return false;
  return input.dismissedFor !== input.sessionId;
}
```

Em `guards.ts`: `SessionUser` ganha `sessionId: string`; `getCurrentUser` devolve `sessionId: session.session.id`. Corrigir com `npm run typecheck` qualquer lugar que monte `SessionUser` à mão (testes, fixtures).

- [ ] **Step 4: Rodar e ver passar** — `npm test`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: expose session id and checklist visibility rule`

---

### Task 4: Histórico — filtro por tipo e soma

**Files:**
- Modify: `src/modules/orders/history.ts`
- Test: `src/modules/orders/history.int.test.ts`

**Interfaces:**
- Produces: `OrderHistoryFilter.fulfillment?: Fulfillment | null`; `OrderHistoryPage.revenueCents: number` (soma de `totalCents` dos pedidos do filtro, sem cancelados).

- [ ] **Step 1: Testes** — no `describe("histórico de pedidos")`, usando `place` (pickup) e uma variante de delivery. Criar `placeDelivery` igual a `place` mas com `fulfillment: "delivery"`, `address: { street: "Rua A", number: "1", neighborhood: "Centro", complement: null, reference: null }` (conferir o tipo de endereço em `src/modules/orders/types.ts` e ajustar campos) e `expectedTotalCents: 2000` (1400 + taxa 600).

```ts
it("filtra por tipo de pedido", async () => {
  await place("historico-a", a.coca, "Ana", "11999990001", "2026-10-10T20:00:00Z");
  await placeDelivery("historico-a", a.coca, "Bia", "11999990002", "2026-10-10T21:00:00Z");
  const delivery = await listOrderHistory(a.storeId, { ...ALL, fulfillment: "delivery" });
  expect(delivery.orders.map((o) => o.customerName)).toEqual(["Bia"]);
  const pickup = await listOrderHistory(a.storeId, { ...ALL, fulfillment: "pickup" });
  expect(pickup.orders.map((o) => o.customerName)).toEqual(["Ana"]);
});

it("soma o total sem cancelados", async () => {
  const first = await place("historico-a", a.coca, "Ana", "11999990001", "2026-10-10T20:00:00Z");
  await place("historico-a", a.coca, "Bia", "11999990002", "2026-10-10T21:00:00Z");
  await transitionOrder(a.storeId, first, { to: "cancelled", cancelReason: "teste" }, actor);
  const page = await listOrderHistory(a.storeId, ALL);
  expect(page.total).toBe(2);
  expect(page.revenueCents).toBe(1400);
});
```

Conferir a assinatura real de `transitionOrder` em `queue.ts` e ajustar a chamada de cancelamento ao que os testes vizinhos já usam.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**

```ts
import { and, count, desc, eq, gte, ilike, like, lt, ne, sql, sum, type SQL } from "drizzle-orm";
import type { Fulfillment, OrderStatus } from "./types";

export type OrderHistoryFilter = { start: Date; end: Date; status: OrderStatus | null; fulfillment?: Fulfillment | null; search: string | null; page: number; pageSize?: number };
export type OrderHistoryPage = { orders: QueueOrder[]; total: number; revenueCents: number; page: number; pageCount: number };

// where ganha: filter.fulfillment ? eq(orders.fulfillment, filter.fulfillment) : undefined,
const [counted] = await db
  .select({
    total: count(),
    revenue: sql<string | null>`sum(${orders.totalCents}) filter (where ${orders.status} <> 'cancelled')`,
  })
  .from(orders)
  .where(where);
const total = counted?.total ?? 0;
const revenueCents = Number(counted?.revenue ?? 0);
// ...
return { orders: await hydrateOrders(rows), total, revenueCents, page, pageCount };
```

Remover imports não usados (`ne`, `sum`) se sobrarem. Conferir o nome da coluna de total em `orders/schema.ts` (`totalCents`).

- [ ] **Step 4: Rodar e ver passar** — `npm run test:int`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: fulfillment filter and revenue sum in order history`

---

### Task 5: Cardápio — salvar grupo com opções, ocultar produto, uso do grupo

**Files:**
- Modify: `src/modules/catalog/editor-products.ts`, `src/modules/catalog/index.ts`
- Create: `src/app/painel/(shell)/cardapio/_lib/group-usage.ts`
- Test: `src/modules/catalog/editor-products.int.test.ts`, `src/app/painel/(shell)/cardapio/_lib/group-usage.test.ts`

**Interfaces:**
- Produces:
  - `SaveOptionGroupInput = { name: string; minSelect: number; maxSelect: number; options: { id?: string; name: string; priceCents: number; available: boolean }[] }`
  - `saveOptionGroup(storeId: string, groupId: string | null, input: SaveOptionGroupInput): Promise<{ id: string }>` — transação: cria (groupId null) ou atualiza o grupo; opção com `id` é atualizada (precisa ser do grupo, senão `NOT_FOUND`); sem `id` é inserida no fim; opções existentes ausentes da lista ficam como estão.
  - `setProductActive(storeId: string, productId: string, active: boolean): Promise<void>`
  - `groupUsage(categories: { products: { id: string; name: string; categoryId: string; optionGroupIds: string[] }[] }[]): Map<string, { id: string; name: string; categoryId: string }[]>`

- [ ] **Step 1: Testes de integração** (seguir o setup do `describe` "grupos e opções de adicionais" já existente no arquivo):

```ts
it("saveOptionGroup cria grupo com opções numa vez", async () => {
  const { id } = await saveOptionGroup(storeId, null, {
    name: "Borda recheada", minSelect: 0, maxSelect: 1,
    options: [{ name: "Catupiry", priceCents: 800, available: true }, { name: "Cheddar", priceCents: 800, available: false }],
  });
  const group = (await getCatalogForEditing(storeId)).optionGroups.find((g) => g.id === id)!;
  expect(group.options.map((o) => [o.name, o.priceCents, o.available])).toEqual([["Catupiry", 800, true], ["Cheddar", 800, false]]);
});

it("saveOptionGroup edita uma opção e adiciona outra sem duplicar", async () => {
  const { id } = await saveOptionGroup(storeId, null, { name: "Borda", minSelect: 0, maxSelect: 1, options: [{ name: "Catupiry", priceCents: 800, available: true }] });
  const [catupiry] = (await getCatalogForEditing(storeId)).optionGroups.find((g) => g.id === id)!.options;
  await saveOptionGroup(storeId, id, {
    name: "Borda recheada", minSelect: 1, maxSelect: 2,
    options: [{ id: catupiry!.id, name: "Catupiry", priceCents: 900, available: true }, { name: "Chocolate", priceCents: 1000, available: true }],
  });
  const group = (await getCatalogForEditing(storeId)).optionGroups.find((g) => g.id === id)!;
  expect([group.name, group.minSelect, group.maxSelect]).toEqual(["Borda recheada", 1, 2]);
  expect(group.options.map((o) => [o.name, o.priceCents])).toEqual([["Catupiry", 900], ["Chocolate", 1000]]);
});

it("saveOptionGroup inválido não grava nada", async () => {
  const { id } = await saveOptionGroup(storeId, null, { name: "Borda", minSelect: 0, maxSelect: 1, options: [] });
  await expect(saveOptionGroup(storeId, id, { name: "Novo nome", minSelect: 3, maxSelect: 1, options: [{ name: "X", priceCents: 0, available: true }] }))
    .rejects.toMatchObject({ code: "VALIDATION" });
  const group = (await getCatalogForEditing(storeId)).optionGroups.find((g) => g.id === id)!;
  expect(group.name).toBe("Borda");
  expect(group.options).toEqual([]);
});

it("saveOptionGroup recusa opção de outro grupo", async () => {
  const a = await saveOptionGroup(storeId, null, { name: "A", minSelect: 0, maxSelect: 1, options: [{ name: "Op", priceCents: 0, available: true }] });
  const b = await saveOptionGroup(storeId, null, { name: "B", minSelect: 0, maxSelect: 1, options: [] });
  const op = (await getCatalogForEditing(storeId)).optionGroups.find((g) => g.id === a.id)!.options[0]!;
  await expect(saveOptionGroup(storeId, b.id, { name: "B", minSelect: 0, maxSelect: 1, options: [{ id: op.id, name: "Op", priceCents: 0, available: true }] }))
    .rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("setProductActive oculta e mostra", async () => {
  await setProductActive(storeId, productId, false);
  expect(findProduct(await getCatalogForEditing(storeId), productId).active).toBe(false);
  await setProductActive(storeId, productId, true);
  expect(findProduct(await getCatalogForEditing(storeId), productId).active).toBe(true);
});
```

`productId`/`findProduct`: usar o produto e helper que o arquivo já cria; se não houver helper, `view.categories.flatMap((c) => c.products).find((p) => p.id === id)!`.

Unitário de `groupUsage`:

```ts
import { describe, expect, it } from "vitest";
import { groupUsage } from "./group-usage";

describe("groupUsage", () => {
  it("lista os produtos de cada grupo na ordem do cardápio", () => {
    const usage = groupUsage([
      { products: [{ id: "p1", name: "Mussarela", categoryId: "c1", optionGroupIds: ["g1"] }, { id: "p2", name: "Calabresa", categoryId: "c1", optionGroupIds: ["g1", "g2"] }] },
      { products: [{ id: "p3", name: "Coca", categoryId: "c2", optionGroupIds: [] }] },
    ]);
    expect(usage.get("g1")?.map((p) => p.name)).toEqual(["Mussarela", "Calabresa"]);
    expect(usage.get("g2")?.map((p) => p.id)).toEqual(["p2"]);
    expect(usage.get("g3")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**

```ts
const saveOptionGroupInputSchema = optionGroupInputSchema.and(
  z.object({
    options: z.array(optionInputSchema.extend({ id: z.uuid().optional() })).max(100, "máximo de 100 opções"),
  }),
);

export type SaveOptionGroupInput = z.input<typeof saveOptionGroupInputSchema>;

export async function saveOptionGroup(storeId: string, groupId: string | null, input: SaveOptionGroupInput): Promise<{ id: string }> {
  const { options: optionList, ...group } = parseInput(saveOptionGroupInputSchema, input);
  return db.transaction(async (tx) => {
    let id = groupId;
    if (id === null) {
      const [last] = await tx.select({ position: max(optionGroups.position) }).from(optionGroups).where(eq(optionGroups.storeId, storeId));
      const [row] = await tx.insert(optionGroups).values({ storeId, ...group, position: (last?.position ?? -1) + 1 }).returning({ id: optionGroups.id });
      id = row!.id;
    } else {
      const updated = await tx.update(optionGroups).set(group)
        .where(and(eq(optionGroups.id, id), eq(optionGroups.storeId, storeId))).returning({ id: optionGroups.id });
      if (updated.length === 0) throw notFound();
    }

    const [last] = await tx.select({ position: max(options.position) }).from(options).where(eq(options.groupId, id));
    let position = (last?.position ?? -1) + 1;
    for (const { id: optionId, ...data } of optionList) {
      if (optionId) {
        const updated = await tx.update(options).set(data)
          .where(and(eq(options.id, optionId), eq(options.groupId, id), eq(options.storeId, storeId))).returning({ id: options.id });
        if (updated.length === 0) throw notFound();
      } else {
        await tx.insert(options).values({ storeId, groupId: id, ...data, position: position++ });
      }
    }
    return { id };
  });
}

export async function setProductActive(storeId: string, productId: string, active: boolean): Promise<void> {
  const updated = await db.update(products).set({ active })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId))).returning({ id: products.id });
  if (updated.length === 0) throw notFound();
}
```

Se `optionGroupInputSchema.and(...)` perder o `refine` de mínimo ≤ máximo no `parseInput`, trocar por `z.object({...shape, options}).refine(...)` reescrevendo o refine. Exportar `saveOptionGroup`, `setProductActive` e `type SaveOptionGroupInput` em `index.ts`.

```ts
// group-usage.ts
type UsageProduct = { id: string; name: string; categoryId: string };

export function groupUsage(categories: { products: (UsageProduct & { optionGroupIds: string[] })[] }[]): Map<string, UsageProduct[]> {
  const usage = new Map<string, UsageProduct[]>();
  for (const category of categories) {
    for (const { optionGroupIds, ...product } of category.products) {
      for (const groupId of optionGroupIds) usage.set(groupId, [...(usage.get(groupId) ?? []), product]);
    }
  }
  return usage;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm run test:int`, `npm test`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: save option group with options in one transaction; hide product action`

---

### Task 6: Operação e bairros numa transação, Pix exige chave

**Files:**
- Modify: `src/modules/stores/settings-service.ts`, `src/modules/stores/index.ts`
- Test: `src/modules/stores/settings-service.int.test.ts`

**Interfaces:**
- Produces: `saveOperationsWithZones(storeId: string, input: { operations: StoreOperationsInput; zones: DeliveryZoneInput[] }): Promise<void>` — valida tudo antes, grava operação e bairros na mesma transação. Validação extra: se o formulário marcar Pix ligado, a action manda `pixKey` com texto; a regra "Informe a chave Pix" fica na action (Task 17), porque o serviço só vê `pixKey` nulo ou preenchido.

- [ ] **Step 1: Testes**

```ts
it("saveOperationsWithZones grava operação e bairros juntos", async () => {
  await saveOperationsWithZones(storeId, {
    operations: { ...currentOperations, rules: { ...currentOperations.rules, deliveryFee: { strategy: "by_neighborhood" } } },
    zones: [{ neighborhood: "Centro", feeCents: 500 }],
  });
  expect((await getDeliveryZones(storeId)).map((z) => z.neighborhood)).toEqual(["Centro"]);
  expect((await getStoreById(storeId))!.rules.deliveryFee.strategy).toBe("by_neighborhood");
});

it("saveOperationsWithZones com bairro inválido não grava a operação", async () => {
  const before = (await getStoreById(storeId))!.rules.minOrderCents;
  await expect(saveOperationsWithZones(storeId, {
    operations: { ...currentOperations, rules: { ...currentOperations.rules, minOrderCents: before + 1000 } },
    zones: [{ neighborhood: "Centro", feeCents: 500 }, { neighborhood: "centro", feeCents: 700 }],
  })).rejects.toMatchObject({ code: "VALIDATION" });
  expect((await getStoreById(storeId))!.rules.minOrderCents).toBe(before);
});
```

`currentOperations`: montar a partir de `getStoreById` (`features`, `rules`, `paymentMethods`), como os testes de operação vizinhos fazem. Conferir o formato exato de `deliveryFee` em `settings.ts`.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — extrair a validação de bairros de `replaceDeliveryZones` para `parseZones(zones)` (mesma montagem de issues com prefixo `zones.`), reaproveitada pelas duas funções:

```ts
export async function saveOperationsWithZones(storeId: string, input: { operations: StoreOperationsInput; zones: DeliveryZoneInput[] }): Promise<void> {
  const operations = parse(storeOperationsInputSchema, input.operations);
  const zones = parseZones(input.zones);
  await db.transaction(async (tx) => {
    const updated = await tx.update(stores).set({ ...operations, updatedAt: sql`now()` }).where(eq(stores.id, storeId)).returning({ id: stores.id });
    if (updated.length === 0) throw new DomainError("NOT_FOUND");
    await tx.delete(deliveryZones).where(eq(deliveryZones.storeId, storeId));
    if (zones.length > 0) await tx.insert(deliveryZones).values(zones.map((zone, position) => ({ storeId, ...zone, position })));
  });
}
```

Exportar em `index.ts`.

- [ ] **Step 4: Rodar e ver passar** — `npm run test:int`, `npm run typecheck`.
- [ ] **Step 5: Commit** — `feat: save store operations and delivery zones atomically`

---

### Task 7: Camada de tema do painel

**Spec:** §3.

**Files:**
- Modify: `src/app/globals.css`, `src/app/painel/(shell)/layout.tsx`
- Create: `src/app/painel/_lib/panel-theme.ts`, `src/app/painel/_lib/panel-theme.test.ts`, `src/app/painel/_components/panel-theme-root.tsx`
- Test E2E: `e2e/painel-tema.spec.ts`

**Interfaces:**
- Consumes: `store.theme.panelColors` (Task 2).
- Produces:
  - `panelThemeVariables(theme: StoreTheme): Record<string, string>` — `{}` para `naquela`; para `store`, `--primary`, `--primary-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--ring`, `--chart-1`, `--chart-2`, `--primary-hover`, `--tint`, `--accent`, `--sidebar-accent` (tint), usando os helpers de `src/modules/stores/theme.ts` para a cor de texto legível.
  - `<PanelThemeRoot palette="naquela" | "loja" style={...}>` — `div` com `data-panel-theme`, classe `pacifico.variable`, `min-h-svh` e `bg-background text-foreground`. Exposto também um contexto cliente `usePanelPalette()` com `setPreview(palette | null)` para a prévia ao vivo da Task 15.

- [ ] **Step 1: Teste unitário de `panelThemeVariables`** — `naquela` devolve `{}`; `store` com `#B91C1C`/`#F59E0B` devolve `--primary: "#B91C1C"`, `--chart-2: "#F59E0B"`, `--primary-foreground` igual ao que `theme.ts` calcula para essa cor (importar o helper e comparar), e `--tint` começando com `color-mix(`.
- [ ] **Step 2: Implementar `globals.css`** — blocos `[data-panel-theme="naquela"]`, `.dark [data-panel-theme="naquela"]`, `[data-panel-theme="loja"]` (só tokens extras com padrão neutro; primária vem inline) e `.dark [data-panel-theme="loja"]`, com os valores exatos da tabela §3.2. Registrar os tokens novos no `@theme inline` (`--color-brand`, `--color-primary-hover`, `--color-tint`, `--color-ok`, `--color-ok-foreground`) para virarem classes Tailwind (`bg-tint`, `text-brand`…).
- [ ] **Step 3: Envolver o shell** — `(shell)/layout.tsx` renderiza `<PanelThemeRoot palette={store.theme.panelColors === "store" ? "loja" : "naquela"} style={panelThemeVariables(store.theme)}>` por fora do `SidebarProvider`.
- [ ] **Step 4: E2E** — em `e2e/painel-tema.spec.ts`: ajustar a cor de fundo esperada no claro (o fundo continua branco; se o Chromium serializar `#FFFFFF` como `rgb(255, 255, 255)` em vez de `lab(100 0 0)`, atualizar a constante); adicionar teste "painel usa a primária Naquela por padrão": no `/painel`, `getComputedStyle` de um botão primário (ex. "Iniciar atendimento") tem fundo equivalente a `#B5481C`. "Sair" ainda está no rodapé nesta tarefa (muda na Task 8).
- [ ] **Step 5: Verificação** — lint, typecheck, unit, `e2e/painel-tema.spec.ts`. Abrir `/painel` claro e escuro no navegador do E2E (screenshot) e conferir que login/admin/cardápio público não mudaram.
- [ ] **Step 6: Commit** — `feat: Naquela Mesa palette for the store panel`

---

### Task 8: Barra lateral e topo

**Spec:** §4.1, §4.2. **Prancha:** `Sidebar.dc.html` (`brand=yes`), `PropostaMenuLoja.dc.html`.

**Files:**
- Modify: `src/app/painel/_lib/nav.ts`, `src/app/painel/_lib/nav.test.ts`, `src/app/painel/_components/panel-sidebar.tsx`, `src/app/painel/_components/page-title.tsx`, `src/app/painel/(shell)/layout.tsx`, `src/components/ui/sidebar.tsx` (só `--sidebar-width-icon` para `3.5rem`)
- Create: `src/app/painel/_components/store-menu.tsx`, `src/app/painel/_components/new-orders-badge.tsx`, `src/app/painel/_components/new-orders-context.tsx`
- Modify: `src/app/painel/(shell)/pedidos/_components/queue-poller.tsx` (publica a contagem no contexto)
- Test E2E: `e2e/painel-auth.spec.ts`, `e2e/painel-tema.spec.ts`, `e2e/painel.spec.ts` (bloco celular)

**Interfaces:**
- Consumes: `formatStoreStatus`, `getOpenStatus` (Task 1); `getQueueVersion(storeId).received` (já existe) para o valor inicial; `/api/painel/pedidos/versao` (já existe).
- Produces:
  - `PANEL_NAV: { href: string; label: string; primary?: true }[]` = Pedidos (`/painel`, primary), Cardápio (`/painel/cardapio`), Histórico (`/painel/pedidos`), Métricas (`/painel/metricas`).
  - `isNavItemActive(pathname, href)`: `/painel` só exato; `/painel/cardapio` ativo em `/painel/cardapio` e qualquer subcaminho.
  - `pageTrail(pathname): string[]` — `/painel` → `["Operação", "Pedidos"]`; `/painel/pedidos` → `["Operação", "Histórico"]`; `/painel/metricas` → `["Operação", "Métricas"]`; `/painel/cardapio…` → `["Cardápio"]`; `/painel/loja` → `["Loja", "Configurações"]`.
  - `NewOrdersProvider` (cliente) com `useNewOrders(): { count: number; setCount(n: number): void }`; faz polling de 15s e ao voltar foco, exceto quando o `QueuePoller` está montado (ele chama `setCount` a cada versão nova).

- [ ] **Step 1: Testes unitários** — reescrever `nav.test.ts` para `PANEL_NAV` (4 itens, ordem acima), `isNavItemActive` (`/painel` vs `/painel/pedidos`; `/painel/cardapio` ativo em `/painel/cardapio?grupo=x` e `/painel/cardapio/qualquer`) e `pageTrail` (os 5 casos).
- [ ] **Step 2: Implementar `nav.ts`** e ver os testes passarem.
- [ ] **Step 3: Implementar a barra lateral** conforme §4.1: `StoreMenu` (DropdownMenu do shadcn) no `SidebarHeader`; item Pedidos com variante própria (44px; inativo `bg-card`; ativo `bg-primary text-primary-foreground`; selo `useNewOrders().count`; recolhida: ponto `bg-brand`); demais itens com `SidebarMenuButton` ajustado para 36px; rodapé com "Painel por" + "Naquela Mesa" (`scriptFont`, `text-brand`, link `/`) e `ModeToggle`. Status da loja calculado no servidor no layout (`getOpenStatus` com `await connection()` conforme o guia do Next) e passado ao `StoreMenu`. Botão de recolher: `aria-label="Recolher barra lateral"` no desktop e "Abrir menu" no celular (`useSidebar().isMobile`).
- [ ] **Step 4: E2E** — `painel-auth.spec.ts`: "Ver cardápio" e "Sair" passam a abrir antes o botão `{nome} — abrir menu da loja` e usar `getByRole("menuitem")`; o fluxo de Produtos/Adicionais vira o link "Cardápio" com `aria-current="page"`. `painel-tema.spec.ts`: "Sair" pelo menu da loja. `painel.spec.ts` bloco celular: continua com "Abrir menu". Novo teste: com 1 pedido recebido (helper existente de criar pedido), a barra mostra "1 novo"/"N novos" no item Pedidos estando em `/painel/metricas`.
- [ ] **Step 5: Verificação** — lint, typecheck, unit, os 3 specs E2E. Screenshot desktop aberto/recolhido e celular com gaveta aberta e menu da loja aberto.
- [ ] **Step 6: Commit** — `feat: panel sidebar with store menu, highlighted orders and brand footer`

Rótulo do selo: `count === 1 ? "1 novo" : `${count} novos``.

---

### Task 9: Primeiros passos flutuante

**Spec:** §4.3. **Prancha:** `PropostaPrimeirosPassos.dc.html` (só o card).

**Files:**
- Create: `src/app/painel/_components/floating-checklist.tsx`
- Modify: `src/app/painel/(shell)/layout.tsx`, `src/app/painel/(shell)/page.tsx` (remove o card antigo), `src/modules/onboarding/checklist.ts` (hrefs com aba) e seu teste, `src/app/painel/_components/onboarding-checklist.tsx` (vira o carregador server que passa itens + `sessionId` ao componente cliente)
- Test E2E: `e2e/admin.spec.ts`; novo teste em `e2e/painel-auth.spec.ts`

**Interfaces:**
- Consumes: `shouldShowChecklist`, `CHECKLIST_DISMISS_KEY`, `SessionUser.sessionId` (Task 3); `getOnboardingChecklist(store)`.
- Produces: `<FloatingChecklist sessionId items />`.

- [ ] **Step 1: Atualizar hrefs do checklist** (logo → `/painel/loja?aba=aparencia`, horários → `?aba=horarios`, entrega e Pix → `?aba=pedidos`) e o teste `checklist.test.ts`.
- [ ] **Step 2: Implementar** o card conforme §4.3: monta só depois de ler `localStorage` em `useEffect` (try/catch; erro conta como "não fechado"); × grava o `sessionId`; links fecham nada (navegam normalmente).
- [ ] **Step 3: E2E** — `admin.spec.ts`: a região "Primeiros passos" contém "1 de 5 concluídos". Novo teste: no `/painel` com passos pendentes, fechar pelo "Fechar primeiros passos"; recarregar e conferir que não aparece; sair pelo menu da loja, entrar de novo e conferir que voltou.
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/admin.spec.ts`, `e2e/painel-auth.spec.ts`. Screenshot desktop e celular.
- [ ] **Step 5: Commit** — `feat: floating getting-started checklist that returns each session`

---

### Task 10: Fila de pedidos e card de pedido

**Spec:** §5. **Prancha:** `PropostaPrimeirosPassos.dc.html` (fila e cards).

**Files:**
- Create: `src/app/painel/_lib/labels.ts`, `src/app/painel/_lib/labels.test.ts`, `src/app/painel/_lib/relative-time.ts`, `src/app/painel/_lib/relative-time.test.ts`
- Modify: `src/app/painel/(shell)/page.tsx`, `src/app/painel/(shell)/pedidos/_components/order-card.tsx`, `advance-button.tsx`, `cancel-form.tsx` (dentro de Dialog), `queue-poller.tsx` (botão)
- Test E2E: `e2e/painel-pedidos.spec.ts`

**Interfaces:**
- Produces:
  - `PANEL_FULFILLMENT_LABELS: Record<Fulfillment, string>` = `{ delivery: "Delivery", pickup: "Retirada", dine_in: "Na mesa" }`
  - `queueStatusLabel(status: OrderStatus, fulfillment: Fulfillment): string` — `received` → "Novo"; demais = `statusLabel(status, fulfillment)`.
  - `minutesAgo(createdAt: Date, now: Date): string` — `< 1 min` → "agora"; `< 60` → "há N min"; senão "há N h".

- [ ] **Step 1: Testes unitários** de `labels.ts` (os 3 rótulos; `received` vira "Novo"; `preparing` igual ao `statusLabel`) e `relative-time.ts` (0s → "agora", 3 min → "há 3 min", 59 min → "há 59 min", 2h05 → "há 2 h").
- [ ] **Step 2: Implementar** os helpers e o card conforme §5, item a item (cabeçalho, tipo + cliente + ligar, endereço, itens com "×", pagamento + total, ações com "⋯" → Dialog de cancelamento). Hora relativa num componente cliente que atualiza a cada 60s.
- [ ] **Step 3: E2E** — em `painel-pedidos.spec.ts`, cancelar passa a abrir "Mais ações do pedido #n" e escolher o menuitem "Cancelar pedido" antes do formulário. Demais seletores continuam.
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel-pedidos.spec.ts`. Screenshot da fila com pedidos em todas as colunas (claro e escuro).
- [ ] **Step 5: Commit** — `feat: redesigned order queue cards`

---

### Task 11: Seletor de período compartilhado e Histórico

**Spec:** §6.1. **Prancha:** `PropostaHistorico.dc.html`.

**Files:**
- Create: `src/app/painel/_components/period-picker.tsx` (Popover: presets + Personalizado com De/Até e "Aplicar"), `src/app/painel/_components/segmented.tsx` (grupo de botões com `aria-pressed`), `src/app/painel/(shell)/pedidos/_components/history-filters.tsx`
- Modify: `src/app/painel/(shell)/pedidos/page.tsx`, `_components/history-list.tsx`; remove `src/app/painel/_components/period-fields.tsx` quando Métricas (Task 12) também deixar de usar — nesta tarefa só deixa de usar no Histórico
- Test E2E: `e2e/painel-metricas.spec.ts` (bloco do histórico)

**Interfaces:**
- Consumes: `listOrderHistory` com `fulfillment` e `revenueCents` (Task 4); `PANEL_FULFILLMENT_LABELS` (Task 10).
- Produces: `<PeriodPicker value={{ preset, de, ate }} labels />` que escreve `periodo`/`de`/`ate` na URL via `router.replace` e mostra erro de período vindo do servidor; `<Segmented label options value onChange />`; parâmetro `tipo=delivery|pickup|dine_in` (inválido = ignorado).

- [ ] **Step 1: Parser de `tipo`** — onde `page.tsx` lê `status`, ler `tipo` aceitando só os 3 valores; incluir em `pageHref`. Se houver parser testável em `_lib/search-params.ts`, adicionar teste lá (válido, inválido, ausente).
- [ ] **Step 2: Implementar** filtros e tabela conforme §6.1 (busca com Enter e 400ms; contagem em `<span>` próprio no subtítulo).
- [ ] **Step 3: E2E** — reescrever o teste de histórico: período "Hoje" pelo PeriodPicker; busca por `getByLabel("Buscar")` + Enter; `getByText("1 pedido", { exact: true })`; abrir "Ver pedido #…"; status "Cancelados" pelo grupo `Status` → URL `status=cancelled`. Novo: filtro Tipo "Retirada" → URL `tipo=pickup`.
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel-metricas.spec.ts`. Screenshot desktop e celular.
- [ ] **Step 5: Commit** — `feat: order history with auto-applied filters, type filter and total`

---

### Task 12: Métricas

**Spec:** §6.2. **Prancha:** `PropostaMetricas.dc.html`.

**Files:**
- Modify: `src/app/painel/(shell)/metricas/page.tsx`, `_components/bar-list.tsx`
- Create: `src/app/painel/(shell)/metricas/_components/column-chart.tsx`, `stacked-bar.tsx`, `src/app/painel/(shell)/metricas/_lib/shares.ts` + teste
- Delete: `src/app/painel/_components/period-fields.tsx` se não houver mais uso
- Test E2E: `e2e/painel-metricas.spec.ts` (testes de métricas)

**Interfaces:**
- Consumes: `PeriodPicker`, `Segmented` (Task 11); `getStoreMetrics` (inalterado).
- Produces: `shares(values: number[]): number[]` — percentuais inteiros que somam 100 (maior resto), `[]` → `[]`, tudo zero → zeros.

- [ ] **Step 1: Teste de `shares`** — `[12, 8]` → `[60, 40]`; `[1, 1, 1]` soma 100; `[0, 0]` → `[0, 0]`.
- [ ] **Step 2: Implementar** conforme §6.2 (segmentado Hoje/7 dias/30 dias + Personalizado; KPIs com ícone; Mais vendidos com posição; colunas por hora em `ul/li`; barras empilhadas com legenda).
- [ ] **Step 3: E2E** — trocar `selectOption("30d")` + "Aplicar" por clicar "30 dias" no grupo `Período` e esperar `periodo=30d`; região "Mais vendidos"; período personalizado inválido pelo PeriodPicker mostrando "A data de início deve ser antes da data de fim.".
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel-metricas.spec.ts`. Screenshot.
- [ ] **Step 5: Commit** — `feat: metrics with period segments, column and stacked charts`

---

### Task 13: Cardápio unificado — tela, coluna e painéis de categoria/grupo

**Spec:** §7.1, §7.4. **Prancha:** `PropostaCardapio.dc.html`.

**Files:**
- Modify: `src/app/painel/(shell)/cardapio/page.tsx`, `_components/menu-editor.tsx`, `category-panel.tsx`, `product-row.tsx`, `menu-url.ts`, `src/app/painel/_lib/panel-params.ts` + teste, `src/lib/url-overlay.ts` (chaves novas), `next.config.ts` (redirect `/painel/cardapio/adicionais` → `/painel/cardapio`, `permanent: false`)
- Move: `src/app/painel/(shell)/cardapio/adicionais/actions.ts` → `src/app/painel/(shell)/cardapio/adicionais-actions.ts`; apagar a pasta `adicionais/` (os componentes de lá são substituídos nesta tarefa e na 14)
- Create: `src/app/painel/(shell)/cardapio/_components/menu-sidebar.tsx`, `group-panel.tsx`
- Modify: `src/app/painel/(shell)/cardapio/actions.ts` (nova `toggleProductActiveAction` usando `setProductActive`)
- Test E2E: `e2e/painel.spec.ts` (cardápio), `e2e/painel-forms.spec.ts` (tamanhos)

**Interfaces:**
- Consumes: `groupUsage` (Task 5), `setProductActive` (Task 5), `toggleOptionAvailabilityAction` (existe).
- Produces: `parsePanelParams` devolve também `groupId: string | null` (de `?grupo=`, validado contra `catalog.optionGroups`), `editGroupId: string | null` (`?editar-grupo=`), `newGroup: boolean` (`?novo-grupo=1`). `categoria` e `grupo` são exclusivos (`grupo` vence se ambos válidos).

- [ ] **Step 1: Testes de `panel-params`** — `?grupo=<id válido>` seleciona grupo; id inválido cai na primeira categoria; `?editar-grupo=<id>` válido; `?novo-grupo=1`; os 9 casos existentes continuam passando.
- [ ] **Step 2: Implementar** a tela conforme §7.1 (coluna esquerda com `nav aria-label="Cardápio"` e lista "Categorias do cardápio"; painel de categoria; painel de grupo com "usado em N produtos", opções com chave e faixa "Usado em:"; "⋯" do produto com "Ocultar no cardápio"/"Mostrar no cardápio"; aviso "Adicionais desligados na loja" quando `features.addons` falso, com link `/painel/loja?aba=pedidos`; celular com seletor de dois grupos). Os botões "Editar grupo", "+ Opção", "+ Grupo de adicionais" e lápis das opções só ajustam a URL (`?editar-grupo=` / `?novo-grupo=1`); o `Sheet` do grupo vem na Task 14.
- [ ] **Step 3: E2E** — atualizar `selectCategory` e seletores afetados; novo teste: clicar o grupo "Borda recheada" (seed) na coluna, ver "usado em" e desligar uma opção pela chave (toast); "Ocultar no cardápio" num produto e conferir no cardápio público que sumiu; `/painel/cardapio/adicionais` redireciona.
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel.spec.ts`, `e2e/painel-forms.spec.ts`. Screenshot.
- [ ] **Step 5: Commit** — `feat: unified menu editor with categories and add-on groups`

Confirmar o nome do grupo no seed (`scripts/demo/seed.ts`) antes de escrever o E2E.

---

### Task 14: Painéis laterais de produto e de grupo

**Spec:** §7.2, §7.3. **Pranchas:** `PropostaProduto.dc.html`, `PropostaGrupo.dc.html`.

**Files:**
- Modify: `src/app/painel/(shell)/cardapio/_components/product-sheet.tsx`, `product-form.tsx`
- Create: `src/app/painel/(shell)/cardapio/_components/group-sheet.tsx`, `group-form.tsx`, `src/app/painel/(shell)/cardapio/_lib/rule-label.ts` + teste (se `ruleLabel` ainda não for exportável de um lugar testável)
- Modify: `src/app/painel/(shell)/cardapio/adicionais-actions.ts` (nova `saveOptionGroupAction(groupId | null, formData)` que monta `SaveOptionGroupInput` de campos `options.N.id/name/price/available`, chama `saveOptionGroup`, devolve `{ status: "success", id }`)
- Test E2E: `e2e/painel.spec.ts`

**Interfaces:**
- Consumes: `saveOptionGroup` (Task 5), `groupUsage` (Task 5), params da Task 13.
- Produces: criar grupo pelo produto: o form do produto guarda o rascunho, abre `?novo-grupo=1`; ao salvar, o id devolvido entra em `optionGroupIds` do rascunho e o painel do produto volta.

- [ ] **Step 1: Teste de `ruleLabel`** (se criado): `{0,1}` → "Opcional · até 1"; `{0,3}` → "Opcional · até 3"; `{1,1}` → "Obrigatório · escolha 1"; `{1,3}` → "Obrigatório · de 1 a 3"; minúsculo para o cartão do produto ("opcional, até 1").
- [ ] **Step 2: Implementar** os dois painéis conforme §7.2 e §7.3 (cartões `role="switch"` de adicionais; "Aparece no cardápio"; "Cancelar"; contadores Mínimo/Até; linhas de opção editáveis; "Salvar grupo").
- [ ] **Step 3: E2E** — novo teste: abrir "Editar grupo" de "Borda recheada", mudar para Obrigatório com mínimo 1, adicionar opção "Cheddar" R$ 7,00, salvar; reabrir e conferir; abrir um produto, desligar e religar o cartão do grupo, salvar. Os testes existentes de produto continuam ("Salvar produto", "Preço Broto", "Novo produto").
- [ ] **Step 4: Verificação** — lint, typecheck, unit, int, `e2e/painel.spec.ts`. Screenshot dos dois painéis (desktop e celular).
- [ ] **Step 5: Commit** — `feat: product and add-on group side panels`

---

### Task 15: Configurações — barra de salvar e aba Aparência

**Spec:** §8.1, §8.2. **Prancha:** `PropostaLoja.dc.html` (aba Aparência).

**Files:**
- Create: `src/app/painel/(shell)/loja/_components/save-bar.tsx`, `src/app/painel/(shell)/loja/_lib/phone-mask.ts` + teste
- Modify: `src/app/painel/(shell)/loja/page.tsx`, `_components/settings-tabs.tsx`, `profile-form.tsx`, `theme-preview.tsx`, `actions.ts` (mensagem "Aparência salva." mantida)
- Test E2E: `e2e/painel.spec.ts` (prévia/aparência)

**Interfaces:**
- Consumes: `panelColors` (Task 2), `usePanelPalette().setPreview` (Task 7).
- Produces: `<SaveBar dirty pending onDiscard />` (o "Salvar" é `type="submit"` do form da aba); `formatPhoneBR(e164: string): string` e `phoneBRToE164(masked: string): string | null` (`"(11) 99999-9999"` ↔ `"+5511999999999"`; inválido → `null`).

- [ ] **Step 1: Testes de `phone-mask`** — ida e volta para celular (11 dígitos) e fixo (10 dígitos); entrada com `+55` já é aceita; lixo → `null`.
- [ ] **Step 2: Implementar** a barra (sticky no rodapé, só com `dirty`; `beforeunload` quando sujo) e a aba conforme §8.2. "Cores do painel" chama `setPreview` na hora; "Descartar" e sair da página sem salvar chamam `setPreview(null)`; salvar com sucesso mantém a cor (o layout já relê a loja).
- [ ] **Step 3: E2E** — fonte por `getByRole("radio", { name: /Clássica/ })`; "Salvar" no lugar de "Salvar aparência"; novo teste: escolher "Cores da loja", salvar, recarregar e conferir a primária da loja num botão primário do painel; "Descartar" desfaz uma mudança de nome.
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel.spec.ts`. Screenshot.
- [ ] **Step 5: Commit** — `feat: store settings save bar and appearance tab with panel colors`

---

### Task 16: Aba Horários e status

**Spec:** §8.3. **Prancha:** `PropostaLoja.dc.html` (aba Horários).

**Files:**
- Modify: `src/app/painel/(shell)/loja/_components/hours-editor.tsx`, `status-buttons.tsx`, `src/app/painel/(shell)/loja/page.tsx` (status calculado com `getOpenStatus` + `formatStoreStatus`)
- Create: `src/app/painel/(shell)/loja/_lib/time-input.ts` + teste
- Test E2E: `e2e/painel.spec.ts` (status, turnos sobrepostos), `e2e/helpers.ts` (`setStoreStatus`, se preciso)

**Interfaces:**
- Consumes: `formatStoreStatus` (Task 1), `SaveBar` (Task 15).
- Produces: `normalizeTime(raw: string): string | null` — aceita `"1830"`, `"18:30"`, `"8:05"` → `"18:30"`, `"08:05"`; `"24:00"`, `"18:60"`, `""` → `null`.

- [ ] **Step 1: Teste de `normalizeTime`** com os casos acima.
- [ ] **Step 2: Implementar** conforme §8.3 (pílula, cartões de status com texto de apoio `aria-hidden`, linhas de dia com chave, chips de turno em 24h, remover, adicionar, erro na linha). Status continua com a action atual.
- [ ] **Step 3: E2E** — região "Turnos"; teste de sobreposição: ligar um dia, adicionar dois turnos que se sobrepõem, "Salvar", ver "há turnos sobrepostos"; `setStoreStatus` continua achando "Automático"/"Abrir agora"/"Fechar agora" sem ambiguidade (rodar `e2e/pedido.spec.ts` também, que usa o helper).
- [ ] **Step 4: Verificação** — lint, typecheck, unit, `e2e/painel.spec.ts`, `e2e/pedido.spec.ts`. Screenshot.
- [ ] **Step 5: Commit** — `feat: hours tab with status card, day switches and 24h shift chips`

---

### Task 17: Aba Pedidos e pagamento

**Spec:** §8.4. **Prancha:** `PropostaLoja.dc.html` (aba Pedidos e pagamento).

**Files:**
- Modify: `src/app/painel/(shell)/loja/_components/operations-form.tsx`, `zones-editor.tsx`, `src/app/painel/(shell)/loja/actions.ts` (nova `saveOperationsAction` usando `saveOperationsWithZones`; remove a action separada de bairros se não houver outro uso; mensagem "Pedidos e pagamento salvos."; Pix ligado com chave vazia → erro de campo `paymentMethods.pixKey` "Informe a chave Pix" sem chamar o serviço)
- Test E2E: `e2e/painel-forms.spec.ts`, `e2e/painel.spec.ts` (abas)

**Interfaces:**
- Consumes: `saveOperationsWithZones` (Task 6), `SaveBar` (Task 15), `PANEL_FULFILLMENT_LABELS` (Task 10).

- [ ] **Step 1: Implementar** conforme §8.4 (tiles de tipo e de pagamento `role="switch"`, taxa segmentada com bairros dentro, Regras com Meio a meio + seletor e linha Adicionais, Pix guardando o texto no rascunho).
- [ ] **Step 2: E2E** — `painel-forms.spec.ts`: tile `getByRole("switch", { name: "Cartão" })`, botão "Salvar", persistência após recarregar; novo: ligar Pix com chave vazia e salvar mostra "Informe a chave Pix"; trocar para "Por bairro", adicionar bairro, salvar e conferir no checkout do cardápio público que o bairro aparece.
- [ ] **Step 3: Verificação** — lint, typecheck, unit, int, `e2e/painel-forms.spec.ts`, `e2e/painel.spec.ts`. Screenshot.
- [ ] **Step 4: Commit** — `feat: orders and payment tab with tiles and zones inside the fee card`

---

### Task 18: Fechamento

- [ ] **Step 1:** `make test` (lint, typecheck, unit, integração) e `make e2e` completo. Tudo verde.
- [ ] **Step 2:** `grep -rn "period-fields\|cardapio/adicionais\|Salvar aparência\|Salvar operação\|Salvar horários" src e2e` não acha uso morto (o redirect em `next.config.ts` é esperado).
- [ ] **Step 3:** Atualizar `docs/superpowers/specs/2026-10-16-painel-propostas-design.md` para "Status: implementado" e anotar desvios feitos durante a execução.
- [ ] **Step 4: Commit** — `docs: mark panel proposals spec as implemented`
