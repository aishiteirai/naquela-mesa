import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Naquela Mesa</h1>
      <p className="text-lg text-muted-foreground">Cardápio digital e pedidos para restaurantes da região.</p>
      <Button variant="outline" asChild className="self-start">
        <Link href="/login">Entrar no painel da loja</Link>
      </Button>
    </main>
  );
}
