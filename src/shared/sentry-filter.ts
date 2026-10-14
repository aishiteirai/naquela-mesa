import { isDomainError } from "./errors";

const NEXT_CONTROL_DIGESTS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

/** beforeSend do Sentry: erros esperados (regra de negócio, redirect/notFound do Next) não são incidentes. */
export function dropExpectedErrors<T>(event: T, hint: { originalException?: unknown }): T | null {
  const error = hint.originalException;
  if (isDomainError(error)) return null;
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  if (typeof digest === "string" && NEXT_CONTROL_DIGESTS.some((prefix) => digest.startsWith(prefix))) return null;
  return event;
}
