import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/shared/db/client";
import { auth } from "./auth";
import { user } from "./schema";
import { deleteUserByEmail, ensureSuperAdmin, ensureUser, findUserByEmail, getUserEmails, setUserPassword } from "./users";

const input = { email: "  Admin@Exemplo.com ", password: "senha-forte-123", name: "Admin" };

afterAll(async () => {
  await pool.end();
});

describe("ensureSuperAdmin", () => {
  beforeEach(async () => {
    await db.delete(user);
  });

  it("cria super_admin com email normalizado que consegue entrar", async () => {
    const result = await ensureSuperAdmin(input);

    expect(result.created).toBe(true);
    const [row] = await db.select().from(user).where(eq(user.id, result.id));
    expect(row?.email).toBe("admin@exemplo.com");
    expect(row?.role).toBe("super_admin");

    const signIn = await auth.api.signInEmail({
      body: { email: "admin@exemplo.com", password: "senha-forte-123" },
    });
    expect(signIn.user.id).toBe(result.id);
  });

  it("recusa senha errada", async () => {
    await ensureSuperAdmin(input);
    await expect(
      auth.api.signInEmail({ body: { email: "admin@exemplo.com", password: "senha-errada-123" } }),
    ).rejects.toThrow();
  });

  it("recusa email inexistente", async () => {
    await expect(
      auth.api.signInEmail({ body: { email: "ninguem@exemplo.com", password: "senha-forte-123" } }),
    ).rejects.toThrow();
  });

  it("é idempotente e promove usuário existente", async () => {
    const first = await ensureSuperAdmin(input);
    await db.update(user).set({ role: "user" }).where(eq(user.id, first.id));

    const second = await ensureSuperAdmin(input);

    expect(second).toEqual({ id: first.id, created: false });
    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("super_admin");
  });
});

describe("ensureUser", () => {
  beforeEach(async () => {
    await db.delete(user);
  });

  it("cria usuário comum (sem papel de admin) e é idempotente", async () => {
    const first = await ensureUser({ email: " Dono@Loja.com ", password: "senha-forte-123", name: "Dono" });
    const second = await ensureUser({ email: "dono@loja.com", password: "outra-senha-123", name: "Dono" });

    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    const [row] = await db.select().from(user).where(eq(user.id, first.id));
    expect(row?.email).toBe("dono@loja.com");
    expect(row?.role).not.toBe("super_admin");

    const signIn = await auth.api.signInEmail({ body: { email: "dono@loja.com", password: "senha-forte-123" } });
    expect(signIn.user.id).toBe(first.id);
  });
});

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hash = found?.accounts.find((account) => account.providerId === "credential")?.password;
  return hash ? ctx.password.verify({ hash, password }) : false;
}

describe("usuários", () => {
  it("acha por email normalizado, troca senha, lista emails e apaga", async () => {
    await deleteUserByEmail("troca-senha@exemplo.com");
    const created = await ensureUser({ email: "troca-senha@exemplo.com", password: "senha-antiga-1", name: "Teste" });

    expect(await findUserByEmail("  TROCA-SENHA@exemplo.com ")).toEqual({ id: created.id, name: "Teste" });
    expect(await findUserByEmail("ninguem@exemplo.com")).toBeNull();

    const ctx = await auth.$context;
    await ctx.internalAdapter.createSession(created.id);
    expect(await ctx.internalAdapter.listSessions(created.id)).toHaveLength(1);

    await setUserPassword(created.id, "senha-nova-123");
    expect(await ctx.internalAdapter.listSessions(created.id)).toHaveLength(0);
    expect(await passwordWorks("troca-senha@exemplo.com", "senha-nova-123")).toBe(true);
    expect(await passwordWorks("troca-senha@exemplo.com", "senha-antiga-1")).toBe(false);

    expect(await getUserEmails([created.id])).toEqual(new Map([[created.id, "troca-senha@exemplo.com"]]));
    expect(await getUserEmails([])).toEqual(new Map());

    expect(await deleteUserByEmail("troca-senha@exemplo.com")).toBe(true);
    expect(await findUserByEmail("troca-senha@exemplo.com")).toBeNull();
  });
});
