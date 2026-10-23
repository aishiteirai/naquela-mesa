"use client";

import { useActionState, useId } from "react";
import { ActionForm } from "@/app/_components/action-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Store } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { idleState } from "@/app/_lib/action-state";
import { FieldError, FormMessage, SubmitButton, TextField } from "@/app/_components/form-fields";
import { saveOperationsAction } from "@/app/painel/(shell)/loja/actions";

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} name={name} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Switch id={id} name={name} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

export function OperationsForm({ features, rules, paymentMethods }: Pick<Store, "features" | "rules" | "paymentMethods">) {
  const [state, formAction, pending] = useActionState(saveOperationsAction, idleState);
  const halfRuleId = useId();
  const feeId = useId();
  const fixedCents = rules.deliveryFee.strategy === "fixed" ? rules.deliveryFee.fixedCents : 0;

  // Depois de salvar, a key remonta o form com o valor salvo (os controles Radix guardam o valor do mount).
  const savedKey = JSON.stringify({ features, rules, paymentMethods });

  return (
    <ActionForm key={savedKey} action={formAction} pending={pending} className="flex max-w-xl flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">Tipos de pedido</FieldLegend>
        <FieldGroup className="gap-3">
          <Check name="delivery" label="Delivery" defaultChecked={features.delivery} />
          <Check name="pickup" label="Retirada no balcão" defaultChecked={features.pickup} />
          <Check name="dineIn" label="Consumo no local" defaultChecked={features.dineIn} />
        </FieldGroup>
        <FieldError state={state} name="features" />
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend variant="label">Cardápio</FieldLegend>
        <FieldGroup className="gap-3">
          <Toggle name="halfAndHalf" label="Meio a meio" defaultChecked={features.halfAndHalf} />
          <Toggle name="addons" label="Adicionais" defaultChecked={features.addons} />
          <Field className="sm:w-64">
            <FieldLabel htmlFor={halfRuleId}>Preço do meio a meio</FieldLabel>
            <Select name="halfPriceRule" defaultValue={rules.halfPriceRule}>
              <SelectTrigger id={halfRuleId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="highest">Sabor mais caro</SelectItem>
                <SelectItem value="average">Média dos sabores</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend variant="label">Regras</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-3">
          <TextField label="Pedido mínimo" name="minOrder" errorKey="rules.minOrderCents" state={state} inputMode="decimal" defaultValue={formatCentsForInput(rules.minOrderCents)} />
          <TextField label="Tempo de preparo (min)" name="prepTimeMin" errorKey="rules.prepTimeMin" state={state} type="number" min={1} defaultValue={rules.prepTimeMin} />
          <TextField label="Tempo de entrega (min)" name="deliveryTimeMin" errorKey="rules.deliveryTimeMin" state={state} type="number" min={1} defaultValue={rules.deliveryTimeMin} />
        </FieldGroup>
        <Toggle name="autoPrintOnAccept" label="Imprimir comanda ao aceitar" defaultChecked={rules.autoPrintOnAccept} />
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend variant="label">Taxa de entrega</FieldLegend>
        <RadioGroup name="deliveryFeeStrategy" defaultValue={rules.deliveryFee.strategy} className="gap-3">
          <Field orientation="horizontal">
            <RadioGroupItem id={`${feeId}-fixed`} value="fixed" />
            <FieldLabel htmlFor={`${feeId}-fixed`} className="font-normal">
              Taxa fixa
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem id={`${feeId}-zones`} value="by_neighborhood" />
            <FieldLabel htmlFor={`${feeId}-zones`} className="font-normal">
              Taxa por bairro
            </FieldLabel>
          </Field>
        </RadioGroup>
        <TextField
          label="Valor da taxa fixa"
          name="fixedFee"
          errorKey="rules.deliveryFee.fixedCents"
          state={state}
          inputMode="decimal"
          defaultValue={formatCentsForInput(fixedCents)}
          className="sm:w-48"
        />
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend variant="label">Pagamento na entrega e no local</FieldLegend>
        <FieldGroup className="gap-3">
          <Check name="cash" label="Dinheiro" defaultChecked={paymentMethods.cash} />
          <Check name="cardOnDelivery" label="Cartão na entrega" defaultChecked={paymentMethods.cardOnDelivery} />
        </FieldGroup>
        <TextField label="Chave Pix" name="pixKey" state={state} defaultValue={paymentMethods.pixKey ?? ""} />
      </FieldSet>

      <div className="flex flex-col gap-2">
        <SubmitButton className="self-start">Salvar operação</SubmitButton>
        <FormMessage state={state} />
      </div>
    </ActionForm>
  );
}
