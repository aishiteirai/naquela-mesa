import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://naquela:naquela@localhost:5434/naquela_mesa",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("aceita ambiente válido", () => {
    expect(parseEnv(valid)).toMatchObject(valid);
  });

  it("aceita E2E_DISABLE_RATE_LIMIT=1 e recusa outros valores", () => {
    expect(parseEnv({ ...valid, E2E_DISABLE_RATE_LIMIT: "1" }).E2E_DISABLE_RATE_LIMIT).toBe("1");
    expect(() => parseEnv({ ...valid, E2E_DISABLE_RATE_LIMIT: "true" })).toThrow(/E2E_DISABLE_RATE_LIMIT/);
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

  it("aplica padrões e converte lista de origens", () => {
    const env = parseEnv({ ...valid, BETTER_AUTH_TRUSTED_ORIGINS: "https://a.vercel.app, https://b.vercel.app ,", DATABASE_POOL_MAX: "3" });
    expect(env.BETTER_AUTH_TRUSTED_ORIGINS).toEqual(["https://a.vercel.app", "https://b.vercel.app"]);
    expect(env.DATABASE_POOL_MAX).toBe(3);
    expect(parseEnv(valid).DATABASE_POOL_MAX).toBe(10);
    expect(parseEnv(valid).BETTER_AUTH_TRUSTED_ORIGINS).toEqual([]);
    expect(() => parseEnv({ ...valid, DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
  });

  it("exige URL e token do Upstash juntos", () => {
    expect(() => parseEnv({ ...valid, UPSTASH_REDIS_REST_URL: "https://x.upstash.io" })).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("em produção exige Upstash e Blob e proíbe o atalho do E2E", () => {
    const production = {
      ...valid,
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    };
    expect(parseEnv(production).VERCEL_ENV).toBe("production");

    const noRedis: Record<string, string> = { ...production };
    delete noRedis.UPSTASH_REDIS_REST_URL;
    delete noRedis.UPSTASH_REDIS_REST_TOKEN;
    expect(() => parseEnv(noRedis)).toThrow(/UPSTASH_REDIS_REST_URL/);

    const noBlob: Record<string, string> = { ...production };
    delete noBlob.BLOB_READ_WRITE_TOKEN;
    expect(() => parseEnv(noBlob)).toThrow(/BLOB_READ_WRITE_TOKEN/);

    expect(() => parseEnv({ ...production, E2E_DISABLE_RATE_LIMIT: "1" })).toThrow(/E2E_DISABLE_RATE_LIMIT/);
    // Preview pode rodar sem Blob/Upstash (cai no disco/memória).
    expect(parseEnv({ ...valid, VERCEL_ENV: "preview" }).VERCEL_ENV).toBe("preview");
  });
});
