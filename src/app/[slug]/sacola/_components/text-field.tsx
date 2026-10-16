"use client";

import { type ComponentProps, useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function TextField({ label, error, ...props }: { label: string; error?: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <RadioGroup value={value} onValueChange={(next) => onChange(next as T)} aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map(([optionValue, optionLabel]) => (
        <FieldLabel key={optionValue} htmlFor={`${id}-${optionValue}`}>
          <Field orientation="horizontal">
            <RadioGroupItem id={`${id}-${optionValue}`} value={optionValue} />
            <span className="font-medium">{optionLabel}</span>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
