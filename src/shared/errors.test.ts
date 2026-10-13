import { describe, expect, it } from "vitest";
import { DomainError, isDomainError } from "./errors";

describe("DomainError", () => {
  it("carrega code e details", () => {
    const error = new DomainError("BELOW_MIN_ORDER", { minOrderCents: 3000 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
    expect(error.code).toBe("BELOW_MIN_ORDER");
    expect(error.details).toEqual({ minOrderCents: 3000 });
    expect(error.message).toBe("BELOW_MIN_ORDER");
  });

  it("aceita mensagem própria e details vazio por padrão", () => {
    const error = new DomainError("NOT_FOUND", undefined, "Loja não encontrada");
    expect(error.details).toEqual({});
    expect(error.message).toBe("Loja não encontrada");
  });

  it("isDomainError distingue erros comuns", () => {
    expect(isDomainError(new DomainError("FORBIDDEN"))).toBe(true);
    expect(isDomainError(new Error("x"))).toBe(false);
    expect(isDomainError("FORBIDDEN")).toBe(false);
  });
});
