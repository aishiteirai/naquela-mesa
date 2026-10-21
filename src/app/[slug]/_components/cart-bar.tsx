"use client";

import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { formatBRL } from "@/shared/money";
import { useCart } from "./cart-context";

export function CartBar({ slug }: { slug: string }) {
  const cart = useCart();
  if (!cart.ready || cart.count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-3">
      <Link
        href={`/${slug}/cart`}
        aria-label="Ver sacola"
        className="mx-auto flex max-w-5xl items-center justify-between rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg"
      >
        <span className="flex items-center gap-2">
          <ShoppingBagIcon className="size-5" aria-hidden="true" />
          Ver sacola ({cart.count})
        </span>
        <span>{formatBRL(cart.estimatedSubtotalCents)}</span>
      </Link>
    </div>
  );
}
