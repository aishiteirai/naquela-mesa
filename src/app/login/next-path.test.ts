import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each(["/painel", "/painel/loja?aba=horarios", "/admin", "/%2F%2Fevil.com"])("aceita caminho interno %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, "", "painel", "https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com"])(
    "recusa %s",
    (value) => {
      expect(safeNextPath(value)).toBeNull();
    },
  );
});
