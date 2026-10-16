import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { isSuperAdmin } from "./roles";

export type SessionUser = {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  role: string | null;
  impersonatedBy: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name, role } = session.user;
  return {
    id,
    sessionId: session.session.id,
    email,
    name,
    role: role ?? null,
    impersonatedBy: session.session.impersonatedBy ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/");
  return user;
}
