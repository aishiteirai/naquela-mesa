"use client";

import { type FocusEvent, type Ref, useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Fulfillment } from "@/modules/orders/client";
import { formatBRL } from "@/shared/money";
import type { CheckoutStore } from "./checkout";
import { ChoiceCards, TextField } from "./text-field";

async function fillFromZipCode(event: FocusEvent<HTMLInputElement>) {
  const digits = event.target.value.replace(/\D/g, "");
  const form = event.currentTarget.form;
  if (digits.length !== 8 || !form) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await response.json()) as { logradouro?: string; bairro?: string; localidade?: string; erro?: boolean };
    if (data.erro) return;
    const fill = (name: string, value?: string) => {
      const field = form.elements.namedItem(name);
      if (value && field instanceof HTMLInputElement && !field.value) field.value = value;
    };
    fill("street", data.logradouro);
    fill("neighborhood", data.bairro);
    fill("city", data.localidade);
  } catch {
    // CEP é só conveniência; o cliente pode digitar o endereço.
  }
}

export function DeliveryStep({
  hidden,
  store,
  fulfillments,
  fulfillment,
  onFulfillmentChange,
  fieldError,
  ref,
}: {
  hidden: boolean;
  store: CheckoutStore;
  fulfillments: readonly (readonly [Fulfillment, string])[];
  fulfillment: Fulfillment;
  onFulfillmentChange: (value: Fulfillment) => void;
  fieldError: (path: string) => string | undefined;
  ref: Ref<HTMLFieldSetElement>;
}) {
  const neighborhoodId = useId();
  const neighborhoodError = fieldError("address.neighborhood") ?? fieldError("address");

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-4">
      <legend className="mb-2 font-semibold">Como você quer receber?</legend>
      <ChoiceCards label="Como você quer receber?" value={fulfillment} options={fulfillments} onChange={onFulfillmentChange} />

      {fulfillment === "delivery" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <TextField label="CEP" name="zipCode" inputMode="numeric" onBlur={fillFromZipCode} error={fieldError("address.zipCode")} />
          <TextField label="Rua" name="street" required error={fieldError("address.street")} />
          <TextField label="Número" name="number" required error={fieldError("address.number")} />
          <TextField label="Complemento" name="complement" />
          {store.deliveryFee.strategy === "by_neighborhood" ? (
            <Field data-invalid={neighborhoodError ? true : undefined}>
              <FieldLabel htmlFor={neighborhoodId}>Bairro</FieldLabel>
              <Select name="neighborhood">
                <SelectTrigger id={neighborhoodId} className="w-full" aria-invalid={neighborhoodError ? true : undefined}>
                  <SelectValue placeholder="Escolha o bairro" />
                </SelectTrigger>
                <SelectContent>
                  {store.zones.map((zone) => (
                    <SelectItem key={zone.neighborhood} value={zone.neighborhood}>
                      {`${zone.neighborhood} — ${formatBRL(zone.feeCents)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {neighborhoodError && <FieldError>{neighborhoodError}</FieldError>}
            </Field>
          ) : (
            <TextField label="Bairro" name="neighborhood" required error={neighborhoodError} />
          )}
          <TextField label="Cidade" name="city" />
          <TextField label="Ponto de referência" name="reference" />
        </div>
      )}

      {fulfillment === "pickup" && store.address && (
        <p className="rounded-xl border bg-card p-4 text-sm">
          Retire em: <span className="font-medium">{store.address}</span>
        </p>
      )}

      {fulfillment === "dine_in" && <TextField label="Mesa" name="tableLabel" required error={fieldError("tableLabel")} />}
    </fieldset>
  );
}
