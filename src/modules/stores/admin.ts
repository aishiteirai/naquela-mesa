import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getUserEmails } from "@/modules/auth";
import { db } from "@/shared/db/client";
import { storeInvites, storeMembers, stores } from "./schema";

export type AdminStoreRow = {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  ownerEmail: string | null;
  pendingInvite: { email: string; expiresAt: Date } | null;
};

export async function listStoresForAdmin(now: Date = new Date()): Promise<AdminStoreRow[]> {
  const rows = await db
    .select({ id: stores.id, slug: stores.slug, name: stores.name, createdAt: stores.createdAt })
    .from(stores)
    .orderBy(desc(stores.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [members, invites] = await Promise.all([
    db
      .select({ storeId: storeMembers.storeId, userId: storeMembers.userId })
      .from(storeMembers)
      .where(inArray(storeMembers.storeId, ids))
      .orderBy(asc(storeMembers.createdAt)),
    db
      .select({ storeId: storeInvites.storeId, email: storeInvites.email, expiresAt: storeInvites.expiresAt })
      .from(storeInvites)
      .where(and(inArray(storeInvites.storeId, ids), isNull(storeInvites.acceptedAt), gt(storeInvites.expiresAt, now))),
  ]);
  const emails = await getUserEmails([...new Set(members.map((member) => member.userId))]);

  return rows.map((row) => {
    const owner = members.find((member) => member.storeId === row.id);
    const invite = invites.find((candidate) => candidate.storeId === row.id);
    return {
      ...row,
      ownerEmail: owner ? (emails.get(owner.userId) ?? null) : null,
      pendingInvite: invite ? { email: invite.email, expiresAt: invite.expiresAt } : null,
    };
  });
}

export async function getStoreOwnerUserId(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: storeMembers.userId })
    .from(storeMembers)
    .where(eq(storeMembers.storeId, storeId))
    .orderBy(asc(storeMembers.createdAt))
    .limit(1);
  return row?.userId ?? null;
}
