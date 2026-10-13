"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/_lib/action-state";

export function SubmitButton({ children, pendingText = "Salvando..." }: { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  if (state.status !== "error" || !state.fieldErrors[name]) return null;
  return <p className="text-sm text-red-700 dark:text-red-400">{state.fieldErrors[name]}</p>;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={state.status === "success" ? "text-sm text-green-800 dark:text-green-300" : "text-sm text-red-700 dark:text-red-400"}
    >
      {state.message}
    </p>
  );
}
