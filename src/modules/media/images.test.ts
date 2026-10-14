import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { detectImageType, MAX_IMAGE_BYTES, readImage, saveImage } from "./images";

const put = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({ put }));

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);
const TEXT = new TextEncoder().encode("isto não é uma imagem");

describe("detectImageType", () => {
  it.each([
    [PNG, "png"],
    [JPG, "jpg"],
    [WEBP, "webp"],
    [TEXT, null],
    [new Uint8Array([0xff]), null],
  ])("detecta pelos bytes", (bytes, type) => {
    expect(detectImageType(bytes)).toBe(type);
  });
});

describe("saveImage com Vercel Blob", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalStoreId = process.env.BLOB_STORE_ID;

  beforeEach(() => {
    put.mockReset();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    if (originalStoreId === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = originalStoreId;
  });

  it("com só BLOB_STORE_ID (store conectado por OIDC) envia ao Blob sem token explícito", async () => {
    process.env.BLOB_STORE_ID = "store_abc";
    put.mockResolvedValueOnce({ url: "https://abc.public.blob.vercel-storage.com/uploads/y.webp" });

    const result = await saveImage(WEBP);

    expect(result).toEqual({ url: "https://abc.public.blob.vercel-storage.com/uploads/y.webp" });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^uploads\/[0-9a-f-]{36}\.webp$/), expect.any(Buffer), {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
    });
  });

  it("envia ao Blob quando há token e devolve a URL pública", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teste";
    put.mockResolvedValueOnce({ url: "https://abc.public.blob.vercel-storage.com/uploads/x.png" });

    const result = await saveImage(PNG);

    expect(result).toEqual({ url: "https://abc.public.blob.vercel-storage.com/uploads/x.png" });
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^uploads\/[0-9a-f-]{36}\.png$/),
      expect.any(Buffer),
      { access: "public", contentType: "image/png", addRandomSuffix: false, token: "vercel_blob_rw_teste" },
    );
  });

  it("valida antes de enviar", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teste";
    put.mockClear();
    await expect(saveImage(TEXT)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(put).not.toHaveBeenCalled();
  });
});

describe("saveImage / readImage", () => {
  let dir: string;
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalStoreId = process.env.BLOB_STORE_ID;

  beforeAll(async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    dir = await mkdtemp(path.join(tmpdir(), "naquela-uploads-"));
    process.env.UPLOAD_DIR = dir;
  });

  afterAll(async () => {
    if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
    if (originalStoreId === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = originalStoreId;
    delete process.env.UPLOAD_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("grava e lê de volta com content-type", async () => {
    const { url } = await saveImage(PNG);
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);

    const image = await readImage(url.replace("/uploads/", ""));
    expect(image?.contentType).toBe("image/png");
    expect(Array.from(image!.bytes)).toEqual(Array.from(PNG));
  });

  it("recusa texto disfarçado e arquivo grande demais", async () => {
    await expect(saveImage(TEXT)).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "image" }] } });
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(JPG);
    await expect(saveImage(huge)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["../.env", "..%2F.env", "3f2504e0-4f89-41d3-9a0c-0305e82c3301.svg", "logo.png"])("readImage recusa %s", async (name) => {
    expect(await readImage(name)).toBeNull();
  });

  it("readImage de arquivo inexistente devolve null", async () => {
    expect(await readImage("3f2504e0-4f89-41d3-9a0c-0305e82c3301.png")).toBeNull();
  });
});
