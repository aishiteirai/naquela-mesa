"use server";

import { headers } from "next/headers";
import { createOrder, formatOrderNumber, quoteOrder, type OrderQuote } from "@/modules/orders";
import { buildOrderMessage, waMeLink } from "@/modules/whatsapp";
import { appUrl } from "@/shared/env";
import { isDomainError } from "@/shared/errors";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/shared/rate-limit";
import { toCheckoutError, type CheckoutError } from "./messages";

export type QuoteResult = { ok: true; quote: OrderQuote } | { ok: false; error: CheckoutError };
export type PlaceResult =
  | { ok: true; placed: { numberLabel: string; trackingPath: string; whatsappUrl: string } }
  | { ok: false; error: CheckoutError };

const BOT_ERROR: CheckoutError = { code: "VALIDATION", message: "Não foi possível processar o pedido.", fieldErrors: {} };

function filledHoneypot(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const value = (payload as { website?: unknown }).website;
  return typeof value === "string" && value.trim() !== "";
}

function phoneDigits(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const phone = (payload as { customer?: { phone?: unknown } }).customer?.phone;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  return digits.length >= 10 ? digits.slice(-11) : null;
}

export async function quoteOrderAction(slug: string, payload: unknown): Promise<QuoteResult> {
  if (filledHoneypot(payload)) return { ok: false, error: BOT_ERROR };
  try {
    await enforceRateLimit(RATE_LIMITS.quoteByIp, clientIp(await headers()));
    return { ok: true, quote: await quoteOrder(slug, payload) };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, error: toCheckoutError(error) };
    throw error;
  }
}

export async function placeOrderAction(slug: string, payload: unknown): Promise<PlaceResult> {
  if (filledHoneypot(payload)) return { ok: false, error: BOT_ERROR };
  try {
    await enforceRateLimit(RATE_LIMITS.orderByIp, clientIp(await headers()));
    const phone = phoneDigits(payload);
    if (phone) await enforceRateLimit(RATE_LIMITS.orderByPhone, phone);
    const order = await createOrder(slug, payload, "web");
    const trackingPath = `/${order.store.slug}/pedido/${order.publicToken}`;
    const trackingUrl = new URL(trackingPath, appUrl()).toString();
    return {
      ok: true,
      placed: {
        numberLabel: formatOrderNumber(order.number),
        trackingPath,
        whatsappUrl: waMeLink(order.store.whatsappPhone, buildOrderMessage(order, trackingUrl)),
      },
    };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, error: toCheckoutError(error) };
    throw error;
  }
}
