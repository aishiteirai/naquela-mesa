import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectImageType, MAX_IMAGE_BYTES, readImage, saveImage } from "./images";

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

describe("saveImage / readImage", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "naquela-uploads-"));
    process.env.UPLOAD_DIR = dir;
  });

  afterAll(async () => {
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
