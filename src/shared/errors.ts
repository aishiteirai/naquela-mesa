export const DOMAIN_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "STORE_CLOSED",
  "ITEM_UNAVAILABLE",
  "PRICE_CHANGED",
  "BELOW_MIN_ORDER",
  "ZONE_NOT_SERVED",
  "INVALID_OPTIONS",
  "FULFILLMENT_DISABLED",
  "PAYMENT_DISABLED",
  "INVALID_TRANSITION",
  "RATE_LIMITED",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: DomainErrorCode, details: Record<string, unknown> = {}, message?: string) {
    super(message ?? code);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
