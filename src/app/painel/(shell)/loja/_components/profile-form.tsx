"use client";

import { useActionState, useState } from "react";
import type { Store } from "@/modules/stores";
import { readableTextColor } from "@/modules/stores/client";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { ImageUploadField } from "@/app/_components/image-upload-field";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveProfileAction } from "@/app/painel/(shell)/loja/actions";

type Props = Pick<Store, "name" | "address" | "whatsappPhone" | "logoUrl" | "bannerUrl"> & { primary: string; secondary: string };

export function ProfileForm(props: Props) {
  const [state, formAction] = useActionState(saveProfileAction, idleState);
  const [primary, setPrimary] = useState(props.primary);
  const [secondary, setSecondary] = useState(props.secondary);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nome da loja
        <input name="name" defaultValue={props.name} required maxLength={120} className={inputClass} />
      </label>
      <FieldError state={state} name="name" />
      <label className="flex flex-col gap-1 text-sm">
        Endereço
        <input name="address" defaultValue={props.address ?? ""} maxLength={300} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        WhatsApp
        <input name="whatsappPhone" defaultValue={props.whatsappPhone} placeholder="+5511999999999" required className={inputClass} />
      </label>
      <FieldError state={state} name="whatsappPhone" />
      <div className="flex gap-6">
        <label className="flex flex-col gap-1 text-sm">
          Cor principal
          <input type="color" name="primary" value={primary} onChange={(event) => setPrimary(event.target.value)} className="h-10 w-20" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cor secundária
          <input type="color" name="secondary" value={secondary} onChange={(event) => setSecondary(event.target.value)} className="h-10 w-20" />
        </label>
      </div>
      <div
        data-testid="theme-preview"
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ backgroundColor: primary, color: readableTextColor(primary) }}
      >
        <span className="font-semibold">{props.name}</span>
        <span className="rounded-full px-3 py-1 text-sm" style={{ backgroundColor: secondary, color: readableTextColor(secondary) }}>
          Pizzas
        </span>
      </div>
      <FieldError state={state} name="theme.primary" />
      <FieldError state={state} name="theme.secondary" />
      <ImageUploadField name="logoUrl" label="Logo" defaultUrl={props.logoUrl} />
      <FieldError state={state} name="logoUrl" />
      <ImageUploadField name="bannerUrl" label="Banner" defaultUrl={props.bannerUrl} />
      <FieldError state={state} name="bannerUrl" />
      <SubmitButton>Salvar aparência</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
