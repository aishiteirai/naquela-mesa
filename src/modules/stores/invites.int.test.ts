import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, deleteUserByEmail, ensureUser, findUserByEmail } from "@/modules/auth";
import { db, pool } from "@/shared/db/client";
import { acceptStoreInvite, createStoreInvite, getInvite } from "./invites";
import { getMembershipStoreId } from "./members";
import { storeInvites } from "./schema";
import { createStore, deleteStoreBySlug } from "./service";

const NEW_OWNER = "novo-dono@exemplo.com";
const OLD_OWNER = "dono-antigo@exemplo.com";

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hash = found?.accounts.find((account) => account.providerId === "credential")?.password;
  return hash ? ctx.password.verify({ hash, password }) : false;
}

describe("convites de loja", () => {
  let storeId: string;

  beforeEach(async () => {
    await deleteStoreBySlug("convite-loja");
    await deleteUserByEmail(NEW_OWNER);
    await deleteUserByEmail(OLD_OWNER);
    ({ id: storeId } = await createStore({ slug: "convite-loja", name: "Loja Convite", whatsappPhone: "+5511999990000" }));
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria conta nova, vincula à loja e o link vale uma vez", async () => {
    const { token, expiresAt } = await createStoreInvite(storeId, "  Novo-Dono@Exemplo.com ", null);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);

    const [stored] = await db.select().from(storeInvites).where(eq(storeInvites.storeId, storeId));
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(await getInvite(token)).toMatchObject({ storeName: "Loja Convite", email: NEW_OWNER, hasAccount: false });

    expect(await acceptStoreInvite(token, { name: "Novo Dono", password: "senha-forte-123" })).toEqual({ email: NEW_OWNER, storeId });
    const user = await findUserByEmail(NEW_OWNER);
    expect(user?.name).toBe("Novo Dono");
    expect(await getMembershipStoreId(user!.id)).toBe(storeId);
    expect(await passwordWorks(NEW_OWNER, "senha-forte-123")).toBe(true);

    expect(await getInvite(token)).toBeNull();
    await expect(acceptStoreInvite(token, { name: "Outro", password: "senha-forte-456" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("dois aceites simultâneos criam uma conta só", async () => {
    const { token } = await createStoreInvite(storeId, NEW_OWNER, null);
    const results = await Promise.allSettled([
      acceptStoreInvite(token, { name: "Dono A", password: "senha-forte-123" }),
      acceptStoreInvite(token, { name: "Dono B", password: "senha-forte-456" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("email que já tem conta: troca a senha e não pede nome", async () => {
    await ensureUser({ email: OLD_OWNER, password: "senha-velha-1", name: "Dono Antigo" });
    const { token } = await createStoreInvite(storeId, OLD_OWNER, null);
    expect((await getInvite(token))?.hasAccount).toBe(true);

    await acceptStoreInvite(token, { name: null, password: "senha-nova-123" });
    expect(await passwordWorks(OLD_OWNER, "senha-nova-123")).toBe(true);
    expect(await passwordWorks(OLD_OWNER, "senha-velha-1")).toBe(false);
    expect((await findUserByEmail(OLD_OWNER))?.name).toBe("Dono Antigo");
  });

  it("recusa senha curta, nome vazio, email inválido e mantém o link válido", async () => {
    await expect(createStoreInvite(storeId, "nao-e-email", null)).rejects.toMatchObject({ code: "VALIDATION" });

    const { token } = await createStoreInvite(storeId, NEW_OWNER, null);
    await expect(acceptStoreInvite(token, { name: "Dono", password: "curta" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "password" }] },
    });
    await expect(acceptStoreInvite(token, { name: "   ", password: "senha-forte-123" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "name" }] },
    });
    expect(await getInvite(token)).not.toBeNull();
  });

  it("link expirado, substituído ou malformado não vale", async () => {
    const past = new Date(Date.now() - 8 * 86_400_000);
    const expired = await createStoreInvite(storeId, NEW_OWNER, null, past);
    expect(await getInvite(expired.token)).toBeNull();

    const first = await createStoreInvite(storeId, NEW_OWNER, null);
    const second = await createStoreInvite(storeId, NEW_OWNER, null);
    expect(await getInvite(first.token)).toBeNull();
    expect(await getInvite(second.token)).not.toBeNull();

    expect(await getInvite("curto")).toBeNull();
    await expect(acceptStoreInvite("curto", { name: "X", password: "senha-forte-123" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
