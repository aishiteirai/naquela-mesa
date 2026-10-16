import { AccountCard } from "@/app/_components/account-card";
import { SignOutButton } from "@/app/_components/sign-out-button";

export default function SemLojaPage() {
  return (
    <AccountCard title="Conta sem loja" description="Sua conta ainda não está vinculada a nenhuma loja. Fale com o suporte do Naquela Mesa.">
      <SignOutButton />
    </AccountCard>
  );
}
