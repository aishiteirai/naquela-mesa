import Image from "next/image";
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import type { Store } from "@/modules/stores";

export function StoreHeader({ store, status }: { store: Store; status: ReactNode }) {
  return (
    <header className="bg-background">
      <div className="relative mx-auto h-28 w-full max-w-5xl overflow-hidden sm:h-40 sm:rounded-b-2xl">
        {store.bannerUrl ? (
          <Image src={store.bannerUrl} alt="" fill unoptimized priority className="object-cover" />
        ) : (
          <div data-testid="cover-fallback" className="size-full bg-linear-to-br from-primary to-brand-secondary" />
        )}
        <ModeToggle className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm" />
      </div>
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 pb-3">
        <div className="relative -mt-7 size-14 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-primary shadow-md">
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={`Logo de ${store.name}`} width={56} height={56} unoptimized className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-full place-items-center text-2xl font-bold text-primary-foreground [font-family:var(--heading-font)]">
              {store.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
          <h1 className="line-clamp-2 text-xl font-bold sm:text-2xl">{store.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {store.address && <p className="min-w-0 truncate text-sm text-muted-foreground">{store.address}</p>}
            {status}
          </div>
        </div>
      </div>
    </header>
  );
}
