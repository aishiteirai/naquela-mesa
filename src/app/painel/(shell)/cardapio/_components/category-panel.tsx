"use client";

import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, PencilIcon, PlusIcon, RulerIcon } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { EditorCategory } from "@/modules/catalog";
import { moveCategoryAction } from "@/app/painel/(shell)/cardapio/actions";
import { runPanelAction } from "@/app/painel/_components/run-panel-action";
import { CategoryForm } from "./category-form";
import { openNewProduct } from "./menu-url";
import { ProductRow } from "./product-row";
import { SizesEditor } from "./sizes-editor";

type Props = { category: EditorCategory; isFirst: boolean; isLast: boolean };

export function CategoryPanel({ category, isFirst, isLast }: Props) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const closeEditing = useCallback(() => setEditing(false), []);

  function move(direction: "up" | "down") {
    const form = new FormData();
    form.set("categoryId", category.id);
    form.set("direction", direction);
    startTransition(async () => {
      await runPanelAction(() => moveCategoryAction(form));
    });
  }

  return (
    <section aria-label={category.name} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{category.name}</h2>
        {!category.active && <Badge variant="secondary">Inativa</Badge>}
        <div className="ml-auto flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <RulerIcon />
                Tamanhos
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
              <SheetHeader className="border-b">
                <SheetTitle>Tamanhos: {category.name}</SheetTitle>
                <SheetDescription>Pizzas costumam ter tamanhos (Broto, Grande). Cada produto tem um preço por tamanho.</SheetDescription>
              </SheetHeader>
              <div className="p-4">
                <SizesEditor categoryId={category.id} sizes={category.sizes} />
              </div>
            </SheetContent>
          </Sheet>
          <Button size="sm" onClick={() => openNewProduct(category.id)}>
            <PlusIcon />
            Produto
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Mais ações: ${category.name}`}>
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon />
                Renomear / ativar
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
        </div>
      </div>

      {category.products.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum produto nesta categoria ainda.
        </p>
      ) : (
        <ul aria-label={`Produtos de ${category.name}`} className="flex flex-col divide-y rounded-lg border px-3">
          {category.products.map((product, index) => (
            <ProductRow key={product.id} product={product} isFirst={index === 0} isLast={index === category.products.length - 1} />
          ))}
        </ul>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear / ativar</DialogTitle>
            <DialogDescription>Categoria inativa some do cardápio, com os produtos dela.</DialogDescription>
          </DialogHeader>
          {editing && <CategoryForm category={category} onDone={closeEditing} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
