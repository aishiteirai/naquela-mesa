import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteUserByEmail, ensureUser } from "@/modules/auth";
import { getMenu } from "@/modules/catalog";
import { addStoreMember, createStore, deleteStoreBySlug, getInvite, getMembershipStoreId, getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { createStoreFromTemplate } from "./create-store";
import { STORE_TEMPLATES } from "./templates";

const base = { name: "Loja Template", whatsapp: "(11) 97777-0000", ownerEmail: "dono-template@exemplo.com" };

describe("criar loja a partir de template", () => {
  let adminId: string;

  beforeEach(async () => {
    for (const template of STORE_TEMPLATES) await deleteStoreBySlug(`tpl-${template}`);
    await deleteStoreBySlug("tpl-outra");
    await deleteUserByEmail("dono-template@exemplo.com");
    await deleteUserByEmail("dono-existente@exemplo.com");
    adminId = (await ensureUser({ email: "admin-template@exemplo.com", password: "senha-forte-123", name: "Admin" })).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each(STORE_TEMPLATES)("template %s cria loja com cardápio e convite", async (template) => {
    const result = await createStoreFromTemplate({ ...base, slug: `tpl-${template}`, template }, adminId);

    expect(result).toMatchObject({ slug: `tpl-${template}`, ownerLinked: false });
    expect(result.inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await getInvite(result.inviteToken!)).toMatchObject({ storeName: "Loja Template", email: "dono-template@exemplo.com" });

    const store = await getStoreBySlug(`tpl-${template}`);
    expect(store).toMatchObject({ whatsappPhone: "+5511977770000", features: { halfAndHalf: template === "pizzaria" } });
    const menu = await getMenu(result.storeId);
    expect(menu.categories.length).toBeGreaterThanOrEqual(3);
    expect(menu.categories.every((category) => category.products.length > 0)).toBe(true);
  });

  it("email com conta sem loja vira dono direto, sem convite", async () => {
    const existing = await ensureUser({ email: "dono-existente@exemplo.com", password: "senha-forte-123", name: "Já Tenho Conta" });
    const result = await createStoreFromTemplate(
      { ...base, slug: "tpl-pizzaria", template: "pizzaria", ownerEmail: "Dono-Existente@exemplo.com" },
      adminId,
    );
    expect(result).toMatchObject({ inviteToken: null, ownerLinked: true });
    expect(await getMembershipStoreId(existing.id)).toBe(result.storeId);
  });

  it("recusa dono de outra loja sem deixar loja pela metade", async () => {
    const other = await createStore({ slug: "tpl-outra", name: "Outra", whatsappPhone: "+5511999990000" });
    const existing = await ensureUser({ email: "dono-existente@exemplo.com", password: "senha-forte-123", name: "Dono" });
    await addStoreMember(other.id, existing.id);

    await expect(
      createStoreFromTemplate({ ...base, slug: "tpl-pizzaria", template: "pizzaria", ownerEmail: "dono-existente@exemplo.com" }, adminId),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "ownerEmail", message: "este email já é dono de outra loja" }] } });
    expect(await getStoreBySlug("tpl-pizzaria")).toBeNull();
  });

  it("valida WhatsApp, email, template e slug", async () => {
    const attempt = (override: Record<string, string>) =>
      createStoreFromTemplate({ ...base, slug: "tpl-pizzaria", template: "pizzaria", ...override }, adminId);

    await expect(attempt({ whatsapp: "123" })).rejects.toMatchObject({ details: { issues: [{ path: "whatsapp" }] } });
    await expect(attempt({ ownerEmail: "sem-arroba" })).rejects.toMatchObject({ details: { issues: [{ path: "ownerEmail" }] } });
    await expect(attempt({ template: "sorveteria" })).rejects.toMatchObject({ details: { issues: [{ path: "template" }] } });
    await expect(attempt({ slug: "admin" })).rejects.toMatchObject({ details: { issues: [{ path: "slug" }] } });
    await expect(attempt({ name: "  " })).rejects.toMatchObject({ details: { issues: [{ path: "name" }] } });
    expect(await getStoreBySlug("tpl-pizzaria")).toBeNull();
  });

  it("recusa email com convite pendente de outra loja", async () => {
    await createStoreFromTemplate({ ...base, slug: "tpl-pizzaria", template: "pizzaria" }, adminId);

    await expect(createStoreFromTemplate({ ...base, slug: "tpl-outra", template: "pizzaria" }, adminId)).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "ownerEmail", message: "este email já é dono de outra loja" }] },
    });
    expect(await getStoreBySlug("tpl-outra")).toBeNull();
  });
});
