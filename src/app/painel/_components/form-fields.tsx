"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FieldError as UiFieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/app/_lib/action-state";

export function fieldErrorOf(state: ActionState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors[name] : undefined;
}

export function SubmitButton({
  children,
  pendingText = "Salvando...",
  ...props
}: { children: ReactNode; pendingText?: string } & Omit<ComponentProps<typeof Button>, "type">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const message = fieldErrorOf(state, name);
  if (!message) return null;
  return <UiFieldError>{message}</UiFieldError>;
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle") return null;
  return (
    <p role="status" className={cn("text-sm", state.status === "success" ? "text-muted-foreground" : "text-destructive", className)}>
      {state.message}
    </p>
  );
}

/** Campo de texto com rótulo e erro do servidor (`name` também é a chave do erro, salvo `errorKey`). */
export function TextField({
  label,
  state,
  errorKey,
  className,
  ...props
}: { label: string; state: ActionState; errorKey?: string } & ComponentProps<typeof Input>) {
  const id = useId();
  const error = fieldErrorOf(state, errorKey ?? String(props.name ?? ""));
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error && <UiFieldError>{error}</UiFieldError>}
    </Field>
  );
}
