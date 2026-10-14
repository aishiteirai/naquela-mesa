import { describe, expect, it, vi } from "vitest";
import { phoneRateLimitKey } from "./rate-limit-key";

// O barrel do módulo abre o banco; o teste só precisa da normalização.
vi.mock("@/modules/orders", () => import("@/modules/orders/phone"));

const body = (phone: unknown) => ({ customer: { phone } });

describe("phoneRateLimitKey", () => {
  it("normaliza grafias diferentes para a mesma chave", () => {
    expect(phoneRateLimitKey(body("(11) 98888-7777"))).toBe("+5511988887777");
    expect(phoneRateLimitKey(body("+55 11 98888-7777"))).toBe("+5511988887777");
  });
  it("aceita números internacionais curtos", () => {
    expect(phoneRateLimitKey(body("+1 2345678"))).toBe("+12345678");
  });
  it("devolve null se ausente ou inválido", () => {
    expect(phoneRateLimitKey(body("abc"))).toBeNull();
    expect(phoneRateLimitKey(body(42))).toBeNull();
    expect(phoneRateLimitKey({})).toBeNull();
    expect(phoneRateLimitKey(null)).toBeNull();
  });
});
