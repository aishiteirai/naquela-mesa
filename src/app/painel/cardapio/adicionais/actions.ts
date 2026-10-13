"use server";

import { updateTag } from "next/cache";
import { addOption, createOptionGroup, updateOption, updateOptionGroup } from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function integer(form: FormData, key: string): number {
  const value = Number(text(form, key));
  return Number.isInteger(value) ? value : Number.NaN;
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

function groupInput(form: FormData) {
  return { name: text(form, "name"), minSelect: integer(form, "minSelect"), maxSelect: integer(form, "maxSelect") };
}

export async function createOptionGroupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => createOptionGroup(storeId, groupInput(form)), "Grupo criado.");
}

export async function updateOptionGroupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate((storeId) => updateOptionGroup(storeId, text(form, "groupId"), groupInput(form)), "Grupo salvo.");
}

export async function addOptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const priceCents = parseBRLToCents(text(form, "price") || "0");
  if (priceCents === null) return fieldError("priceCents", "preço inválido (use 8,00)");
  return mutate(
    (storeId) => addOption(storeId, text(form, "groupId"), { name: text(form, "name"), priceCents, available: true }),
    "Opção adicionada.",
  );
}

export async function updateOptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const priceCents = parseBRLToCents(text(form, "price") || "0");
  if (priceCents === null) return fieldError("priceCents", "preço inválido (use 8,00)");
  return mutate(
    (storeId) =>
      updateOption(storeId, text(form, "optionId"), {
        name: text(form, "name"),
        priceCents,
        available: form.get("available") === "on",
      }),
    "Opção salva.",
  );
}
