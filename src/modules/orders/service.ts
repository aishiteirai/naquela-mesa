import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getMenu, type Menu } from "@/modules/catalog";
import {
  formatOpenStatus,
  getDeliveryZones,
  getOpenStatus,
  getStoreById,
  getStoreBySlug,
  type DeliveryZone,
  type Store,
} from "@/modules/stores";
import { db } from "@/shared/db/client";
import { isUniqueViolation } from "@/shared/db/errors";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { checkoutInputSchema, type ParsedCheckout } from "./checkout-input";
import { normalizeBrazilPhone } from "./phone";
import { describeLine, priceCart, type PricedLine } from "./pricing";
import { orderCounters, orderItemOptions, orderItems, orders, orderStatusEvents } from "./schema";
import {
  MAX_ORDER_CENTS,
  type Fulfillment,
  type OrderAddress,
  type OrderChannel,
  type OrderStatus,
  type PaymentMethod,
} from "./types";

export type OrderQuote = { lines: PricedLine[]; subtotalCents: number; deliveryFeeCents: number; totalCents: number };

type StoreRef = { slug: string; name: string; whatsappPhone: string };

export type PlacedOrder = {
  orderId: string;
  number: number;
  publicToken: string;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  tableLabel: string | null;
  paymentMethod: PaymentMethod;
  changeForCents: number | null;
  notes: string | null;
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  store: StoreRef;
};

export type OrderTracking = {
  number: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  customerFirstName: string;
  createdAt: string;
  items: { description: string; quantity: number; totalCents: number; options: string[] }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  store: StoreRef & { timezone: string };
};

const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function validation(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

function parseCheckout(input: unknown): ParsedCheckout {
  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  return parsed.data;
}

async function loadStore(slug: string): Promise<Store> {
  const store = await getStoreBySlug(slug);
  if (!store) throw new DomainError("NOT_FOUND");
  return store;
}

function normalizeNeighborhood(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function assertOperation(store: Store, input: ParsedCheckout, now: Date): void {
  const fulfillmentEnabled: Record<Fulfillment, boolean> = {
    delivery: store.features.delivery,
    pickup: store.features.pickup,
    dine_in: store.features.dineIn,
  };
  if (!fulfillmentEnabled[input.fulfillment]) throw new DomainError("FULFILLMENT_DISABLED", { fulfillment: input.fulfillment });

  const paymentEnabled: Record<PaymentMethod, boolean> = {
    cash: store.paymentMethods.cash,
    card_on_delivery: store.paymentMethods.cardOnDelivery,
    pix: store.paymentMethods.pixKey !== null,
  };
  if (!paymentEnabled[input.payment.method]) throw new DomainError("PAYMENT_DISABLED", { method: input.payment.method });

  const status = getOpenStatus({ hours: store.hours, manualStatus: store.manualStatus, timeZone: store.timezone, now });
  if (!status.isOpen) throw new DomainError("STORE_CLOSED", { message: formatOpenStatus(status) });
}

function deliveryFee(store: Store, zones: DeliveryZone[], input: ParsedCheckout): number {
  if (input.fulfillment !== "delivery" || !input.address) return 0;
  const rule = store.rules.deliveryFee;
  if (rule.strategy === "fixed") return rule.fixedCents;

  const wanted = normalizeNeighborhood(input.address.neighborhood);
  const zone = zones.find((candidate) => normalizeNeighborhood(candidate.neighborhood) === wanted);
  if (!zone) throw new DomainError("ZONE_NOT_SERVED", { neighborhood: input.address.neighborhood });
  return zone.feeCents;
}

function computeQuote(store: Store, menu: Menu, zones: DeliveryZone[], input: ParsedCheckout, now: Date): OrderQuote {
  assertOperation(store, input, now);
  const { lines, subtotalCents } = priceCart(
    {
      menu,
      halfPriceRule: store.rules.halfPriceRule,
      halfAndHalfEnabled: store.features.halfAndHalf,
      addonsEnabled: store.features.addons,
    },
    input.items,
  );
  if (subtotalCents < store.rules.minOrderCents) {
    throw new DomainError("BELOW_MIN_ORDER", { minOrderCents: store.rules.minOrderCents });
  }

  const deliveryFeeCents = deliveryFee(store, zones, input);
  const totalCents = subtotalCents + deliveryFeeCents;
  if (totalCents > MAX_ORDER_CENTS) throw validation("items", "pedido acima do limite");
  if (input.payment.method === "cash" && input.payment.changeForCents !== null && input.payment.changeForCents < totalCents) {
    throw validation("payment.changeForCents", "o troco deve ser igual ou maior que o total");
  }
  return { lines, subtotalCents, deliveryFeeCents, totalCents };
}

async function quoteFor(store: Store, input: ParsedCheckout, now: Date): Promise<OrderQuote> {
  const [menu, zones] = await Promise.all([getMenu(store.id), getDeliveryZones(store.id)]);
  return computeQuote(store, menu, zones, input, now);
}

export async function quoteOrder(slug: string, rawInput: unknown, now: Date = new Date()): Promise<OrderQuote> {
  const input = parseCheckout(rawInput);
  const store = await loadStore(slug);
  return quoteFor(store, input, now);
}

async function findByIdempotency(storeId: string, idempotencyKey: string): Promise<string | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.idempotencyKey, idempotencyKey)))
    .limit(1);
  return row?.id ?? null;
}

async function loadLines(orderId: string): Promise<PricedLine[]> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.position));
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

  return items.map((item) => ({
    productName: item.productName,
    sizeName: item.sizeName,
    flavors: item.flavors,
    options: options
      .filter((option) => option.orderItemId === item.id)
      .map((option) => ({ groupName: option.groupName, optionName: option.optionName, priceCents: option.priceCents })),
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.totalCents,
    notes: item.notes,
  }));
}

async function loadPlacedOrder(orderId: string): Promise<PlacedOrder> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new DomainError("NOT_FOUND");
  const store = await getStoreById(order.storeId);
  if (!store) throw new DomainError("NOT_FOUND");

  return {
    orderId: order.id,
    number: order.number,
    publicToken: order.publicToken,
    fulfillment: order.fulfillment,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.address,
    tableLabel: order.tableLabel,
    paymentMethod: order.paymentMethod,
    changeForCents: order.changeForCents,
    notes: order.notes,
    lines: await loadLines(order.id),
    subtotalCents: order.subtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    store: { slug: store.slug, name: store.name, whatsappPhone: store.whatsappPhone },
  };
}

export async function createOrder(
  slug: string,
  rawInput: unknown,
  channel: OrderChannel = "web",
  now: Date = new Date(),
): Promise<PlacedOrder> {
  const input = parseCheckout(rawInput);
  if (input.expectedTotalCents === null) throw validation("expectedTotalCents", "revise o pedido antes de confirmar");
  const phone = normalizeBrazilPhone(input.customer.phone);
  if (!phone) throw validation("customer.phone", "telefone inválido (use DDD + número)");

  const store = await loadStore(slug);
  // Repetição com a mesma chave devolve o pedido original, mesmo que a loja tenha fechado ou o carrinho mudado.
  const existing = await findByIdempotency(store.id, input.idempotencyKey);
  if (existing) return loadPlacedOrder(existing);

  const quote = await quoteFor(store, input, now);
  if (quote.totalCents !== input.expectedTotalCents) throw new DomainError("PRICE_CHANGED", { quote });

  try {
    const orderId = await db.transaction(async (tx) => {
      // Upsert com incremento: a linha do contador serializa pedidos concorrentes da mesma loja.
      const [counter] = await tx
        .insert(orderCounters)
        .values({ storeId: store.id, lastNumber: 1 })
        .onConflictDoUpdate({ target: orderCounters.storeId, set: { lastNumber: sql`${orderCounters.lastNumber} + 1` } })
        .returning({ lastNumber: orderCounters.lastNumber });

      const [order] = await tx
        .insert(orders)
        .values({
          storeId: store.id,
          number: counter!.lastNumber,
          publicToken: randomBytes(32).toString("base64url"),
          idempotencyKey: input.idempotencyKey,
          channel,
          fulfillment: input.fulfillment,
          customerName: input.customer.name,
          customerPhone: phone,
          address: input.fulfillment === "delivery" ? input.address : null,
          tableLabel: input.fulfillment === "dine_in" ? input.tableLabel : null,
          paymentMethod: input.payment.method,
          changeForCents: input.payment.method === "cash" ? input.payment.changeForCents : null,
          notes: input.notes,
          subtotalCents: quote.subtotalCents,
          deliveryFeeCents: quote.deliveryFeeCents,
          totalCents: quote.totalCents,
        })
        .returning({ id: orders.id });

      for (const [position, line] of quote.lines.entries()) {
        const [item] = await tx
          .insert(orderItems)
          .values({
            orderId: order!.id,
            productName: line.productName,
            sizeName: line.sizeName,
            flavors: line.flavors,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            totalCents: line.totalCents,
            notes: line.notes,
            position,
          })
          .returning({ id: orderItems.id });
        if (line.options.length > 0) {
          await tx.insert(orderItemOptions).values(line.options.map((option) => ({ orderItemId: item!.id, ...option })));
        }
      }

      await tx.insert(orderStatusEvents).values({ orderId: order!.id, status: "received" });
      return order!.id;
    });
    return loadPlacedOrder(orderId);
  } catch (error) {
    // Corrida de clique duplo: o outro request gravou primeiro com a mesma chave.
    if (isUniqueViolation(error)) {
      const raced = await findByIdempotency(store.id, input.idempotencyKey);
      if (raced) return loadPlacedOrder(raced);
    }
    throw error;
  }
}

export async function getOrderTracking(publicToken: string): Promise<OrderTracking | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(publicToken)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.publicToken, publicToken)).limit(1);
  if (!order) return null;
  const store = await getStoreById(order.storeId);
  if (!store) return null;
  const lines = await loadLines(order.id);

  return {
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    customerFirstName: order.customerName.split(/\s+/)[0] ?? order.customerName,
    createdAt: order.createdAt.toISOString(),
    items: lines.map((line) => ({
      description: describeLine(line),
      quantity: line.quantity,
      totalCents: line.totalCents,
      options: line.options.map((option) => `${option.groupName}: ${option.optionName}`),
    })),
    subtotalCents: order.subtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    store: { slug: store.slug, name: store.name, whatsappPhone: store.whatsappPhone, timezone: store.timezone },
  };
}
