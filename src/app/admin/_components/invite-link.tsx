"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function InviteLink({ url }: { url: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Link de acesso</FieldLabel>
      <div className="flex gap-2">
        <Input id={id} readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
      </div>
      <FieldDescription>Vale por 7 dias e uma vez só. Envie ao dono pelo WhatsApp.</FieldDescription>
    </Field>
  );
}
