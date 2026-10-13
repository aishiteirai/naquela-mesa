import type { StoreFeatures, StorePaymentMethods, StoreRules, StoreTheme } from "./settings";

export type ManualStatus = "auto" | "force_open" | "force_closed";

/** Turno de funcionamento. Horários "HH:MM"; closesAt < opensAt = vira a meia-noite. weekday: 0 = domingo. */
export type StoreHour = { weekday: number; opensAt: string; closesAt: string };

export type Store = {
  id: string;
  slug: string;
  name: string;
  whatsappPhone: string;
  address: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  timezone: string;
  theme: StoreTheme;
  features: StoreFeatures;
  rules: StoreRules;
  paymentMethods: StorePaymentMethods;
  manualStatus: ManualStatus;
  hours: StoreHour[];
};
