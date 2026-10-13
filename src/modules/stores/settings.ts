import { z } from "zod";

export const RESERVED_SLUGS = ["admin", "api", "login", "painel", "pedido", "_next", "favicon.ico"] as const;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor deve estar no formato #RRGGBB");
const hourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário deve estar no formato HH:MM");
const cents = z.number().int().nonnegative();

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const storeThemeSchema = z.object({
  primary: hexColor.default("#B91C1C"),
  secondary: hexColor.default("#F59E0B"),
  font: z.enum(["sans", "serif"]).default("sans"),
});

export const storeFeaturesSchema = z.object({
  delivery: z.boolean().default(true),
  pickup: z.boolean().default(true),
  dineIn: z.boolean().default(false),
  halfAndHalf: z.boolean().default(true),
  addons: z.boolean().default(true),
  coupons: z.literal(false).default(false),
  scheduling: z.literal(false).default(false),
});

export const storeRulesSchema = z.object({
  minOrderCents: cents.default(0),
  prepTimeMin: z.number().int().positive().default(30),
  deliveryTimeMin: z.number().int().positive().default(45),
  halfPriceRule: z.enum(["highest", "average"]).default("highest"),
  autoPrintOnAccept: z.boolean().default(false),
  deliveryFee: z
    .discriminatedUnion("strategy", [
      z.object({ strategy: z.literal("fixed"), fixedCents: cents }),
      z.object({ strategy: z.literal("by_neighborhood") }),
    ])
    .default({ strategy: "fixed", fixedCents: 0 }),
});

export const storePaymentMethodsSchema = z.object({
  cash: z.boolean().default(true),
  cardOnDelivery: z.boolean().default(true),
  pixKey: z.string().trim().min(1).nullable().default(null),
});

export const createStoreInputSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(SLUG_PATTERN, "slug deve ter só letras minúsculas, números e hífens")
    .refine((slug) => !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]), "slug reservado"),
  name: z.string().trim().min(1).max(120),
  whatsappPhone: z.string().regex(/^\+[1-9]\d{7,14}$/, "telefone deve estar no formato E.164 (+5511999999999)"),
  address: z.string().trim().min(1).max(300).nullable().default(null),
  timezone: z.string().refine(isValidTimeZone, "fuso horário inválido").default("America/Sao_Paulo"),
  logoUrl: z.url({ protocol: /^https$/ }).nullable().default(null),
  bannerUrl: z.url({ protocol: /^https$/ }).nullable().default(null),
  theme: storeThemeSchema.prefault({}),
  features: storeFeaturesSchema.prefault({}),
  rules: storeRulesSchema.prefault({}),
  paymentMethods: storePaymentMethodsSchema.prefault({}),
});

export const storeHourInputSchema = z
  .object({ weekday: z.number().int().min(0).max(6), opensAt: hourMinute, closesAt: hourMinute })
  .refine((hour) => hour.opensAt !== hour.closesAt, {
    message: "abertura e fechamento não podem ser iguais",
    path: ["closesAt"],
  });

export const storeHoursInputSchema = z.array(storeHourInputSchema).max(21);

export type StoreTheme = z.infer<typeof storeThemeSchema>;
export type StoreFeatures = z.infer<typeof storeFeaturesSchema>;
export type StoreRules = z.infer<typeof storeRulesSchema>;
export type StorePaymentMethods = z.infer<typeof storePaymentMethodsSchema>;
export type CreateStoreInput = z.input<typeof createStoreInputSchema>;
export type StoreHourInput = z.input<typeof storeHourInputSchema>;
