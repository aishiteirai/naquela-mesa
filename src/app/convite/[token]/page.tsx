import { connection } from "next/server";
import { Suspense } from "react";
import { getInvite } from "@/modules/stores";
import { AccountCard } from "@/app/_components/account-card";
import { acceptInviteAction } from "./actions";
import { AcceptForm } from "./_components/accept-form";

export const metadata = { robots: { index: false, follow: false } };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = await getInvite(token);

  if (!invite) {
    return <AccountCard title="Link inválido ou expirado." description="Peça um novo link ao suporte do Naquela Mesa." />;
  }

  return (
    <AccountCard
      title={`Acesso à ${invite.storeName}`}
      description={invite.hasAccount ? "Defina uma nova senha para entrar no painel." : "Crie sua senha para entrar no painel da loja."}
    >
      <AcceptForm action={acceptInviteAction.bind(null, token)} email={invite.email} hasAccount={invite.hasAccount} />
    </AccountCard>
  );
}

export default function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-muted/40" />}>
      <Invite params={params} />
    </Suspense>
  );
}
