"use client";

import { PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CatalogEditorView } from "@/modules/catalog";
import { parsePanelParams } from "@/app/painel/_lib/panel-params";
import { CategoryForm } from "./category-form";
import { CategoryPanel } from "./category-panel";
import { closeProductPanel, selectCategory } from "./menu-url";
import { ProductSheet } from "./product-sheet";

/** Cardápio em uma tela: categorias à esquerda (Select no celular), produtos no meio e edição no painel lateral. */
export function MenuEditor({ catalog }: { catalog: CatalogEditorView }) {
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const closeCreating = useCallback(() => setCreating(false), []);

  const raw = { categoria: searchParams.get("categoria"), produto: searchParams.get("produto"), novo: searchParams.get("novo") };
  const params = parsePanelParams(raw, catalog.categories);
  const selectedIndex = catalog.categories.findIndex((category) => category.id === params.categoryId);
  const selected = catalog.categories[selectedIndex];
  const product = selected?.products.find((item) => item.id === params.productId) ?? null;
  const panelOpen = Boolean(selected && (product || params.newInCategoryId));
  const staleParam = (raw.produto !== null && !params.productId) || (raw.novo !== null && !params.newInCategoryId);

  // Link para produto removido (ou categoria inválida em ?novo=): limpa o parâmetro em vez de abrir nada.
  useEffect(() => {
    if (staleParam) closeProductPanel();
  }, [staleParam]);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="flex flex-col gap-3 md:sticky md:top-20 md:w-60 md:shrink-0">
        {catalog.categories.length > 0 && (
          <div className="md:hidden">
            <Select value={selected?.id} onValueChange={selectCategory}>
              <SelectTrigger aria-label="Categoria" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.products.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <nav aria-label="Categorias do cardápio" className="hidden md:block">
          <ul className="flex flex-col gap-1">
            {catalog.categories.map((category) => {
              const active = category.id === selected?.id;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => selectCategory(category.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      active && "bg-muted font-medium",
                    )}
                  >
                    <span className="truncate">{category.name}</span>
                    {!category.active && <Badge variant="secondary">Inativa</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{category.products.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <Button variant="outline" onClick={() => setCreating(true)} className="md:self-start">
          <PlusIcon />
          Categoria
        </Button>
      </aside>

      <div className="min-w-0 flex-1">
        {selected ? (
          <CategoryPanel key={selected.id} category={selected} isFirst={selectedIndex === 0} isLast={selectedIndex === catalog.categories.length - 1} />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhuma categoria ainda. Comece criando uma.</p>
        )}
      </div>

      {panelOpen && selected && (
        <ProductSheet key={product?.id ?? `novo-${selected.id}`} category={selected} product={product} optionGroups={catalog.optionGroups} />
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>Ex.: Pizzas, Bebidas, Sobremesas.</DialogDescription>
          </DialogHeader>
          {creating && <CategoryForm category={null} onDone={closeCreating} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
