import { desc } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { auditLogs } from "./schema";
import type { AuditAction } from "./types";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  storeId: string | null;
  details: Record<string, string>;
  createdAt: Date;
};

export async function recordAudit(entry: {
  actorUserId: string | null;
  action: AuditAction;
  storeId: string | null;
  details?: Record<string, string>;
}): Promise<void> {
  await db.insert(auditLogs).values({ ...entry, details: entry.details ?? {} });
}

export async function listAuditLogs(limit = 20): Promise<AuditEntry[]> {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}
