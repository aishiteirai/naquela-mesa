import { z } from "zod";

const cents = z.number().int().nonnegative();
const key = z.string().regex(/^[a-z0-9_-]+$/, "chave deve ter só letras minúsculas, números, '_' e '-'");
const name = z.string().trim().min(1);

const optionGroupSchema = z
  .object({
    key,
    name,
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(1),
    options: z.array(z.object({ name, priceCents: cents, available: z.boolean().default(true) })).min(1),
  })
  .refine((group) => group.minSelect <= group.maxSelect, {
    message: "minSelect não pode ser maior que maxSelect",
    path: ["minSelect"],
  });

const productSchema = z.object({
  name,
  description: name.optional(),
  imageUrl: z.url().optional(),
  priceCents: cents.optional(),
  sizePrices: z.record(key, cents).optional(),
  allowsHalf: z.boolean().default(false),
  available: z.boolean().default(true),
  optionGroupKeys: z.array(key).default([]),
});

const categorySchema = z.object({
  name,
  sizes: z.array(z.object({ key, name, maxFlavors: z.union([z.literal(1), z.literal(2)]) })).default([]),
  products: z.array(productSchema),
});

export const catalogDefinitionSchema = z
  .object({
    optionGroups: z.array(optionGroupSchema).default([]),
    categories: z.array(categorySchema),
  })
  .superRefine((definition, ctx) => {
    const groupKeys = new Set(definition.optionGroups.map((group) => group.key));
    if (groupKeys.size !== definition.optionGroups.length) {
      ctx.addIssue({ code: "custom", message: "chave de grupo de adicionais repetida", path: ["optionGroups"] });
    }

    definition.categories.forEach((category, categoryIndex) => {
      const sizeKeys = category.sizes.map((size) => size.key);
      if (new Set(sizeKeys).size !== sizeKeys.length) {
        ctx.addIssue({ code: "custom", message: "chave de tamanho repetida", path: ["categories", categoryIndex, "sizes"] });
      }

      category.products.forEach((product, productIndex) => {
        const path = ["categories", categoryIndex, "products", productIndex];

        if (sizeKeys.length > 0) {
          const pricedKeys = Object.keys(product.sizePrices ?? {});
          const pricesMatchSizes =
            product.priceCents === undefined &&
            pricedKeys.length === sizeKeys.length &&
            sizeKeys.every((sizeKey) => pricedKeys.includes(sizeKey));
          if (!pricesMatchSizes) {
            ctx.addIssue({
              code: "custom",
              message: "produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)",
              path,
            });
          }
        } else if (product.priceCents === undefined || product.sizePrices !== undefined) {
          ctx.addIssue({ code: "custom", message: "produto sem tamanhos precisa de priceCents", path });
        }

        if (product.allowsHalf && !category.sizes.some((size) => size.maxFlavors === 2)) {
          ctx.addIssue({ code: "custom", message: "meio a meio exige um tamanho com até 2 sabores", path });
        }

        for (const groupKey of product.optionGroupKeys) {
          if (!groupKeys.has(groupKey)) {
            ctx.addIssue({ code: "custom", message: `grupo de adicionais desconhecido: ${groupKey}`, path });
          }
        }
      });
    });
  });

export type CatalogDefinition = z.input<typeof catalogDefinitionSchema>;
