"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EditorCategory, EditorProduct, MenuOptionGroup } from "@/modules/catalog";
import { closeProductPanel } from "./menu-url";
import { ProductForm } from "./product-form";

type Props = {
  category: EditorCategory;
  product: EditorProduct | null;
  optionGroups: MenuOptionGroup[];
};

/** Painel lateral de edição (tela cheia no celular). Fecha pelo X, Esc, clique fora ou voltar do navegador. */
export function ProductSheet({ category, product, optionGroups }: Props) {
  const router = useRouter();

  const onSaved = useCallback(() => {
    closeProductPanel();
    toast.success("Produto salvo");
    router.refresh();
  }, [router]);

  return (
    <Sheet open onOpenChange={(open) => !open && closeProductPanel()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{product ? "Editar produto" : "Novo produto"}</SheetTitle>
          <SheetDescription>Categoria: {category.name}</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <ProductForm
            category={{ id: category.id, name: category.name, sizes: category.sizes }}
            optionGroups={optionGroups.map(({ id, name }) => ({ id, name }))}
            product={product}
            onSaved={onSaved}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
