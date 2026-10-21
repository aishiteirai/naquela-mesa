"use client";

import { type Ref, useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderQuote } from "@/modules/orders";
import type { Fulfillment, PaymentMethod } from "@/modules/orders/client";
import { formatBRL } from "@/shared/money";
import { ChoiceCards, TextField } from "./text-field";

export function PaymentStep({
  hidden,
  payments,
  payment,
  fulfillment,
  onPaymentChange,
  pixKey,
  quote,
  fieldError,
  ref,
}: {
  hidden: boolean;
  payments: readonly (readonly [PaymentMethod, string])[];
  payment: PaymentMethod;
  fulfillment: Fulfillment;
  onPaymentChange: (value: PaymentMethod) => void;
  pixKey: string | null;
  quote: OrderQuote | null;
  fieldError: (path: string) => string | undefined;
  ref: Ref<HTMLFieldSetElement>;
}) {
  const notesId = useId();

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-4">
      <legend className="mb-2 font-semibold">Forma de pagamento</legend>
      {fulfillment === "pickup" ? (
        <p data-testid="pay-on-pickup" className="rounded-xl border bg-card p-4 text-sm">
          Pagamento na retirada, direto no balcão.
        </p>
      ) : (
        <>
          <ChoiceCards label="Forma de pagamento" value={payment} options={payments} onChange={onPaymentChange} />
          {payment === "pix" && pixKey && <p className="rounded-xl border bg-card p-4 text-sm">Chave Pix: {pixKey}</p>}
          {payment === "cash" && (
            <TextField label="Troco para (deixe vazio se não precisa)" name="changeFor" inputMode="decimal" error={fieldError("payment.changeForCents")} />
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={notesId}>Observações do pedido</Label>
        <Textarea id={notesId} name="notes" maxLength={300} rows={2} />
      </div>
      {quote && (
        <dl className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-4 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatBRL(quote.subtotalCents)}</dd>
          {fulfillment === "delivery" && (
            <>
              <dt className="text-muted-foreground">Entrega</dt>
              <dd className="text-right">{formatBRL(quote.deliveryFeeCents)}</dd>
            </>
          )}
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{formatBRL(quote.totalCents)}</dd>
        </dl>
      )}
    </fieldset>
  );
}
