"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInWithPassword } from "@/modules/auth";
import { acceptStoreInvite } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/shared/rate-limit";
import { actionError, fieldError, type ActionState } from "@/app/_lib/action-state";

export async function acceptInviteAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return fieldError("confirm", "as senhas não conferem");
  try {
    await enforceRateLimit(RATE_LIMITS.inviteByIp, clientIp(await headers()));
  } catch (error) {
    if (isDomainError(error) && error.code === "RATE_LIMITED") {
      return { status: "error", message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", fieldErrors: {} };
    }
    throw error;
  }
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
