import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://naquela:naquela@localhost:5434/naquela_mesa",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("aceita ambiente válido", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("nomeia a variável ausente", () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.DATABASE_URL;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("exige segredo com pelo menos 32 caracteres", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "curto" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejeita URL inválida", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: "localhost" })).toThrow(/BETTER_AUTH_URL/);
  });
});
