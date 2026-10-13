import { headers } from "next/headers";
import { auth } from "./auth";

/** Login no servidor (Server Action): o plugin nextCookies grava o cookie da sessão. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
}

/** Sessão do super-admin vira a do dono (plugin admin); a original volta em stopImpersonation. */
export async function startImpersonation(userId: string): Promise<void> {
  await auth.api.impersonateUser({ body: { userId }, headers: await headers() });
}

export async function stopImpersonation(): Promise<void> {
  await auth.api.stopImpersonating({ headers: await headers() });
}
