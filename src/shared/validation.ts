import { z } from "zod";
import { DomainError } from "./errors";

export function zodIssuesToDomainError(error: z.ZodError): DomainError {
  return new DomainError("VALIDATION", {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

export const UPLOAD_PATH_PATTERN = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export const imageUrlSchema = z.union([z.url({ protocol: /^https$/ }), z.string().regex(UPLOAD_PATH_PATTERN)], {
  error: "imagem deve ser um endereço https ou um arquivo enviado",
});
