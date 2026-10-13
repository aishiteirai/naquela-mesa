"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/app/_components/form-controls";
import { newInviteLinkAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

export function NewLinkForm({ storeId, email }: { storeId: string; email: string }) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(newInviteLinkAction, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="email" value={email} />
      <SubmitButton pendingText="Gerando...">Gerar link de acesso</SubmitButton>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.message}</p>}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
