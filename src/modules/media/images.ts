import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { DomainError } from "@/shared/errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageType = "jpg" | "png" | "webp";

const CONTENT_TYPES: Record<ImageType, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** Tipo real pelo cabeçalho do arquivo (extensão e content-type do navegador não são confiáveis). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "uploads");
}

function invalidImage(message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path: "image", message }] });
}

export async function saveImage(bytes: Uint8Array): Promise<{ url: string }> {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw invalidImage("a imagem deve ter até 5 MB");
  const type = detectImageType(bytes);
  if (!type) throw invalidImage("envie uma imagem JPG, PNG ou WebP");

  const fileName = `${randomUUID()}.${type}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  // Store conectado ao projeto na Vercel autentica por OIDC (BLOB_STORE_ID + token do runtime), sem token fixo.
  if (token || process.env.BLOB_STORE_ID) {
    const blob = await put(`uploads/${fileName}`, Buffer.from(bytes), {
      access: "public",
      contentType: CONTENT_TYPES[type],
      addRandomSuffix: false,
      ...(token ? { token } : {}),
    });
    return { url: blob.url };
  }

  // Desenvolvimento: disco local, servido por /uploads/[file].
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), fileName), bytes);
  return { url: `/uploads/${fileName}` };
}

export async function readImage(fileName: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const match = FILE_NAME.exec(fileName);
  if (!match) return null;
  try {
    const bytes = await readFile(path.join(uploadDir(), fileName));
    return { bytes: new Uint8Array(bytes), contentType: CONTENT_TYPES[match[1] as ImageType] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
