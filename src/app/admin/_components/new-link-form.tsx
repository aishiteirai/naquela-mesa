"use client";

import { useActionState } from "react";
import { FieldError, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { newInviteLinkAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

export function NewLinkForm({ storeId, email }: { storeId: string; email: string | null }) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(newInviteLinkAction, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <>
          <input type="email" name="email" required aria-label="Email do dono" placeholder="Email do dono" className={inputClass} />
          <FieldError state={state.status === "link" ? { status: "idle" } : state} name="ownerEmail" />
        </>
      )}
      <SubmitButton pendingText="Gerando...">Gerar link de acesso</SubmitButton>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.message}</p>}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
