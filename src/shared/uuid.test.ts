import { afterEach, describe, expect, it } from "vitest";
import { uuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  const original = crypto.randomUUID;
  afterEach(() => {
    Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true, writable: true });
  });

  it("gera UUID v4", () => {
    expect(uuid()).toMatch(V4);
  });

  it("funciona sem crypto.randomUUID (contexto não seguro)", () => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true, writable: true });
    const a = uuid();
    const b = uuid();
    expect(a).toMatch(V4);
    expect(b).toMatch(V4);
    expect(a).not.toBe(b);
  });
});
