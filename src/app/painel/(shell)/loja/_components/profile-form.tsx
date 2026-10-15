"use client";

import { useActionState, useId, useState } from "react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Store } from "@/modules/stores";
import { ImageUploadField } from "@/app/_components/image-upload-field";
import { idleState } from "@/app/_lib/action-state";
import { fieldErrorOf, FormMessage, SubmitButton, TextField } from "@/app/painel/_components/form-fields";
import { saveProfileAction } from "@/app/painel/(shell)/loja/actions";
import { ThemePreview } from "./theme-preview";

type Props = Pick<Store, "name" | "address" | "whatsappPhone" | "logoUrl" | "bannerUrl"> & {
  primary: string;
  secondary: string;
  font: "sans" | "serif";
};

function ColorField({ label, name, value, onChange, error }: { label: string; name: string; value: string; onChange: (value: string) => void; error?: string }) {
  const id = useId();
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={id} type="color" name={name} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-14 cursor-pointer p-1" />
        <span className="font-mono text-sm text-muted-foreground uppercase">{value}</span>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function ProfileForm(props: Props) {
  const [state, formAction] = useActionState(saveProfileAction, idleState);
  const fontId = useId();
  const [name, setName] = useState(props.name);
  const [primary, setPrimary] = useState(props.primary);
  const [secondary, setSecondary] = useState(props.secondary);
  const [font, setFont] = useState(props.font);
  const [logoUrl, setLogoUrl] = useState(props.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(props.bannerUrl ?? "");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
      <form action={formAction} className="flex max-w-xl flex-col gap-6">
        <FieldGroup>
          <TextField label="Nome da loja" name="name" state={state} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
          <TextField label="Endereço" name="address" state={state} defaultValue={props.address ?? ""} maxLength={300} />
          <TextField label="WhatsApp" name="whatsappPhone" state={state} defaultValue={props.whatsappPhone} placeholder="+5511999999999" required />
        </FieldGroup>
        <FieldGroup>
          <ImageUploadField name="logoUrl" label="Logo" defaultUrl={props.logoUrl} onUrlChange={setLogoUrl} />
          {fieldErrorOf(state, "logoUrl") && <FieldError>{fieldErrorOf(state, "logoUrl")}</FieldError>}
          <ImageUploadField name="bannerUrl" label="Capa" defaultUrl={props.bannerUrl} onUrlChange={setBannerUrl} />
          {fieldErrorOf(state, "bannerUrl") && <FieldError>{fieldErrorOf(state, "bannerUrl")}</FieldError>}
        </FieldGroup>
        <FieldGroup className="grid gap-6 sm:grid-cols-3">
          <ColorField label="Cor principal" name="primary" value={primary} onChange={setPrimary} error={fieldErrorOf(state, "theme.primary")} />
          <ColorField label="Cor secundária" name="secondary" value={secondary} onChange={setSecondary} error={fieldErrorOf(state, "theme.secondary")} />
          <Field>
            <FieldLabel htmlFor={fontId}>Fonte dos títulos</FieldLabel>
            <Select name="font" value={font} onValueChange={(value) => setFont(value === "serif" ? "serif" : "sans")}>
              <SelectTrigger id={fontId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Moderna (sem serifa)</SelectItem>
                <SelectItem value="serif">Clássica (com serifa)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-2">
          <SubmitButton className="self-start">Salvar aparência</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <ThemePreview name={name} logoUrl={logoUrl} bannerUrl={bannerUrl} primary={primary} secondary={secondary} font={font} />
      </div>
    </div>
  );
}
