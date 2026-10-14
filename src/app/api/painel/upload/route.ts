import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { MAX_IMAGE_BYTES, saveImage } from "@/modules/media";
import { getMembershipStoreId } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/shared/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };
const MULTIPART_OVERHEAD = 64 * 1024;

function reply(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply(401, { error: "Faça login de novo." });
  if (!(await getMembershipStoreId(user.id))) return reply(403, { error: "Sem acesso." });

  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return reply(411, { error: "Não foi possível enviar a imagem." });
  if (length > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD) return reply(413, { error: "a imagem deve ter até 5 MB" });

  try {
    await enforceRateLimit(RATE_LIMITS.uploadByUser, user.id);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return reply(400, { error: "Selecione uma imagem." });
    return reply(200, await saveImage(new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    if (isDomainError(error) && error.code === "RATE_LIMITED") return reply(429, { error: "Muitos envios. Aguarde alguns minutos." });
    if (isDomainError(error) && error.code === "VALIDATION") {
      const [issue] = (error.details.issues ?? []) as { message: string }[];
      return reply(400, { error: issue?.message ?? "Imagem inválida." });
    }
    throw error;
  }
}
