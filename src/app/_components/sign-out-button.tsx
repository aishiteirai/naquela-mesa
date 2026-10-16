"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/modules/auth/client";

/** Encerra a sessão e leva ao login. */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };
}

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <Button type="button" variant="outline" onClick={signOut}>
      <LogOutIcon />
      Sair
    </Button>
  );
}
