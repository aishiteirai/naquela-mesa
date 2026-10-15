"use server";

import { updateTag } from "next/cache";
import {
  replaceDeliveryZones,
  replaceStoreHours,
  setManualStatus,
  storeMenuTag,
  updateStoreOperations,
  updateStoreProfile,
  type ManualStatus,
} from "@/modules/stores";
import { parseBRLToCents } from "@/shared/money";
import { actionError, fieldError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function checked(form: FormData, key: string): boolean {
  return form.get(key) === "on";
}

function minutes(form: FormData, key: string): number {
  return Number.parseInt(text(form, key), 10);
}

function readJson(form: FormData, key: string): unknown {
  try {
    return JSON.parse(text(form, key) || "[]");
  } catch {
    return null;
  }
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

export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return mutate(
    (storeId) =>
      updateStoreProfile(storeId, {
        name: text(form, "name"),
        address: text(form, "address") || null,
        whatsappPhone: text(form, "whatsappPhone"),
        theme: { primary: text(form, "primary"), secondary: text(form, "secondary") },
        logoUrl: text(form, "logoUrl") || null,
        bannerUrl: text(form, "bannerUrl") || null,
      }),
    "Aparência salva.",
  );
}

const MANUAL_STATUSES: ManualStatus[] = ["auto", "force_open", "force_closed"];

export async function setManualStatusAction(form: FormData): Promise<void> {
  const status = MANUAL_STATUSES.find((value) => value === form.get("status"));
  if (!status) return;
  await mutate((storeId) => setManualStatus(storeId, status), "");
}

export async function saveHoursAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const hours = readJson(form, "hours");
  if (!Array.isArray(hours)) return fieldError("hours", "horários inválidos");
  if (!hours.every((row) => typeof row === "object" && row !== null)) return fieldError("hours", "horários inválidos");
  return mutate((storeId) => replaceStoreHours(storeId, hours), "Horários salvos.");
}

export async function saveOperationsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const minOrderCents = parseBRLToCents(text(form, "minOrder") || "0");
  if (minOrderCents === null) return fieldError("rules.minOrderCents", "valor inválido (use 30,00)");

  const strategy = form.get("deliveryFeeStrategy") === "by_neighborhood" ? "by_neighborhood" : "fixed";
  let deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" } = { strategy: "by_neighborhood" };
  if (strategy === "fixed") {
    const fixedCents = parseBRLToCents(text(form, "fixedFee") || "0");
    if (fixedCents === null) return fieldError("rules.deliveryFee.fixedCents", "valor inválido (use 6,00)");
    deliveryFee = { strategy: "fixed", fixedCents };
  }

  return mutate(
    (storeId) =>
      updateStoreOperations(storeId, {
        features: {
          delivery: checked(form, "delivery"),
          pickup: checked(form, "pickup"),
          dineIn: checked(form, "dineIn"),
          halfAndHalf: checked(form, "halfAndHalf"),
          addons: checked(form, "addons"),
        },
        rules: {
          minOrderCents,
          prepTimeMin: minutes(form, "prepTimeMin"),
          deliveryTimeMin: minutes(form, "deliveryTimeMin"),
          halfPriceRule: form.get("halfPriceRule") === "average" ? "average" : "highest",
          autoPrintOnAccept: checked(form, "autoPrintOnAccept"),
          deliveryFee,
        },
        paymentMethods: {
          cash: checked(form, "cash"),
          cardOnDelivery: checked(form, "cardOnDelivery"),
          pixKey: text(form, "pixKey") || null,
        },
      }),
    "Operação salva.",
  );
}

export async function saveZonesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const rows = readJson(form, "zones");
  if (!Array.isArray(rows)) return fieldError("zones", "bairros inválidos");

  const zones: { neighborhood: string; feeCents: number }[] = [];
  for (const [index, row] of rows.entries()) {
    if (typeof row !== "object" || row === null) return fieldError("zones", "bairros inválidos");
    const fee = parseBRLToCents(String((row as { fee?: unknown }).fee ?? ""));
    if (fee === null) return fieldError(`zones.${index}.feeCents`, `taxa inválida no bairro ${index + 1} (use 5,00)`);
    zones.push({ neighborhood: String((row as { neighborhood?: unknown }).neighborhood ?? ""), feeCents: fee });
  }
  return mutate((storeId) => replaceDeliveryZones(storeId, zones), "Bairros salvos.");
}
