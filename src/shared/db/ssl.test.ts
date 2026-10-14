import { describe, expect, it } from "vitest";
import { withExplicitSslMode } from "./ssl";

describe("withExplicitSslMode", () => {
  it("troca prefer/require/verify-ca por verify-full (o pg já trata assim, só para de avisar)", () => {
    for (const mode of ["prefer", "require", "verify-ca"]) {
      const url = withExplicitSslMode(`postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/db?sslmode=${mode}&channel_binding=require`);
      expect(new URL(url).searchParams.get("sslmode")).toBe("verify-full");
      expect(new URL(url).searchParams.get("channel_binding")).toBe("require");
    }
  });

  it("mantém URLs sem sslmode, com verify-full, disable ou uselibpqcompat", () => {
    const local = "postgres://naquela:naquela@localhost:5434/naquela_mesa";
    expect(withExplicitSslMode(local)).toBe(local);
    for (const url of [
      "postgresql://u:p@host/db?sslmode=verify-full",
      "postgresql://u:p@host/db?sslmode=disable",
      "postgresql://u:p@host/db?uselibpqcompat=true&sslmode=require",
    ]) {
      expect(withExplicitSslMode(url)).toBe(url);
    }
  });

  it("devolve texto que não é URL sem mexer", () => {
    expect(withExplicitSslMode("")).toBe("");
  });
});
