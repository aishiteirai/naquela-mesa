"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useCallback, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { MenuOption, MenuOptionGroup } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";
import { toggleOptionAvailabilityAction } from "@/app/painel/(shell)/cardapio/availability-actions";
import { OptionForm, OptionGroupForm } from "./forms";

function ruleLabel(group: MenuOptionGroup): string {
  if (group.minSelect === 0) return group.maxSelect === 1 ? "Opcional · até 1" : `Opcional · até ${group.maxSelect}`;
  if (group.minSelect === group.maxSelect) return `Obrigatório · escolha ${group.minSelect}`;
  return `Obrigatório · de ${group.minSelect} a ${group.maxSelect}`;
}

type Editing = { kind: "group" } | { kind: "option"; option: MenuOption | null } | null;

function OptionRow({ option, onEdit }: { option: MenuOption; onEdit: () => void }) {
  const [available, setOptimisticAvailable] = useOptimistic(option.available);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    const form = new FormData();
    form.set("optionId", option.id);
    form.set("available", String(next));
    startTransition(async () => {
      setOptimisticAvailable(next);
      try {
        const result = await toggleOptionAvailabilityAction(form);
        if (result.ok) toast.success(`${option.name} marcada como ${next ? "disponível" : "esgotada"}`);
        else toast.error("Não foi possível atualizar; recarregue a página.");
      } catch {
        toast.error(`Não foi possível atualizar ${option.name}.`);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 truncate">{option.name}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{option.priceCents > 0 ? `+ ${formatBRL(option.priceCents)}` : "grátis"}</span>
      <Switch checked={available} onCheckedChange={toggle} aria-label={`Disponível: ${option.name}`} />
      <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Editar ${option.name}`}>
        <PencilIcon />
      </Button>
    </li>
  );
}

export function OptionGroupCard({ group }: { group: MenuOptionGroup }) {
  const [editing, setEditing] = useState<Editing>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <Card role="region" aria-label={group.name}>
      <CardHeader>
        <CardTitle>
          <h2>{group.name}</h2>
        </CardTitle>
        <CardDescription>{ruleLabel(group)}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "group" })} aria-label={`Editar grupo ${group.name}`}>
            <PencilIcon />
            Editar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {group.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma opção ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {group.options.map((option) => (
              <OptionRow key={option.id} option={option} onEdit={() => setEditing({ kind: "option", option })} />
            ))}
          </ul>
        )}
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setEditing({ kind: "option", option: null })}>
          <PlusIcon />
          Opção
        </Button>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.kind === "group" ? "Editar grupo" : editing?.kind === "option" && editing.option ? "Editar opção" : "Nova opção"}
            </DialogTitle>
            <DialogDescription>{group.name}</DialogDescription>
          </DialogHeader>
          {editing?.kind === "group" && <OptionGroupForm group={group} onDone={close} />}
          {editing?.kind === "option" && <OptionForm groupId={group.id} option={editing.option} onDone={close} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
