"use client";

import { cn } from "@/lib/utils";
import { useNewOrders } from "./new-orders-context";

/** Selo "N novos" do item Pedidos; com a barra recolhida vira um ponto na cor da marca. */
export function NewOrdersBadge({ active }: { active: boolean }) {
  const { count } = useNewOrders();
  if (count <= 0) return null;

  return (
    <>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-bold group-data-[collapsible=icon]:hidden",
          active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        {count === 1 ? "1 novo" : `${count} novos`}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-1.5 right-2 hidden size-2.5 rounded-full border-2 border-sidebar bg-brand group-data-[collapsible=icon]:block"
      />
    </>
  );
}
