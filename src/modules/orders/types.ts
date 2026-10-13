export const ORDER_STATUSES = ["received", "preparing", "out_for_delivery", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENTS = ["delivery", "pickup", "dine_in"] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export const PAYMENT_METHODS = ["cash", "card_on_delivery", "pix"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_CHANNELS = ["web", "whatsapp"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export type OrderAddress = {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string | null;
  zipCode: string | null;
  reference: string | null;
};

/** Teto de valores em centavos (R$ 1.000.000,00) — mantém tudo dentro de `integer` do Postgres. */
export const MAX_ORDER_CENTS = 100_000_000;
