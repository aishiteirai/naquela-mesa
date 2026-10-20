"use server";

import { updateTag } from "next/cache";
import {
  createCategory,
  createProduct,
  createSize,
  deleteSize,
  moveCategory,
  moveProduct,
  moveSize,
  updateCategory,
  updateProduct,
  updateSize,
  type MoveDirection,
  type ProductInput,
} from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function direction(form: FormData): MoveDirection {
  return form.get("direction") === "down" ? "down" : "up";
}

function maxFlavors(form: FormData): 1 | 2 {
  return form.get("maxFlavors") === "2" ? 2 : 1;
}

async function mutate(work: (storeId: string) => Promise<unknown>, message: string): Promise<ActionState> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    return actionError(error);
  }
  updateTag(storeMenuTag(store.slug));
  return success(message);
}

export async function createCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => createCategory(storeId, { name: text(form, "name") }), "Categoria criada.");
}

export async function updateCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) =>
      updateCategory(storeId, text(form, "categoryId"), { name: text(form, "name"), active: form.get("active") === "on" }),
    "Categoria salva.",
  );
}

export async function moveCategoryAction(form: FormData): Promise<ActionState> {
  return mutate((storeId) => moveCategory(storeId, text(form, "categoryId"), direction(form)), "Ordem salva.");
}

export async function createSizeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) => createSize(storeId, text(form, "categoryId"), { name: text(form, "name"), maxFlavors: maxFlavors(form) }),
    "Tamanho criado.",
  );
}

export async function updateSizeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) => updateSize(storeId, text(form, "sizeId"), { name: text(form, "name"), maxFlavors: maxFlavors(form) }),
    "Tamanho salvo.",
  );
}

export async function moveSizeAction(form: FormData): Promise<ActionState> {
  return mutate((storeId) => moveSize(storeId, text(form, "sizeId"), direction(form)), "Ordem salva.");
}

export async function deleteSizeAction(form: FormData): Promise<ActionState> {
  return mutate((storeId) => deleteSize(storeId, text(form, "sizeId")), "Tamanho removido.");
}

export async function moveProductAction(form: FormData): Promise<ActionState> {
  return mutate((storeId) => moveProduct(storeId, text(form, "productId"), direction(form)), "Ordem salva.");
}

const PRICE_PREFIX = "price:";

function readProductForm(form: FormData): { input: ProductInput } | { error: ActionState } {
  let priceCents: number | null = null;
  const sizePrices: ProductInput["sizePrices"] = [];

  if (form.get("hasSizes") === "1") {
    for (const [key, value] of form.entries()) {
      if (!key.startsWith(PRICE_PREFIX) || String(value).trim() === "") continue;
      const cents = parseBRLToCents(String(value));
      if (cents === null) return { error: fieldError(key, "preço inválido (use 34,90)") };
      sizePrices.push({ sizeId: key.slice(PRICE_PREFIX.length), priceCents: cents });
    }
  } else if (text(form, "price") !== "") {
    priceCents = parseBRLToCents(text(form, "price"));
    if (priceCents === null) return { error: fieldError("priceCents", "preço inválido (use 34,90)") };
  }

  return {
    input: {
      categoryId: text(form, "categoryId"),
      name: text(form, "name"),
      description: text(form, "description") || null,
      imageUrl: text(form, "imageUrl") || null,
      priceCents,
      sizePrices,
      allowsHalf: form.get("allowsHalf") === "on",
      active: form.get("active") === "on",
      optionGroupIds: form.getAll("optionGroupIds").map(String),
    },
  };
}

export async function saveProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const parsed = readProductForm(form);
  if ("error" in parsed) return parsed.error;

  // Sem redirect: o painel lateral fecha sozinho ao receber o sucesso.
  const productId = text(form, "productId");
  return mutate(
    (storeId) => (productId ? updateProduct(storeId, productId, parsed.input) : createProduct(storeId, parsed.input)),
    "Produto salvo.",
  );
}
