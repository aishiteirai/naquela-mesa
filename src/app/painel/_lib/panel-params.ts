import type { EditorCategory } from "@/modules/catalog";

export type PanelParams = {
  /** Categoria selecionada (null só quando não há categorias). */
  categoryId: string | null;
  /** Produto aberto no painel lateral. */
  productId: string | null;
  /** Categoria do produto novo aberto no painel lateral. */
  newInCategoryId: string | null;
};

type RawParams = { categoria: string | null; produto: string | null; novo: string | null };

/**
 * Valida os parâmetros do cardápio do painel contra o catálogo carregado; valores inválidos são ignorados.
 * Produto aberto seleciona a categoria dele (mesmo que `categoria` aponte outra) e vence `novo`.
 */
export function parsePanelParams(raw: RawParams, categories: EditorCategory[]): PanelParams {
  const product = raw.produto ? categories.flatMap((category) => category.products).find((item) => item.id === raw.produto) : undefined;
  if (product) return { categoryId: product.categoryId, productId: product.id, newInCategoryId: null };

  const newIn = categories.find((category) => category.id === raw.novo);
  if (newIn) return { categoryId: newIn.id, productId: null, newInCategoryId: newIn.id };

  const selected = categories.find((category) => category.id === raw.categoria) ?? categories[0];
  return { categoryId: selected?.id ?? null, productId: null, newInCategoryId: null };
}
