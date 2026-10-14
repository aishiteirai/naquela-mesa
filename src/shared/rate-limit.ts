import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv } from "@/shared/env";
import { DomainError } from "@/shared/errors";

export type RateLimitPolicy = { name: string; limit: number; windowSec: number };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };
export interface RateLimiter {
  check(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult>;
}

export const RATE_LIMITS = {
  orderByIp: { name: "order-ip", limit: 10, windowSec: 600 },
  orderByPhone: { name: "order-phone", limit: 5, windowSec: 600 },
  quoteByIp: { name: "quote-ip", limit: 60, windowSec: 60 },
  inviteByIp: { name: "invite-ip", limit: 10, windowSec: 600 },
  uploadByUser: { name: "upload-user", limit: 30, windowSec: 600 },
} as const satisfies Record<string, RateLimitPolicy>;

/** Janela fixa em memória: só para desenvolvimento e testes (em serverless cada instância teria a sua). */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async check(policy, identifier) {
      const key = `${policy.name}:${identifier}`;
      const current = now();
      let window = windows.get(key);
      if (!window || current >= window.resetAt) {
        window = { count: 0, resetAt: current + policy.windowSec * 1000 };
        windows.set(key, window);
      }
      window.count += 1;
      if (window.count <= policy.limit) return { ok: true };
      return { ok: false, retryAfterSec: Math.ceil((window.resetAt - current) / 1000) };
    },
  };
}

export function createUpstashRateLimiter(url: string, token: string): RateLimiter {
  const redis = new Redis({ url, token });
  const limiters = new Map<string, Ratelimit>();
  return {
    async check(policy, identifier) {
      let limiter = limiters.get(policy.name);
      if (!limiter) {
        limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSec} s`), prefix: `nm:${policy.name}` });
        limiters.set(policy.name, limiter);
      }
      const result = await limiter.limit(identifier);
      if (result.success) return { ok: true };
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
    },
  };
}

const unlimited: RateLimiter = { check: async () => ({ ok: true }) };
let shared: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  const env = getEnv();
  if (env.E2E_DISABLE_RATE_LIMIT === "1") return unlimited;
  shared ??=
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? createUpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
      : createMemoryRateLimiter();
  return shared;
}

export async function enforceRateLimit(policy: RateLimitPolicy, identifier: string, limiter: RateLimiter = getRateLimiter()): Promise<void> {
  const result = await limiter.check(policy, identifier);
  if (!result.ok) throw new DomainError("RATE_LIMITED", { retryAfterSec: result.retryAfterSec });
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "desconhecido";
}
