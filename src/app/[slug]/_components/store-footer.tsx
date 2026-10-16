import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND_COLOR, pacifico, scriptFont } from "@/app/_components/brand-theme";

export function StoreFooter() {
  return (
    <footer className={cn(pacifico.variable, "mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-4 pt-8 pb-28 text-center text-muted-foreground")}>
      <p className="flex flex-wrap items-baseline justify-center gap-x-2">
        Cardápio digital por
        <Link href="/" className={cn(scriptFont, "text-2xl")} style={{ color: BRAND_COLOR }}>
          Naquela Mesa
        </Link>
      </p>
      <Link href="/privacidade" className="text-sm underline underline-offset-4">
        Política de privacidade
      </Link>
    </footer>
  );
}
