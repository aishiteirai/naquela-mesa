import { and, asc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { imageUrlSchema } from "@/shared/validation";
import { assertCategoryInStore, nameSchema, parseInput } from "./editor";
import { swapOrder, type MoveDirection } from "./ordering";
import { categorySizes, optionGroups, options, productOptionGroups, products, productSizePrices } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const cents = z.number().int("valor inválido").nonnegative("valor inválido");

const productInputSchema = z.object({
  categoryId: z.uuid(),
  name: nameSchema,
  description: z.string().trim().max(300, "descrição muito longa").nullable(),
  imageUrl: imageUrlSchema.nullable(),
  priceCents: cents.nullable(),
  sizePrices: z.array(z.object({ sizeId: z.uuid(), priceCents: cents })),
  allowsHalf: z.boolean(),
  active: z.boolean(),
  optionGroupIds: z.array(z.uuid()),
});

export type ProductInput = z.input<typeof productInputSchema>;

const optionGroupInputSchema = z
  .object({
    name: nameSchema,
    minSelect: z.number().int().min(0, "mínimo inválido"),
    maxSelect: z.number().int().min(1, "máximo deve ser ao menos 1"),
  })
  .refine((group) => group.minSelect <= group.maxSelect, { message: "mínimo maior que máximo", path: ["minSelect"] });

export type OptionGroupInput = z.input<typeof optionGroupInputSchema>;

const optionInputSchema = z.object({ name: nameSchema, priceCents: cents, available: z.boolean() });

export type OptionInput = z.input<typeof optionInputSchema>;

function invalid(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

function notFound(): DomainError {
  return new DomainError("NOT_FOUND");
}

/** Regras que dependem do banco: tamanhos da categoria, meio a meio e grupos da loja. */
async function validateProductRelations(storeId: string, data: z.infer<typeof productInputSchema>, tx: Tx): Promise<void> {
  await assertCategoryInStore(storeId, data.categoryId, tx);

  const sizes = await tx
    .select({ id: categorySizes.id, maxFlavors: categorySizes.maxFlavors })
    .from(categorySizes)
    .where(eq(categorySizes.categoryId, data.categoryId));

  if (sizes.length > 0) {
    const sizeIds = new Set(sizes.map((size) => size.id));
    const pricedIds = data.sizePrices.map((price) => price.sizeId);
    const valid =
      data.priceCents === null &&
      pricedIds.length > 0 &&
      new Set(pricedIds).size === pricedIds.length &&
      pricedIds.every((id) => sizeIds.has(id));
    if (!valid) throw invalid("sizePrices", "informe o preço de ao menos um tamanho desta categoria");
  } else if (data.priceCents === null || data.sizePrices.length > 0) {
    throw invalid("priceCents", "informe o preço");
  }

  if (data.allowsHalf && !sizes.some((size) => size.maxFlavors === 2)) {
    throw invalid("allowsHalf", "meio a meio exige um tamanho com até 2 sabores");
  }

  if (data.optionGroupIds.length > 0) {
    const groups = await tx
      .select({ id: optionGroups.id })
      .from(optionGroups)
      .where(and(eq(optionGroups.storeId, storeId), inArray(optionGroups.id, data.optionGroupIds)));
    if (groups.length !== new Set(data.optionGroupIds).size) throw invalid("optionGroupIds", "grupo de adicionais inválido");
  }
}

async function replaceProductRelations(productId: string, data: z.infer<typeof productInputSchema>, tx: Tx): Promise<void> {
  await tx.delete(productSizePrices).where(eq(productSizePrices.productId, productId));
  await tx.delete(productOptionGroups).where(eq(productOptionGroups.productId, productId));
  if (data.sizePrices.length > 0) {
    await tx
      .insert(productSizePrices)
      .values(data.sizePrices.map((price) => ({ productId, categorySizeId: price.sizeId, priceCents: price.priceCents })));
  }
  if (data.optionGroupIds.length > 0) {
    await tx
      .insert(productOptionGroups)
      .values(data.optionGroupIds.map((groupId, position) => ({ productId, groupId, position })));
  }
}

function productColumns(data: z.infer<typeof productInputSchema>) {
  return {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description || null,
    imageUrl: data.imageUrl,
    priceCents: data.priceCents,
    allowsHalf: data.allowsHalf,
    active: data.active,
  };
}

async function findProduct(storeId: string, productId: string, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ id: products.id, categoryId: products.categoryId })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function createProduct(storeId: string, input: ProductInput): Promise<{ id: string }> {
  const data = parseInput(productInputSchema, input);
  return db.transaction(async (tx) => {
    await validateProductRelations(storeId, data, tx);
    const [last] = await tx
      .select({ position: max(products.position) })
      .from(products)
      .where(eq(products.categoryId, data.categoryId));
    const [row] = await tx
      .insert(products)
      .values({ storeId, ...productColumns(data), position: (last?.position ?? -1) + 1 })
      .returning({ id: products.id });
    await replaceProductRelations(row!.id, data, tx);
    return { id: row!.id };
  });
}

export async function updateProduct(storeId: string, productId: string, input: ProductInput): Promise<void> {
  const data = parseInput(productInputSchema, input);
  await db.transaction(async (tx) => {
    await findProduct(storeId, productId, tx);
    await validateProductRelations(storeId, data, tx);
    await tx
      .update(products)
      .set(productColumns(data))
      .where(and(eq(products.id, productId), eq(products.storeId, storeId)));
    await replaceProductRelations(productId, data, tx);
  });
}

export async function moveProduct(storeId: string, productId: string, direction: MoveDirection): Promise<void> {
  await db.transaction(async (tx) => {
    const product = await findProduct(storeId, productId, tx);
    const rows = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.categoryId, product.categoryId), eq(products.storeId, storeId)))
      .orderBy(asc(products.position), asc(products.name));
    const next = swapOrder(
      rows.map((row) => row.id),
      productId,
      direction,
    );
    if (!next) return;
    for (const [position, id] of next.entries()) {
      await tx
        .update(products)
        .set({ position })
        .where(and(eq(products.id, id), eq(products.storeId, storeId)));
    }
  });
}

export async function setProductAvailability(storeId: string, productId: string, available: boolean): Promise<void> {
  const updated = await db
    .update(products)
    .set({ available })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  if (updated.length === 0) throw notFound();
}

export async function createOptionGroup(storeId: string, input: OptionGroupInput): Promise<{ id: string }> {
  const data = parseInput(optionGroupInputSchema, input);
  const [last] = await db.select({ position: max(optionGroups.position) }).from(optionGroups).where(eq(optionGroups.storeId, storeId));
  const [row] = await db
    .insert(optionGroups)
    .values({ storeId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: optionGroups.id });
  return { id: row!.id };
}

export async function updateOptionGroup(storeId: string, groupId: string, input: OptionGroupInput): Promise<void> {
  const data = parseInput(optionGroupInputSchema, input);
  const updated = await db
    .update(optionGroups)
    .set(data)
    .where(and(eq(optionGroups.id, groupId), eq(optionGroups.storeId, storeId)))
    .returning({ id: optionGroups.id });
  if (updated.length === 0) throw notFound();
}

export async function addOption(storeId: string, groupId: string, input: OptionInput): Promise<{ id: string }> {
  const data = parseInput(optionInputSchema, input);
  const [group] = await db
    .select({ id: optionGroups.id })
    .from(optionGroups)
    .where(and(eq(optionGroups.id, groupId), eq(optionGroups.storeId, storeId)))
    .limit(1);
  if (!group) throw notFound();

  const [last] = await db.select({ position: max(options.position) }).from(options).where(eq(options.groupId, groupId));
  const [row] = await db
    .insert(options)
    .values({ storeId, groupId, ...data, position: (last?.position ?? -1) + 1 })
    .returning({ id: options.id });
  return { id: row!.id };
}

export async function updateOption(storeId: string, optionId: string, input: OptionInput): Promise<void> {
  const data = parseInput(optionInputSchema, input);
  const updated = await db
    .update(options)
    .set(data)
    .where(and(eq(options.id, optionId), eq(options.storeId, storeId)))
    .returning({ id: options.id });
  if (updated.length === 0) throw notFound();
}

export async function setOptionAvailability(storeId: string, optionId: string, available: boolean): Promise<void> {
  const updated = await db
    .update(options)
    .set({ available })
    .where(and(eq(options.id, optionId), eq(options.storeId, storeId)))
    .returning({ id: options.id });
  if (updated.length === 0) throw notFound();
}
