import Image from "next/image";
import type { ReactNode } from "react";
import type { Store } from "@/modules/stores";

export function StoreHeader({ store, status }: { store: Store; status: ReactNode }) {
  return (
    <header className="bg-(--brand-primary) text-(--brand-primary-foreground)">
      {store.bannerUrl && (
        <div className="relative h-32 w-full sm:h-48">
          <Image src={store.bannerUrl} alt="" fill unoptimized className="object-cover" />
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-5">
        {store.logoUrl && (
          <Image
            src={store.logoUrl}
            alt={`Logo de ${store.name}`}
            width={64}
            height={64}
            unoptimized
            className="size-16 rounded-full border-2 border-white object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          {store.address && <p className="text-sm opacity-90">{store.address}</p>}
          <div>{status}</div>
        </div>
      </div>
    </header>
  );
}
