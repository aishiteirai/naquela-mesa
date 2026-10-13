/** Aceita só caminhos internos ("/..."); bloqueia URLs externas, "//host", caracteres de controle e "\" (open redirect). */
export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  const base = "http://internal.invalid";
  if (new URL(value, base).origin !== base) return null;
  return value;
}
