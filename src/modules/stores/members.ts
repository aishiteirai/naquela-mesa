import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { storeMembers } from "./schema";

export async function addStoreMember(storeId: string, userId: string): Promise<void> {
  await db.insert(storeMembers).values({ storeId, userId }).onConflictDoNothing();
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
