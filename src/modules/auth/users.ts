import { eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { auth } from "./auth";
import { SUPER_ADMIN_ROLE } from "./roles";
import { user } from "./schema";

export type EnsureSuperAdminInput = { email: string; password: string; name: string };

export async function ensureSuperAdmin(input: EnsureSuperAdminInput): Promise<{ id: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing) {
    await db.update(user).set({ role: SUPER_ADMIN_ROLE, updatedAt: new Date() }).where(eq(user.id, existing.id));
    return { id: existing.id, created: false };
  }

  const created = await auth.api.createUser({
    body: { email, password: input.password, name: input.name },
  });
  await db.update(user).set({ role: SUPER_ADMIN_ROLE }).where(eq(user.id, created.user.id));
  return { id: created.user.id, created: true };
}
