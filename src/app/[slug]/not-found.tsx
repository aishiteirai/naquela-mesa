import Link from "next/link";

export default function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Loja não encontrada</h1>
      <p className="text-neutral-700 dark:text-neutral-300">Confira o link que você recebeu do restaurante.</p>
      <Link href="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
