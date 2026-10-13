"use client";

import { useActionState } from "react";
import type { Store } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveOperationsAction } from "@/app/painel/loja/actions";

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function OperationsForm({ features, rules, paymentMethods }: Pick<Store, "features" | "rules" | "paymentMethods">) {
  const [state, formAction] = useActionState(saveOperationsAction, idleState);
  const fixedCents = rules.deliveryFee.strategy === "fixed" ? rules.deliveryFee.fixedCents : 0;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipos de pedido</legend>
        <Check name="delivery" label="Delivery" defaultChecked={features.delivery} />
        <Check name="pickup" label="Retirada no balcão" defaultChecked={features.pickup} />
        <Check name="dineIn" label="Consumo no local" defaultChecked={features.dineIn} />
        <FieldError state={state} name="features" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Cardápio</legend>
        <Check name="halfAndHalf" label="Meio a meio" defaultChecked={features.halfAndHalf} />
        <Check name="addons" label="Adicionais" defaultChecked={features.addons} />
        <label className="flex flex-col gap-1 text-sm">
          Preço do meio a meio
          <select name="halfPriceRule" defaultValue={rules.halfPriceRule} className={inputClass}>
            <option value="highest">Sabor mais caro</option>
            <option value="average">Média dos sabores</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Regras</legend>
        <label className="flex flex-col gap-1 text-sm">
          Pedido mínimo
          <input name="minOrder" inputMode="decimal" defaultValue={formatCentsForInput(rules.minOrderCents)} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.minOrderCents" />
        <label className="flex flex-col gap-1 text-sm">
          Tempo de preparo (min)
          <input name="prepTimeMin" type="number" min={1} defaultValue={rules.prepTimeMin} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.prepTimeMin" />
        <label className="flex flex-col gap-1 text-sm">
          Tempo de entrega (min)
          <input name="deliveryTimeMin" type="number" min={1} defaultValue={rules.deliveryTimeMin} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.deliveryTimeMin" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Taxa de entrega</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="deliveryFeeStrategy" value="fixed" defaultChecked={rules.deliveryFee.strategy === "fixed"} />
          Taxa fixa
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="deliveryFeeStrategy"
            value="by_neighborhood"
            defaultChecked={rules.deliveryFee.strategy === "by_neighborhood"}
          />
          Taxa por bairro
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Valor da taxa fixa
          <input name="fixedFee" inputMode="decimal" defaultValue={formatCentsForInput(fixedCents)} className={inputClass} />
        </label>
        <FieldError state={state} name="rules.deliveryFee.fixedCents" />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Pagamento na entrega/retirada</legend>
        <Check name="cash" label="Dinheiro" defaultChecked={paymentMethods.cash} />
        <Check name="cardOnDelivery" label="Cartão na entrega" defaultChecked={paymentMethods.cardOnDelivery} />
        <label className="flex flex-col gap-1 text-sm">
          Chave Pix
          <input name="pixKey" defaultValue={paymentMethods.pixKey ?? ""} className={inputClass} />
        </label>
      </fieldset>

      <SubmitButton>Salvar operação</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
