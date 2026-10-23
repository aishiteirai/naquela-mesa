import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";
import { db } from "@/shared/db/client";

const NO_STORE = { "Cache-Control": "no-store" };

/** Para monitor de uptime: 200 com o banco respondendo, 503 sem detalhes caso contrário. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
