import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { isUniqueViolation } from "@/shared/db/errors";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { storeHours, stores } from "./schema";
import {
  createStoreInputSchema,
  storeFeaturesSchema,
  storeHoursInputSchema,
  storePaymentMethodsSchema,
  storeRulesSchema,
  storeThemeSchema,
  type CreateStoreInput,
  type StoreHourInput,
} from "./settings";
import type { Store } from "./types";

export async function createStore(input: CreateStoreInput): Promise<{ id: string }> {
  const parsed = createStoreInputSchema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);

  try {
    const [row] = await db.insert(stores).values(parsed.data).returning({ id: stores.id });
    return { id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("VALIDATION", { issues: [{ path: "slug", message: "slug já está em uso" }] });
    }
    throw error;
  }
}

export async function replaceStoreHours(storeId: string, hours: StoreHourInput[]): Promise<void> {
  const parsed = storeHoursInputSchema.safeParse(hours);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);

  await db.transaction(async (tx) => {
    await tx.delete(storeHours).where(eq(storeHours.storeId, storeId));
    if (parsed.data.length > 0) {
      await tx.insert(storeHours).values(parsed.data.map((hour) => ({ storeId, ...hour })));
    }
  });
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const [row] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!row) return null;

  const hours = await db
    .select({ weekday: storeHours.weekday, opensAt: storeHours.opensAt, closesAt: storeHours.closesAt })
    .from(storeHours)
    .where(eq(storeHours.storeId, row.id))
    .orderBy(asc(storeHours.weekday), asc(storeHours.opensAt));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    whatsappPhone: row.whatsappPhone,
    address: row.address,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    timezone: row.timezone,
    theme: storeThemeSchema.parse(row.theme),
    features: storeFeaturesSchema.parse(row.features),
    rules: storeRulesSchema.parse(row.rules),
    paymentMethods: storePaymentMethodsSchema.parse(row.paymentMethods),
    manualStatus: row.manualStatus,
    // Postgres devolve "HH:MM:SS"; o domínio usa "HH:MM".
    hours: hours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt.slice(0, 5),
      closesAt: hour.closesAt.slice(0, 5),
    })),
  };
}

export async function deleteStoreBySlug(slug: string): Promise<boolean> {
  const deleted = await db.delete(stores).where(eq(stores.slug, slug)).returning({ id: stores.id });
  return deleted.length > 0;
}
