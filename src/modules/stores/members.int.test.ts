import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { pool } from "@/shared/db/client";
import { addStoreMember, getMembershipStoreId } from "./members";
import { createStore, deleteStoreBySlug, getStoreById } from "./service";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("store members", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("vincula dono à loja de forma idempotente", async () => {
    const storeId = await newStore("loja-a");
    const owner = await ensureUser({ email: "dono-a@exemplo.com", password: "senha-forte-123", name: "Dono A" });

    await addStoreMember(storeId, owner.id);
    await addStoreMember(storeId, owner.id);

    expect(await getMembershipStoreId(owner.id)).toBe(storeId);
  });

  it("usuário sem vínculo não tem loja", async () => {
    const stranger = await ensureUser({ email: "sem-loja@exemplo.com", password: "senha-forte-123", name: "Sem loja" });
    expect(await getMembershipStoreId(stranger.id)).toBeNull();
  });

  it("apagar a loja remove o vínculo", async () => {
    const storeId = await newStore("loja-b");
    const owner = await ensureUser({ email: "dono-b@exemplo.com", password: "senha-forte-123", name: "Dono B" });
    await addStoreMember(storeId, owner.id);

    await deleteStoreBySlug("loja-b");

    expect(await getMembershipStoreId(owner.id)).toBeNull();
  });

  it("getStoreById devolve a loja ou null", async () => {
    const storeId = await newStore("loja-a");
    expect((await getStoreById(storeId))?.slug).toBe("loja-a");
    expect(await getStoreById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
