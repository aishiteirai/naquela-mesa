"use client";

import Image from "next/image";
import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, PencilIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { EditorProduct } from "@/modules/catalog";
import { priceLabel } from "@/app/[slug]/_lib/price-label";
import { moveProductAction } from "@/app/painel/(shell)/cardapio/actions";
import { toggleProductAvailabilityAction } from "@/app/painel/(shell)/cardapio/availability-actions";
import { runPanelAction } from "@/app/painel/_components/run-panel-action";
import { openProduct } from "./menu-url";

function formWith(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

export function ProductRow({ product, isFirst, isLast }: { product: EditorProduct; isFirst: boolean; isLast: boolean }) {
  const [available, setOptimisticAvailable] = useOptimistic(product.available);
  const [, startTransition] = useTransition();

  function toggleAvailable(next: boolean) {
    startTransition(async () => {
      setOptimisticAvailable(next);
      try {
        const result = await toggleProductAvailabilityAction(formWith({ productId: product.id, available: String(next) }));
        if (result.ok) toast.success(`${product.name} marcada como ${next ? "disponível" : "esgotada"}`);
        else toast.error("Não foi possível atualizar; recarregue a página.");
      } catch {
        toast.error(`Não foi possível atualizar ${product.name}.`);
      }
    });
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await runPanelAction(() => moveProductAction(formWith({ productId: product.id, direction })));
    });
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => openProduct(product.id)}
        aria-label={`Editar ${product.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-md object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground">
            {product.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{product.name}</span>
            {!product.active && <Badge variant="secondary">Inativo</Badge>}
          </span>
          <span className="text-sm text-muted-foreground">{priceLabel(product) ?? "sem preço"}</span>
        </span>
      </button>
      <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline">{available ? "Disponível" : "Esgotado"}</span>
        <Switch checked={available} onCheckedChange={toggleAvailable} aria-label={`Disponível: ${product.name}`} />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Mais ações: ${product.name}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openProduct(product.id)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isFirst} onSelect={() => move("up")}>
            <ArrowUpIcon />
            Mover para cima
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onSelect={() => move("down")}>
            <ArrowDownIcon />
            Mover para baixo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
