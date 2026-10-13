import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { isUniqueViolation } from "@/shared/db/errors";
import { DomainError } from "@/shared/errors";
import { storeMembers } from "./schema";

export const OWNS_OTHER_STORE = "este email já é dono de outra loja";

export async function addStoreMember(storeId: string, userId: string): Promise<void> {
  try {
    // PK duplicado (mesma loja) segue idempotente; user_id repetido em outra loja estoura a unique.
    await db.insert(storeMembers).values({ storeId, userId }).onConflictDoNothing({ target: [storeMembers.storeId, storeMembers.userId] });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("VALIDATION", { issues: [{ path: "ownerEmail", message: OWNS_OTHER_STORE }] });
    }
    throw error;
  }
}

export async function getMembershipStoreId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, userId))
    .orderBy(asc(storeMembers.createdAt))
    .limit(1);
  return row?.storeId ?? null;
}
