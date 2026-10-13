import { SignOutButton } from "@/app/_components/sign-out-button";

export default function SemLojaPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">Conta sem loja</h1>
      <p className="text-neutral-700 dark:text-neutral-300">
        Sua conta ainda não está vinculada a nenhuma loja. Fale com o suporte do Naquela Mesa.
      </p>
      <SignOutButton />
    </main>
  );
}
