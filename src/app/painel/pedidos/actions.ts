"use server";

import { z } from "zod";
import { ORDER_STATUSES, transitionOrder, type OrderStatus } from "@/modules/orders";
import { isDomainError } from "@/shared/errors";
import { actionError, success, type ActionState } from "@/app/_lib/action-state";
import { requireStoreAccess } from "@/app/painel/_lib/access";

const STALE: ActionState = { status: "error", message: "Este pedido já foi atualizado em outro aparelho.", fieldErrors: {} };

async function transition(form: FormData, to: OrderStatus, cancelReason?: string): Promise<ActionState> {
  const { user, store } = await requireStoreAccess();
  const orderId = z.uuid().safeParse(form.get("orderId"));
  if (!orderId.success) return STALE;
  try {
    await transitionOrder(store.id, orderId.data, to, { userId: user.id, cancelReason });
  } catch (error) {
    if (isDomainError(error) && error.code === "INVALID_TRANSITION") return STALE;
    return actionError(error);
  }
  return success(to === "cancelled" ? "Pedido cancelado." : "Pedido atualizado.");
}

export async function advanceOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  const to = ORDER_STATUSES.find((status) => status === form.get("to"));
  if (!to || to === "cancelled") return STALE;
  return transition(form, to);
}

export async function cancelOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStoreAccess();
  return transition(form, "cancelled", String(form.get("cancelReason") ?? ""));
}
