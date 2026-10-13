"use client";

import Link from "next/link";
import { formatBRL } from "@/shared/money";
import { useCart } from "./cart-context";

export function CartBar({ slug }: { slug: string }) {
  const cart = useCart();
  if (!cart.ready || cart.count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-3">
      <Link
        href={`/${slug}/sacola`}
        aria-label="Ver sacola"
        className="mx-auto flex max-w-3xl items-center justify-between rounded-lg bg-(--brand-primary) px-4 py-3 font-semibold text-(--brand-primary-foreground) shadow-lg"
      >
        <span>Ver sacola ({cart.count})</span>
        <span>{formatBRL(cart.estimatedSubtotalCents)}</span>
      </Link>
    </div>
  );
}
