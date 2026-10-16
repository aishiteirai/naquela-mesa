import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import { deliveryZones, stores } from "./schema";
import {
  createStoreInputSchema,
  storeFeaturesSchema,
  storePaymentMethodsSchema,
  storeRulesSchema,
  storeThemeSchema,
} from "./settings";
import type { ManualStatus } from "./types";

const MAX_FEE_CENTS = 100_000_000;

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  return parsed.data;
}

const storeProfileInputSchema = createStoreInputSchema
  .pick({ name: true, address: true, whatsappPhone: true, logoUrl: true, bannerUrl: true })
  // Fonte opcional: sem ela, o merge com o tema atual mantém a fonte salva.
  .extend({
    theme: storeThemeSchema.pick({ primary: true, secondary: true }).extend({
      font: storeThemeSchema.shape.font.unwrap().optional(),
      panelColors: storeThemeSchema.shape.panelColors.unwrap().optional(),
    }),
  });

export type StoreProfileInput = z.input<typeof storeProfileInputSchema>;

const storeOperationsInputSchema = z
  .object({ features: storeFeaturesSchema, rules: storeRulesSchema, paymentMethods: storePaymentMethodsSchema })
  .refine((ops) => ops.features.delivery || ops.features.pickup || ops.features.dineIn, {
    message: "ative ao menos um tipo de pedido",
    path: ["features"],
  });

export type StoreOperationsInput = z.input<typeof storeOperationsInputSchema>;

const deliveryZonesInputSchema = z
  .array(
    z.object({
      neighborhood: z.string().trim().min(1, "informe o bairro").max(80),
      feeCents: z.number().int().nonnegative("taxa inválida").max(MAX_FEE_CENTS, "taxa inválida"),
    }),
  )
  .max(200)
  .superRefine((zones, ctx) => {
    const seen = new Set<string>();
    zones.forEach((zone, index) => {
      const key = zone.neighborhood.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: "bairro repetido", path: [index, "neighborhood"] });
      seen.add(key);
    });
  });

export type DeliveryZoneInput = z.input<typeof deliveryZonesInputSchema>[number];
export type DeliveryZone = { id: string; neighborhood: string; feeCents: number };

async function updateStore(storeId: string, values: Partial<typeof stores.$inferInsert>): Promise<void> {
  const updated = await db
    .update(stores)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(stores.id, storeId))
    .returning({ id: stores.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND");
}

export async function updateStoreProfile(storeId: string, input: StoreProfileInput): Promise<void> {
  const { theme, ...profile } = parse(storeProfileInputSchema, input);
  const [current] = await db.select({ theme: stores.theme }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!current) throw new DomainError("NOT_FOUND");
  await updateStore(storeId, { ...profile, theme: storeThemeSchema.parse({ ...current.theme, ...theme }) });
}

export async function setManualStatus(storeId: string, status: ManualStatus): Promise<void> {
  const manualStatus = parse(z.enum(["auto", "force_open", "force_closed"]), status);
  await updateStore(storeId, { manualStatus });
}

export async function updateStoreOperations(storeId: string, input: StoreOperationsInput): Promise<void> {
  const operations = parse(storeOperationsInputSchema, input);
  await updateStore(storeId, operations);
}

export async function replaceDeliveryZones(storeId: string, zones: DeliveryZoneInput[]): Promise<void> {
  const parsed = deliveryZonesInputSchema.safeParse(zones);
  if (!parsed.success) {
    const error = zodIssuesToDomainError(parsed.error);
    // Prefixa o caminho com "zones." para casar com os campos do formulário.
    const issues = (error.details.issues as { path: string; message: string }[]).map((issue) => ({
      ...issue,
      path: issue.path ? `zones.${issue.path}` : "zones",
    }));
    throw new DomainError("VALIDATION", { issues });
  }

  await db.transaction(async (tx) => {
    const [store] = await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) throw new DomainError("NOT_FOUND");
    await tx.delete(deliveryZones).where(eq(deliveryZones.storeId, storeId));
    if (parsed.data.length > 0) {
      await tx.insert(deliveryZones).values(parsed.data.map((zone, position) => ({ storeId, ...zone, position })));
    }
  });
}

export async function getDeliveryZones(storeId: string): Promise<DeliveryZone[]> {
  return db
    .select({ id: deliveryZones.id, neighborhood: deliveryZones.neighborhood, feeCents: deliveryZones.feeCents })
    .from(deliveryZones)
    .where(eq(deliveryZones.storeId, storeId))
    .orderBy(asc(deliveryZones.position));
}
