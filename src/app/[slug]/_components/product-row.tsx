"use client";

import Image from "next/image";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MenuProduct } from "@/modules/catalog";
import { openItem } from "./item-url";

export function ProductRow({ product, price }: { product: MenuProduct; price: string | null }) {
  const open = product.available ? () => openItem(product.id) : undefined;

  return (
    <article onClick={open} className={cn("flex gap-3 py-4", product.available && "cursor-pointer")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {price && <span className="font-semibold">{price}</span>}
          {!product.available && <Badge variant="secondary">Esgotado</Badge>}
        </div>
      </div>
      <div className="relative flex shrink-0 items-end">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt=""
            width={80}
            height={80}
            unoptimized
            className={cn("size-20 rounded-lg object-cover", !product.available && "grayscale")}
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
            className={cn("rounded-full shadow-md", product.imageUrl && "absolute -right-2 -bottom-2")}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
    </article>
  );
}
