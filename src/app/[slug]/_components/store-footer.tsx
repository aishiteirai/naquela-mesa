import Link from "next/link";

export function StoreFooter() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 text-sm text-muted-foreground">
      <Link href="/privacidade" className="underline">
        Política de privacidade
      </Link>
      <span className="ml-2">· Cardápio digital por Naquela Mesa</span>
    </footer>
  );
}
