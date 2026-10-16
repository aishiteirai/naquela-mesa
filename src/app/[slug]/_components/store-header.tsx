import Image from "next/image";
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import type { Store } from "@/modules/stores";

export function StoreHeader({ store, status }: { store: Store; status: ReactNode }) {
  return (
    <header className="bg-background">
      <div className="relative mx-auto aspect-[3/1] max-h-56 w-full max-w-3xl overflow-hidden sm:rounded-b-2xl">
        {store.bannerUrl ? (
          <Image src={store.bannerUrl} alt="" fill unoptimized priority className="object-cover" />
        ) : (
          <div data-testid="cover-fallback" className="size-full bg-linear-to-br from-primary to-brand-secondary" />
        )}
        <ModeToggle className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm" />
      </div>
      <div className="mx-auto flex max-w-3xl items-end gap-4 px-4">
        <div className="-mt-10 size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-primary shadow-md">
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={`Logo de ${store.name}`} width={80} height={80} unoptimized className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-full place-items-center text-3xl font-bold text-primary-foreground [font-family:var(--heading-font)]">
              {store.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 py-3">
          <h1 className="line-clamp-2 text-2xl font-bold">{store.name}</h1>
          {store.address && <p className="truncate text-sm text-muted-foreground">{store.address}</p>}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-3">{status}</div>
    </header>
  );
}
