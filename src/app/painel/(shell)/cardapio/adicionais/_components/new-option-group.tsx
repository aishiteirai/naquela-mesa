"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OptionGroupForm } from "./forms";

export function NewOptionGroup() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          Novo grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo de adicionais</DialogTitle>
          <DialogDescription>Mínimo 0 deixa o grupo opcional; máximo 1 vira escolha única.</DialogDescription>
        </DialogHeader>
        {open && <OptionGroupForm group={null} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}
