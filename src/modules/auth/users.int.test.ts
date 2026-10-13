import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/shared/db/client";
import { auth } from "./auth";
import { user } from "./schema";
import { ensureSuperAdmin } from "./users";

const input = { email: "  Admin@Exemplo.com ", password: "senha-forte-123", name: "Admin" };

describe("ensureSuperAdmin", () => {
  beforeEach(async () => {
    await db.delete(user);
  });

  afterAll(async () => {
    await pool.end();
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
