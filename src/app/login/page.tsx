import { Suspense } from "react";
import { AccountCard } from "@/app/_components/account-card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AccountCard title="Entrar" description="Acesse o painel da sua loja.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="m-0 text-sm text-muted-foreground">Esqueceu a senha? Peça ao suporte um novo link de acesso.</p>
    </AccountCard>
  );
}
