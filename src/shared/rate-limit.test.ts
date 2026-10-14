import { afterEach, describe, expect, it } from "vitest";
import { clientIp, createMemoryRateLimiter, enforceRateLimit, type RateLimitPolicy } from "./rate-limit";

const policy: RateLimitPolicy = { name: "teste", limit: 2, windowSec: 60 };

describe("createMemoryRateLimiter", () => {
  it("libera até o limite, bloqueia depois e reabre na janela seguinte", async () => {
    let now = 1_000_000;
    const limiter = createMemoryRateLimiter(() => now);

    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: false, retryAfterSec: 60 });
    expect(await limiter.check(policy, "ip-2")).toEqual({ ok: true });

    now += 30_000;
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: false, retryAfterSec: 30 });
    now += 30_000;
    expect(await limiter.check(policy, "ip-1")).toEqual({ ok: true });
  });

  it("separa políticas com o mesmo identificador", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    const other: RateLimitPolicy = { name: "outra", limit: 1, windowSec: 60 };
    await limiter.check(policy, "x");
    await limiter.check(policy, "x");
    expect(await limiter.check(other, "x")).toEqual({ ok: true });
  });
});

describe("enforceRateLimit", () => {
  afterEach(() => {
    delete process.env.E2E_DISABLE_RATE_LIMIT;
  });

  it("lança RATE_LIMITED com o tempo de espera", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    await enforceRateLimit(policy, "y", limiter);
    await enforceRateLimit(policy, "y", limiter);
    await expect(enforceRateLimit(policy, "y", limiter)).rejects.toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSec: 60 } });
  });
});

describe("clientIp", () => {
  it("usa o primeiro x-forwarded-for, depois x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("desconhecido");
  });
});
