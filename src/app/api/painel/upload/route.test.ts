import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/errors";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getMembershipStoreId = vi.hoisted(() => vi.fn());
const saveImage = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth", () => ({ getCurrentUser }));
vi.mock("@/modules/stores", () => ({ getMembershipStoreId }));
vi.mock("@/modules/media", () => ({ saveImage, MAX_IMAGE_BYTES: 5 * 1024 * 1024 }));
vi.mock("@/shared/rate-limit", () => ({ enforceRateLimit, RATE_LIMITS: { uploadByUser: { name: "upload-user" } } }));

import { POST } from "./route";

function makeRequest(options: { withFile?: boolean; contentLength?: string | null } = {}): Request {
  const { withFile = true, contentLength = "1000" } = options;
  const form = new FormData();
  if (withFile) form.set("file", new File([new Uint8Array([1, 2, 3])], "imagem"));
  const headers = new Headers();
  if (contentLength !== null) headers.set("content-length", contentLength);
  return new Request("http://localhost/api/painel/upload", { method: "POST", body: form, headers });
}

async function expectReply(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(body);
}

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "u1" });
  getMembershipStoreId.mockResolvedValue("s1");
  enforceRateLimit.mockResolvedValue(undefined);
});

describe("POST /api/painel/upload", () => {
  it("401 sem sessão", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expectReply(await POST(makeRequest()), 401, { error: "Faça login de novo." });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("403 sem loja", async () => {
    getMembershipStoreId.mockResolvedValue(null);
    await expectReply(await POST(makeRequest()), 403, { error: "Sem acesso." });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("413 com content-length acima do limite", async () => {
    const tooBig = String(5 * 1024 * 1024 + 64 * 1024 + 1);
    await expectReply(await POST(makeRequest({ contentLength: tooBig })), 413, { error: "a imagem deve ter até 5 MB" });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it.each([null, "abc", "0"])("411 com content-length ausente ou inválido (%s)", async (contentLength) => {
    await expectReply(await POST(makeRequest({ contentLength })), 411, { error: "Não foi possível enviar a imagem." });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("400 sem arquivo", async () => {
    await expectReply(await POST(makeRequest({ withFile: false })), 400, { error: "Selecione uma imagem." });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("400 com a mensagem de VALIDATION do domínio", async () => {
    saveImage.mockRejectedValue(new DomainError("VALIDATION", { issues: [{ path: "image", message: "envie uma imagem JPG, PNG ou WebP" }] }));
    await expectReply(await POST(makeRequest()), 400, { error: "envie uma imagem JPG, PNG ou WebP" });
  });

  it("429 quando o limite estoura", async () => {
    enforceRateLimit.mockRejectedValue(new DomainError("RATE_LIMITED"));
    await expectReply(await POST(makeRequest()), 429, { error: "Muitos envios. Aguarde alguns minutos." });
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("200 com a URL", async () => {
    saveImage.mockResolvedValue({ url: "/uploads/x.png" });
    await expectReply(await POST(makeRequest()), 200, { url: "/uploads/x.png" });
    expect(enforceRateLimit).toHaveBeenCalledWith({ name: "upload-user" }, "u1");
  });
});
