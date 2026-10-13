"use client";

import { uuid } from "@/shared/uuid";
import Link from "next/link";
import { type FocusEvent, type FormEvent, type InputHTMLAttributes, useRef, useState, useTransition } from "react";
import type { Fulfillment, PaymentMethod } from "@/modules/orders/client";
import type { OrderQuote } from "@/modules/orders";
import { formatBRL, parseBRLToCents } from "@/shared/money";
import { useCart } from "@/app/[slug]/_components/cart-context";
import type { CheckoutError } from "@/app/[slug]/sacola/messages";
import { placeOrderAction, quoteOrderAction } from "@/app/[slug]/sacola/actions";

export type CheckoutStore = {
  slug: string;
  features: { delivery: boolean; pickup: boolean; dineIn: boolean };
  paymentMethods: { cash: boolean; cardOnDelivery: boolean; pixKey: string | null };
  deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" };
  zones: { neighborhood: string; feeCents: number }[];
};

type Placed = { numberLabel: string; trackingPath: string; whatsappUrl: string };

const input = "rounded border border-neutral-300 bg-background px-3 py-2 dark:border-neutral-700";

function FieldError({ error, name }: { error: CheckoutError | null; name: string }) {
  const message = error?.fieldErrors[name];
  return message ? <p className="text-sm text-red-700 dark:text-red-400">{message}</p> : null;
}

function Field({ label, name, error, ...props }: { label: string; name: string; error: CheckoutError | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <input name={name} className={input} {...props} />
      </label>
      <FieldError error={error} name={name} />
    </div>
  );
}

export function Checkout({ store }: { store: CheckoutStore }) {
  const cart = useCart();
  const fulfillments = (
    [
      ["delivery", "Delivery", store.features.delivery],
      ["pickup", "Retirada no balcão", store.features.pickup],
      ["dine_in", "Consumo no local", store.features.dineIn],
    ] as const
  ).filter(([, , enabled]) => enabled);
  const payments = (
    [
      ["cash", "Dinheiro", store.paymentMethods.cash],
      ["card_on_delivery", "Cartão na entrega", store.paymentMethods.cardOnDelivery],
      ["pix", "Pix", store.paymentMethods.pixKey !== null],
    ] as const
  ).filter(([, , enabled]) => enabled);

  const [fulfillment, setFulfillment] = useState<Fulfillment>(fulfillments[0]?.[0] ?? "pickup");
  const [payment, setPayment] = useState<PaymentMethod>(payments[0]?.[0] ?? "cash");
  const [idempotencyKey] = useState(() => uuid());
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (placed) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">Pedido {placed.numberLabel} recebido!</h2>
        <p>Envie o pedido para a loja pelo WhatsApp para agilizar o atendimento.</p>
        <a
          href={placed.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded bg-green-700 px-4 py-3 text-center font-semibold text-white"
        >
          Enviar pedido no WhatsApp
        </a>
        <Link href={placed.trackingPath} className="text-center underline">
          Acompanhar pedido
        </Link>
      </section>
    );
  }

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p>Sua sacola está vazia.</p>
        <Link href={`/${store.slug}`} className="underline">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  function buildPayload(expectedTotalCents: number | null): { payload: Record<string, unknown> } | { error: CheckoutError } {
    const form = new FormData(formRef.current!);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const changeRaw = payment === "cash" ? text("changeFor") : "";
    const changeForCents = changeRaw ? parseBRLToCents(changeRaw) : null;
    if (changeRaw && changeForCents === null) {
      return { error: { code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors: { "payment.changeForCents": "valor inválido (use 100,00)" } } };
    }
    return {
      payload: {
        idempotencyKey,
        items: cart.lines.map((line) => line.input),
        fulfillment,
        customer: { name: text("name"), phone: text("phone") },
        address:
          fulfillment === "delivery"
            ? {
                street: text("street"),
                number: text("number"),
                complement: text("complement") || null,
                neighborhood: text("neighborhood"),
                city: text("city") || null,
                zipCode: text("zipCode") || null,
                reference: text("reference") || null,
              }
            : null,
        tableLabel: fulfillment === "dine_in" ? text("tableLabel") || null : null,
        payment: { method: payment, changeForCents },
        notes: text("notes") || null,
        expectedTotalCents,
        website: text("website"),
      },
    };
  }

  function review() {
    const built = buildPayload(null);
    if ("error" in built) return setError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await quoteOrderAction(store.slug, built.payload);
      if (result.ok) setQuote(result.quote);
      else {
        setQuote(null);
        setError(result.error);
      }
    });
  }

  function confirm() {
    if (!quote) return;
    const built = buildPayload(quote.totalCents);
    if ("error" in built) return setError(built.error);
    startTransition(async () => {
      setError(null);
      const result = await placeOrderAction(store.slug, built.payload);
      if (result.ok) {
        cart.clear();
        setPlaced(result.placed);
      } else {
        setError(result.error);
        setQuote(result.error.quote ?? null);
      }
    });
  }

  async function fillFromZipCode(event: FocusEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    if (digits.length !== 8 || !formRef.current) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as { logradouro?: string; bairro?: string; localidade?: string; erro?: boolean };
      if (data.erro) return;
      const elements = formRef.current.elements;
      const fill = (name: string, value?: string) => {
        const field = elements.namedItem(name);
        if (value && field instanceof HTMLInputElement && !field.value) field.value = value;
      };
      fill("street", data.logradouro);
      fill("neighborhood", data.bairro);
      fill("city", data.localidade);
    } catch {
      // CEP é só conveniência; o cliente pode digitar o endereço.
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event: FormEvent) => event.preventDefault()}
      onChange={() => setQuote(null)}
      className="flex flex-col gap-6"
    >
      <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {cart.lines.map((line) => (
          <li key={line.key} className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex-1 font-medium">{line.label}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Diminuir ${line.label}`} onClick={() => { setQuote(null); cart.setQuantity(line.key, line.input.quantity - 1); }} className="rounded border px-2">
                −
              </button>
              <span>{line.input.quantity}</span>
              <button type="button" aria-label={`Aumentar ${line.label}`} onClick={() => { setQuote(null); cart.setQuantity(line.key, line.input.quantity + 1); }} className="rounded border px-2">
                +
              </button>
            </div>
            <span>{formatBRL(line.unitPriceCents * line.input.quantity)}</span>
            <button type="button" aria-label={`Remover ${line.label}`} onClick={() => { setQuote(null); cart.remove(line.key); }} className="text-sm underline">
              Remover
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Como você quer receber?</legend>
        {fulfillments.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="fulfillment" checked={fulfillment === value} onChange={() => setFulfillment(value)} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-3">
        <Field label="Seu nome" name="name" error={error} autoComplete="name" required />
        <FieldError error={error} name="customer.name" />
        <Field label="WhatsApp (com DDD)" name="phone" error={error} autoComplete="tel" inputMode="tel" required />
        <FieldError error={error} name="customer.phone" />
      </div>

      {fulfillment === "delivery" && (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium">Endereço de entrega</legend>
          <Field label="CEP" name="zipCode" error={error} inputMode="numeric" onBlur={fillFromZipCode} />
          <FieldError error={error} name="address.zipCode" />
          <Field label="Rua" name="street" error={error} />
          <FieldError error={error} name="address.street" />
          <Field label="Número" name="number" error={error} />
          <FieldError error={error} name="address.number" />
          <Field label="Complemento" name="complement" error={error} />
          {store.deliveryFee.strategy === "by_neighborhood" ? (
            <label className="flex flex-col gap-1 text-sm">
              Bairro
              <select name="neighborhood" className={input} defaultValue="">
                <option value="" disabled>
                  Escolha o bairro
                </option>
                {store.zones.map((zone) => (
                  <option key={zone.neighborhood} value={zone.neighborhood}>
                    {`${zone.neighborhood} — ${formatBRL(zone.feeCents)}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Field label="Bairro" name="neighborhood" error={error} />
          )}
          <FieldError error={error} name="address.neighborhood" />
          <FieldError error={error} name="address" />
          <Field label="Cidade" name="city" error={error} />
          <Field label="Ponto de referência" name="reference" error={error} />
        </fieldset>
      )}

      {fulfillment === "dine_in" && (
        <div className="flex flex-col gap-1">
          <Field label="Mesa" name="tableLabel" error={error} />
          <FieldError error={error} name="tableLabel" />
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Pagamento</legend>
        {payments.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="payment" checked={payment === value} onChange={() => setPayment(value)} />
            {label}
          </label>
        ))}
        {payment === "pix" && store.paymentMethods.pixKey && (
          <p className="text-sm">Chave Pix: {store.paymentMethods.pixKey}</p>
        )}
        {payment === "cash" && (
          <>
            <Field label="Troco para (deixe vazio se não precisa)" name="changeFor" error={error} inputMode="decimal" />
            <FieldError error={error} name="payment.changeForCents" />
          </>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Observações do pedido
        <textarea name="notes" maxLength={300} rows={2} className={input} />
      </label>

      {/* Honeypot: invisível para pessoas, bots costumam preencher. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Site
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p data-testid="checkout-error" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error.message}
        </p>
      )}

      {quote && (
        <dl className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <dt>Subtotal</dt>
          <dd className="text-right">{formatBRL(quote.subtotalCents)}</dd>
          <dt>Entrega</dt>
          <dd className="text-right">{formatBRL(quote.deliveryFeeCents)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd data-testid="quote-total" className="text-right font-semibold">
            {formatBRL(quote.totalCents)}
          </dd>
        </dl>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={review} disabled={pending || !cart.ready} className="rounded border border-neutral-400 px-4 py-3 font-semibold disabled:opacity-50">
          Revisar pedido
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || !quote}
          className="rounded bg-(--brand-primary) px-4 py-3 font-semibold text-(--brand-primary-foreground) disabled:opacity-50"
        >
          Confirmar pedido
        </button>
      </div>
    </form>
  );
}
