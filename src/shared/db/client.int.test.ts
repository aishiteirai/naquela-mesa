import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "./client";

describe("db client", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("conecta no Postgres de teste", async () => {
    const result = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    expect(result.rows[0]?.ok).toBe(1);
  });

  it("usa UTC por padrão", async () => {
    const result = await db.execute<{ tz: string }>(sql`select current_setting('timezone') as tz`);
    expect(result.rows[0]?.tz).toBe("UTC");
  });
});
