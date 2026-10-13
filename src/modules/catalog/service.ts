import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { zodIssuesToDomainError } from "@/shared/validation";
import { catalogDefinitionSchema, type CatalogDefinition } from "./definition";
import type { CatalogEditorView, EditorCategory } from "./editor-types";
import type { Menu } from "./menu";
import { categories, categorySizes, optionGroups, options, productOptionGroups, products, productSizePrices } from "./schema";

export async function importCatalog(storeId: string, definition: CatalogDefinition): Promise<void> {
  const parsed = catalogDefinitionSchema.safeParse(definition);
  if (!parsed.success) throw zodIssuesToDomainError(parsed.error);
  const catalog = parsed.data;

  await db.transaction(async (tx) => {
    const groupIds = new Map<string, string>();
    for (const [groupPosition, group] of catalog.optionGroups.entries()) {
      const [groupRow] = await tx
        .insert(optionGroups)
        .values({ storeId, name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, position: groupPosition })
        .returning({ id: optionGroups.id });
      groupIds.set(group.key, groupRow!.id);
      await tx.insert(options).values(
        group.options.map((option, position) => ({
          storeId,
          groupId: groupRow!.id,
          name: option.name,
          priceCents: option.priceCents,
          available: option.available,
          position,
        })),
      );
    }

    for (const [categoryPosition, category] of catalog.categories.entries()) {
      const [categoryRow] = await tx
        .insert(categories)
        .values({ storeId, name: category.name, position: categoryPosition })
        .returning({ id: categories.id });
      const categoryId = categoryRow!.id;

      const sizeIds = new Map<string, string>();
      for (const [sizePosition, size] of category.sizes.entries()) {
        const [sizeRow] = await tx
          .insert(categorySizes)
          .values({ storeId, categoryId, name: size.name, maxFlavors: size.maxFlavors, position: sizePosition })
          .returning({ id: categorySizes.id });
        sizeIds.set(size.key, sizeRow!.id);
      }

      for (const [productPosition, product] of category.products.entries()) {
        const [productRow] = await tx
          .insert(products)
          .values({
            storeId,
            categoryId,
            name: product.name,
            description: product.description ?? null,
            imageUrl: product.imageUrl ?? null,
            priceCents: product.priceCents ?? null,
            allowsHalf: product.allowsHalf,
            available: product.available,
            position: productPosition,
          })
          .returning({ id: products.id });
        const productId = productRow!.id;

        const prices = Object.entries(product.sizePrices ?? {}).map(([sizeKey, priceCents]) => ({
          productId,
          categorySizeId: sizeIds.get(sizeKey)!,
          priceCents,
        }));
        if (prices.length > 0) await tx.insert(productSizePrices).values(prices);

        const links = product.optionGroupKeys.map((groupKey, position) => ({
          productId,
          groupId: groupIds.get(groupKey)!,
          position,
        }));
        if (links.length > 0) await tx.insert(productOptionGroups).values(links);
      }
    }
  });
}

export async function readCatalog(storeId: string, scope: { includeInactive: boolean }): Promise<CatalogEditorView> {
  const onlyActive = (condition: SQL, active: SQL): SQL | undefined =>
    scope.includeInactive ? condition : and(condition, active);

  const [categoryRows, sizeRows, productRows, priceRows, groupRows, optionRows, linkRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(onlyActive(eq(categories.storeId, storeId), eq(categories.active, true)))
      .orderBy(asc(categories.position), asc(categories.name)),
    db.select().from(categorySizes).where(eq(categorySizes.storeId, storeId)).orderBy(asc(categorySizes.position), asc(categorySizes.name)),
    db
      .select()
      .from(products)
      .where(onlyActive(eq(products.storeId, storeId), eq(products.active, true)))
      .orderBy(asc(products.position), asc(products.name)),
    db
      .select({
        productId: productSizePrices.productId,
        sizeId: productSizePrices.categorySizeId,
        priceCents: productSizePrices.priceCents,
      })
      .from(productSizePrices)
      .innerJoin(products, eq(products.id, productSizePrices.productId))
      .where(eq(products.storeId, storeId)),
    db.select().from(optionGroups).where(eq(optionGroups.storeId, storeId)).orderBy(asc(optionGroups.position), asc(optionGroups.name)),
    db.select().from(options).where(eq(options.storeId, storeId)).orderBy(asc(options.position), asc(options.name)),
    db
      .select({ productId: productOptionGroups.productId, groupId: productOptionGroups.groupId })
      .from(productOptionGroups)
      .innerJoin(products, eq(products.id, productOptionGroups.productId))
      .where(eq(products.storeId, storeId))
      .orderBy(asc(productOptionGroups.position)),
  ]);

  const sizeOrder = new Map(sizeRows.map((size) => [size.id, size.position]));

  const editorCategories: EditorCategory[] = categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    sizes: sizeRows
      .filter((size) => size.categoryId === category.id)
      .map((size) => ({ id: size.id, name: size.name, maxFlavors: size.maxFlavors })),
    products: productRows
      .filter((product) => product.categoryId === category.id)
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        sizePrices: priceRows
          .filter((price) => price.productId === product.id)
          .sort((a, b) => (sizeOrder.get(a.sizeId) ?? 0) - (sizeOrder.get(b.sizeId) ?? 0))
          .map((price) => ({ sizeId: price.sizeId, priceCents: price.priceCents })),
        allowsHalf: product.allowsHalf,
        active: product.active,
        available: product.available,
        optionGroupIds: linkRows.filter((link) => link.productId === product.id).map((link) => link.groupId),
      })),
  }));

  const optionGroupsView = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: optionRows
      .filter((option) => option.groupId === group.id)
      .map((option) => ({ id: option.id, name: option.name, priceCents: option.priceCents, available: option.available })),
  }));

  return { categories: editorCategories, optionGroups: optionGroupsView };
}

export async function getMenu(storeId: string): Promise<Menu> {
  const catalog = await readCatalog(storeId, { includeInactive: false });
  return {
    categories: catalog.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        sizes: category.sizes,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          priceCents: product.priceCents,
          sizePrices: product.sizePrices,
          allowsHalf: product.allowsHalf,
          available: product.available,
          optionGroupIds: product.optionGroupIds,
        })),
      }))
      .filter((category) => category.products.length > 0),
    optionGroups: catalog.optionGroups,
  };
}
