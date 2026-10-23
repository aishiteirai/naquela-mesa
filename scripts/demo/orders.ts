import type { Menu, MenuProduct } from "@/modules/catalog";
import {
  addDays,
  localDate,
  priceCart,
  zonedMidnight,
  type CartItemInput,
  type Fulfillment,
  type HistoricalOrder,
  type PaymentMethod,
} from "@/modules/orders";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const FIRST_DAY_AGO = 2; // nada nas últimas 24 h: a fila do painel e os E2E não veem o seed
const LAST_DAY_AGO = 30;
const MONDAY = 1; // demo fecha às segundas
const NAMES = [
  "Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Alves", "Elisa Rocha", "Felipe Costa",
  "Gabriela Nunes", "Henrique Dias", "Isabela Martins", "João Pereira", "Larissa Gomes", "Marcos Ribeiro",
];
const STREETS = ["Rua das Palmeiras", "Av. Brasil", "Rua São Paulo", "Rua XV de Novembro", "Rua das Acácias"];
const NEIGHBORHOODS = ["Centro", "Jardim América", "Vila Nova", "Boa Vista", "São José"];
const CANCEL_REASONS = ["Cliente desistiu", "Endereço fora da área", "Sabor em falta"];
const EVENING_HOURS = [18, 19, 19, 20, 20, 20, 21, 21, 22, 23];

/** PRNG pequeno e determinístico (mulberry32): mesmo seed, mesmo histórico. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export type DemoHistoryOptions = { menu: Menu; timeZone: string; now: Date; deliveryFeeCents: number; seed?: number };

export function buildDemoHistory(options: DemoHistoryOptions): HistoricalOrder[] {
  const random = mulberry32(options.seed ?? 20261013);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const { menu } = options;
  const sizedCategories = menu.categories.filter((category) => category.sizes.length > 0);
  const simpleProducts = menu.categories.flatMap((category) =>
    category.sizes.length === 0 ? category.products.filter((product) => product.available && product.priceCents !== null) : [],
  );

  function pizza(): CartItemInput | null {
    if (sizedCategories.length === 0) return null;
    const category = pick(sizedCategories);
    const size = pick(category.sizes);
    const pool = category.products.filter((product) => product.available && product.sizePrices.some((price) => price.sizeId === size.id));
    if (pool.length === 0) return null;
    const halves = pool.filter((product) => product.allowsHalf);
    let flavors: MenuProduct[];
    if (size.maxFlavors >= 2 && halves.length >= 2 && random() < 0.35) {
      const first = pick(halves);
      flavors = [first, pick(halves.filter((product) => product !== first))];
    } else {
      flavors = [pick(pool)];
    }
    const groupIds = new Set(flavors.flatMap((product) => product.optionGroupIds));
    const groups = menu.optionGroups.filter((group) => groupIds.has(group.id) && group.minSelect === 0 && group.maxSelect >= 1);
    const optionIds: string[] = [];
    if (groups.length > 0 && random() < 0.25) {
      const options = pick(groups).options.filter((option) => option.available);
      if (options.length > 0) optionIds.push(pick(options).id);
    }
    return { kind: "sized", sizeId: size.id, flavorIds: flavors.map((product) => product.id), optionIds, quantity: 1, notes: null };
  }

  function simple(): CartItemInput | null {
    if (simpleProducts.length === 0) return null;
    return { kind: "simple", productId: pick(simpleProducts).id, optionIds: [], quantity: 1 + Math.floor(random() * 2), notes: null };
  }

  const today = localDate(options.now, options.timeZone);
  const history: HistoricalOrder[] = [];

  for (let daysAgo = LAST_DAY_AGO; daysAgo >= FIRST_DAY_AGO; daysAgo--) {
    const date = addDays(today, -daysAgo);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === MONDAY) continue;
    const midnight = zonedMidnight(date, options.timeZone).getTime();
    const ordersToday = 3 + Math.floor(random() * 5) + (weekday === 5 || weekday === 6 ? 4 : 0);

    for (let index = 0; index < ordersToday; index++) {
      const items: CartItemInput[] = [];
      const itemCount = 1 + Math.floor(random() * 3);
      for (let line = 0; line < itemCount; line++) {
        const item = line === 0 || random() < 0.4 ? pizza() : simple();
        if (item) items.push(item);
      }
      if (items.length === 0) continue;

      let lines;
      try {
        lines = priceCart({ menu, halfPriceRule: "highest", halfAndHalfEnabled: true, addonsEnabled: true }, items).lines;
      } catch {
        continue; // combinação que o cardápio não aceita: pula o pedido
      }

      const fulfillment: Fulfillment = random() < 0.65 ? "delivery" : "pickup";
      const deliveryFeeCents = fulfillment === "delivery" ? options.deliveryFeeCents : 0;
      const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0) + deliveryFeeCents;
      const paymentRoll = random();
      const paymentMethod: PaymentMethod =
        fulfillment === "pickup" ? "on_pickup" : paymentRoll < 0.3 ? "cash" : paymentRoll < 0.7 ? "card_on_delivery" : "pix";
      const cancelled = random() < 0.07;

      history.push({
        createdAt: new Date(midnight + pick(EVENING_HOURS) * HOUR + Math.floor(random() * 60) * MINUTE),
        status: cancelled ? "cancelled" : "completed",
        cancelReason: cancelled ? pick(CANCEL_REASONS) : null,
        fulfillment,
        customerName: pick(NAMES),
        customerPhone: `+55119${String(Math.floor(random() * 100_000_000)).padStart(8, "0")}`,
        address:
          fulfillment === "delivery"
            ? {
                street: pick(STREETS),
                number: String(10 + Math.floor(random() * 990)),
                complement: null,
                neighborhood: pick(NEIGHBORHOODS),
                city: null,
                zipCode: null,
                reference: null,
              }
            : null,
        tableLabel: null,
        paymentMethod,
        changeForCents: paymentMethod === "cash" && random() < 0.5 ? Math.ceil((totalCents + 1) / 5000) * 5000 : null,
        lines,
        deliveryFeeCents,
      });
    }
  }
  return history;
}
