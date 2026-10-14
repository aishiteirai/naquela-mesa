const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * O pg já trata prefer/require/verify-ca como verify-full e imprime um aviso de segurança a cada conexão.
 * Deixa explícito o verify-full (mesmo comportamento, sem o aviso). URLs locais sem sslmode não mudam.
 */
export function withExplicitSslMode(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const mode = url.searchParams.get("sslmode");
  if (!mode || !LEGACY_SSL_MODES.has(mode) || url.searchParams.has("uselibpqcompat")) return connectionString;
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
