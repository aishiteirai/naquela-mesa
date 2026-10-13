const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 5;

function readProperty(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current !== undefined; depth++) {
    if (readProperty(current, "code") === UNIQUE_VIOLATION) return true;
    current = readProperty(current, "cause");
  }
  return false;
}
