import type { z } from "zod";
import { DomainError } from "./errors";

export function zodIssuesToDomainError(error: z.ZodError): DomainError {
  return new DomainError("VALIDATION", {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}
