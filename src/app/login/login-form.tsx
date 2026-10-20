"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/modules/auth/client";
import { loginErrorMessage } from "./login-error";
import { safeNextPath } from "./next-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (signInError) {
        setError(loginErrorMessage(signInError.status));
        return;
      }
      const isSuperAdminUser = data?.user && "role" in data.user && data.user.role === "super_admin";
      router.push(safeNextPath(searchParams.get("next")) ?? (isSuperAdminUser ? "/admin" : "/painel"));
      router.refresh();
    } catch {
      setError(loginErrorMessage(undefined));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <Input id="login-email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="login-senha">Senha</FieldLabel>
          <Input id="login-senha" name="password" type="password" required autoComplete="current-password" />
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
