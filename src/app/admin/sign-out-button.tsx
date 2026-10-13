"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/modules/auth/client";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} className="mt-6 rounded border px-4 py-2 text-sm">
      Sair
    </button>
  );
}
