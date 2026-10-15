import { Suspense } from "react";
import { AccountCard } from "@/app/_components/account-card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AccountCard title="Entrar" description="Esqueceu a senha? Peça ao suporte um novo link de acesso.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AccountCard>
  );
}
