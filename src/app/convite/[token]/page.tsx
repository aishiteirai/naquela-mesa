import { connection } from "next/server";
import { Suspense } from "react";
import { getInvite } from "@/modules/stores";
import { acceptInviteAction } from "./actions";
import { AcceptForm } from "./_components/accept-form";

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = await getInvite(token);

  if (!invite) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Link inválido ou expirado.</h1>
        <p className="text-neutral-700 dark:text-neutral-300">Peça um novo link ao suporte do Naquela Mesa.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Acesso à {invite.storeName}</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {invite.hasAccount ? "Defina uma nova senha para entrar no painel." : "Crie sua senha para entrar no painel da loja."}
      </p>
      <AcceptForm action={acceptInviteAction.bind(null, token)} email={invite.email} hasAccount={invite.hasAccount} />
    </>
  );
}

export default function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <Suspense fallback={<p>Carregando...</p>}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}
