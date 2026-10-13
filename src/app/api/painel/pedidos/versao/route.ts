import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getQueueVersion } from "@/modules/orders";
import { getMembershipStoreId } from "@/modules/stores";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  const storeId = await getMembershipStoreId(user.id);
  if (!storeId) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  return NextResponse.json(await getQueueVersion(storeId), { headers: NO_STORE });
}
