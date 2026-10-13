/** Aceita só caminhos internos ("/..."); bloqueia URLs externas e "//host" (open redirect). */
export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
