import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { auth } from "./auth";
import { SUPER_ADMIN_ROLE } from "./roles";
import { user } from "./schema";

export type EnsureUserInput = { email: string; password: string; name: string };
export type EnsureSuperAdminInput = EnsureUserInput;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<{ id: string; name: string } | null> {
  const [row] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

export async function getUserEmails(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, ids));
  return new Map(rows.map((row) => [row.id, row.email]));
}

/** Troca a senha (mesmo hash do login do Better Auth) e encerra as sessões abertas da conta. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
  await ctx.internalAdapter.deleteUserSessions(userId);
}

export async function deleteUserByEmail(email: string): Promise<boolean> {
  const deleted = await db.delete(user).where(eq(user.email, normalizeEmail(email))).returning({ id: user.id });
  return deleted.length > 0;
}

export async function ensureUser(input: EnsureUserInput): Promise<{ id: string; created: boolean }> {
  const email = normalizeEmail(input.email);

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing) return { id: existing.id, created: false };

  const created = await auth.api.createUser({
    body: { email, password: input.password, name: input.name },
  });
  return { id: created.user.id, created: true };
}

export async function ensureSuperAdmin(input: EnsureSuperAdminInput): Promise<{ id: string; created: boolean }> {
  const result = await ensureUser(input);
  // Conta existente: a senha informada passa a valer (antes era ignorada sem aviso).
  if (!result.created) await setUserPassword(result.id, input.password);
  await db.update(user).set({ role: SUPER_ADMIN_ROLE, updatedAt: sql`now()` }).where(eq(user.id, result.id));
  return result;
}
