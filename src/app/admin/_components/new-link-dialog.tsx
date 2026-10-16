"use client";

import { LinkIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton, TextField } from "@/app/_components/form-fields";
import { newInviteLinkAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

function NewLinkForm({ storeId, email }: { storeId: string; email: string | null }) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(newInviteLinkAction, { status: "idle" });
  const fieldState = state.status === "link" ? ({ status: "idle" } as const) : state;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="storeId" value={storeId} />
      {email ? (
        <>
          <input type="hidden" name="email" value={email} />
          <p className="text-sm">
            Para <span className="font-medium">{email}</span>. Gerar um novo link invalida os anteriores.
          </p>
        </>
      ) : (
        <TextField label="Email do dono" name="email" errorKey="ownerEmail" type="email" state={fieldState} required />
      )}
      {state.status !== "link" && (
        <SubmitButton pendingText="Gerando..." className="self-start">
          Gerar link de acesso
        </SubmitButton>
      )}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "link" && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {state.message}
          </p>
          {state.inviteUrl && <InviteLink url={state.inviteUrl} />}
        </>
      )}
    </form>
  );
}

export function NewLinkDialog({ storeId, storeName, email }: { storeId: string; storeName: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon />
          Gerar link de acesso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link de acesso · {storeName}</DialogTitle>
          <DialogDescription>O dono usa o link para criar a senha (ou definir uma nova).</DialogDescription>
        </DialogHeader>
        {open && <NewLinkForm storeId={storeId} email={email} />}
      </DialogContent>
    </Dialog>
  );
}
