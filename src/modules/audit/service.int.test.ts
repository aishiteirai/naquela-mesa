import { afterAll, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { listAuditLogs, recordAudit } from "./service";

describe("auditoria", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("grava e lista do mais novo ao mais antigo, e sobrevive à exclusão da loja", async () => {
    await deleteStoreBySlug("audit-loja");
    const admin = await ensureUser({ email: "admin-audit@exemplo.com", password: "senha-forte-123", name: "Admin" });
    const { id: storeId } = await createStore({ slug: "audit-loja", name: "Loja Audit", whatsappPhone: "+5511999990000" });

    await recordAudit({ actorUserId: admin.id, action: "support_session_started", storeId, details: { storeName: "Loja Audit" } });
    await recordAudit({ actorUserId: admin.id, action: "support_session_ended", storeId });

    const [latest, previous] = await listAuditLogs(2);
    expect(latest).toMatchObject({ action: "support_session_ended", actorUserId: admin.id, storeId, details: {} });
    expect(previous).toMatchObject({ action: "support_session_started", details: { storeName: "Loja Audit" } });

    await deleteStoreBySlug("audit-loja");
    const [afterDelete] = await listAuditLogs(1);
    expect(afterDelete).toMatchObject({ action: "support_session_ended", storeId: null });
  });
});
