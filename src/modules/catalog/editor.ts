import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { zodIssuesToDomainError } from "@/shared/validation";
import type { CatalogEditorView } from "./editor-types";
import { swapOrder, type MoveDirection } from "./ordering";
import { categories, categorySizes } from "./schema";
import { readCatalog } from "./service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const nameSchema = z.string().trim().min(1, "informe o nome").max(80, "nome muito longo");
const categoryInputSchema = z.object({ name: nameSchema, active: z.boolean().default(true) });
const sizeInputSchema = z.object({ name: nameSchema, maxFlavors: z.union([z.literal(1), z.literal(2)]) });

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  return parsed.data;
}

function notFound(): DomainError {
  return new DomainError("NOT_FOUND");
}

export function getCatalogForEditing(storeId: string): Promise<CatalogEditorView> {
  return readCatalog(storeId, { includeInactive: true });
}

/** Garante que a categoria é da loja; lança NOT_FOUND caso contrário. */
export async function assertCategoryInStore(storeId: string, categoryId: string, tx: Tx | typeof db = db): Promise<void> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
}

export async function createCategory(storeId: string, input: { name: string }): Promise<{ id: string }> {
  const { name } = parseInput(categoryInputSchema, input);
  const [last] = await db.select({ position: max(categories.position) }).from(categories).where(eq(categories.storeId, storeId));
  const [row] = await db
    .insert(categories)
    .values({ storeId, name, position: (last?.position ?? -1) + 1 })
    .returning({ id: categories.id });
  return { id: row!.id };
}

export async function updateCategory(storeId: string, categoryId: string, input: { name: string; active: boolean }): Promise<void> {
  const data = parseInput(categoryInputSchema, input);
  const updated = await db
    .update(categories)
    .set(data)
    .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
    .returning({ id: categories.id });
  if (updated.length === 0) throw notFound();
}

export async function moveCategory(storeId: string, categoryId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(asc(categories.position), asc(categories.name));
    const ids = rows.map((row) => row.id);
    if (!ids.includes(categoryId)) throw notFound();

    const next = swapOrder(ids, categoryId, direction);
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx.update(categories).set({ position }).where(eq(categories.id, id));
    }
  });
}

async function findSize(storeId: string, sizeId: string, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ id: categorySizes.id, categoryId: categorySizes.categoryId })
    .from(categorySizes)
    .where(and(eq(categorySizes.id, sizeId), eq(categorySizes.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function createSize(
  storeId: string,
  categoryId: string,
  input: { name: string; maxFlavors: 1 | 2 },
): Promise<{ id: string }> {
  const data = parseInput(sizeInputSchema, input);
  await assertCategoryInStore(storeId, categoryId);
  const [last] = await db
    .select({ position: max(categorySizes.position) })
    .from(categorySizes)
    .where(eq(categorySizes.categoryId, categoryId));
  const [row] = await db
    .insert(categorySizes)
    .values({ storeId, categoryId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: categorySizes.id });
  return { id: row!.id };
}

export async function updateSize(storeId: string, sizeId: string, input: { name: string; maxFlavors: 1 | 2 }): Promise<void> {
  const data = parseInput(sizeInputSchema, input);
  await findSize(storeId, sizeId);
  await db.update(categorySizes).set(data).where(eq(categorySizes.id, sizeId));
}

export async function moveSize(storeId: string, sizeId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const size = await findSize(storeId, sizeId, tx);
    const rows = await tx
      .select({ id: categorySizes.id })
      .from(categorySizes)
      .where(eq(categorySizes.categoryId, size.categoryId))
      .orderBy(asc(categorySizes.position), asc(categorySizes.name));
    const next = swapOrder(
      rows.map((row) => row.id),
      sizeId,
      direction,
    );
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx.update(categorySizes).set({ position }).where(eq(categorySizes.id, id));
    }
  });
}

export async function deleteSize(storeId: string, sizeId: string): Promise<void> {
  await findSize(storeId, sizeId);
  await db.delete(categorySizes).where(eq(categorySizes.id, sizeId));
}
