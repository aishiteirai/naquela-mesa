"use server";

import { redirect } from "next/navigation";
import { signInWithPassword } from "@/modules/auth";
import { acceptStoreInvite } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { actionError, fieldError, type ActionState } from "@/app/_lib/action-state";

export async function acceptInviteAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return fieldError("confirm", "as senhas não conferem");
  const name = form.has("name") ? String(form.get("name")) : null;

  let email: string;
  try {
    ({ email } = await acceptStoreInvite(token, { name, password }));
  } catch (error) {
    if (isDomainError(error) && error.code === "NOT_FOUND") {
      return { status: "error", message: "Este link expirou ou já foi usado. Peça um novo link ao suporte.", fieldErrors: {} };
    }
    return actionError(error);
  }
  let signedIn = true;
  try {
    await signInWithPassword(email, password);
  } catch {
    signedIn = false;
  }
  // Conta já criada: se o login falhar, manda para o login em vez de deixar a pessoa presa num link usado.
  redirect(signedIn ? "/painel" : "/login");
}
