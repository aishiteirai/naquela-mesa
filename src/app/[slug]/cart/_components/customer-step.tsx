"use client";

import type { Ref } from "react";
import { TextField } from "./text-field";

export function CustomerStep({ hidden, fieldError, ref }: { hidden: boolean; fieldError: (path: string) => string | undefined; ref: Ref<HTMLFieldSetElement> }) {
  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-3">
      <legend className="sr-only">Seus dados</legend>
      <TextField label="Seu nome" name="name" autoComplete="name" required error={fieldError("customer.name")} />
      <TextField label="WhatsApp (com DDD)" name="phone" autoComplete="tel" inputMode="tel" required error={fieldError("customer.phone")} />
    </fieldset>
  );
}
