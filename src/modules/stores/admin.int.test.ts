import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteUserByEmail, ensureUser } from "@/modules/auth";
import { pool } from "@/shared/db/client";
import { getStoreOwnerUserId, listStoresForAdmin } from "./admin";
import { createStoreInvite } from "./invites";
import { addStoreMember } from "./members";
import { createStore, deleteStoreBySlug } from "./service";

describe("lojas no super-admin", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("admin-com-dono");
    await deleteStoreBySlug("admin-com-convite");
    await deleteUserByEmail("dono-admin@exemplo.com");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("mostra dono, convite pendente e a mais nova primeiro", async () => {
    const withOwner = await createStore({ slug: "admin-com-dono", name: "Com Dono", whatsappPhone: "+5511999990000" });
    const owner = await ensureUser({ email: "dono-admin@exemplo.com", password: "senha-forte-123", name: "Dono" });
    await addStoreMember(withOwner.id, owner.id);
    const withInvite = await createStore({ slug: "admin-com-convite", name: "Com Convite", whatsappPhone: "+5511999990001" });
    const { expiresAt } = await createStoreInvite(withInvite.id, "pendente@exemplo.com", null);

    const rows = (await listStoresForAdmin()).filter((row) => row.slug.startsWith("admin-com-"));
    expect(rows.map((row) => row.slug)).toEqual(["admin-com-convite", "admin-com-dono"]);
    expect(rows[0]).toMatchObject({ name: "Com Convite", ownerEmail: null, pendingInvite: { email: "pendente@exemplo.com", expiresAt } });
    expect(rows[1]).toMatchObject({ name: "Com Dono", ownerEmail: "dono-admin@exemplo.com", pendingInvite: null });

    expect(await getStoreOwnerUserId(withOwner.id)).toBe(owner.id);
    expect(await getStoreOwnerUserId(withInvite.id)).toBeNull();

    const later = new Date(Date.now() + 8 * 86_400_000);
    const expired = (await listStoresForAdmin(later)).find((row) => row.slug === "admin-com-convite");
    expect(expired?.pendingInvite).toBeNull();
  });
});
