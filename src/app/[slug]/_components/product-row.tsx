"use client";

import Image from "next/image";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MenuProduct } from "@/modules/catalog";
import { useItemSheet } from "./item-sheet-context";

export function ProductRow({ product, price }: { product: MenuProduct; price: string | null }) {
  const { open: openItem } = useItemSheet();
  const open = product.available ? () => openItem(product.id) : undefined;

  return (
    <article onClick={open} className={cn("flex items-center gap-3 py-3 sm:rounded-xl sm:border sm:p-3", product.available && "cursor-pointer")}>
      {/* Esgotado: o texto também esmaece (a foto já fica em cinza), para ler o estado de relance. */}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !product.available && "opacity-60")}>
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {price && <span className="font-medium">{price}</span>}
          {!product.available && <Badge variant="secondary">Esgotado</Badge>}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt=""
            width={72}
            height={72}
            unoptimized
            className={cn("size-[72px] rounded-lg object-cover", !product.available && "grayscale")}
          />
        )}
        {product.available && (
          <Button
            type="button"
            size="icon"
            aria-label={`Adicionar ${product.name}`}
            onClick={(event) => {
              event.stopPropagation();
              openItem(product.id);
            }}
            // after: área de toque de 44 px em volta do botão de 32 px, sem mudar o desenho.
            className={cn(
              "relative rounded-full shadow-md after:absolute after:-inset-1.5 after:content-['']",
              product.imageUrl && "absolute -right-2 -bottom-2",
            )}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
    </article>
  );
}
