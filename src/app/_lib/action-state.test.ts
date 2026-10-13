import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/errors";
import { actionError, fieldError, success } from "./action-state";

describe("action-state", () => {
  it("VALIDATION vira erros por campo", () => {
    const error = new DomainError("VALIDATION", {
      issues: [
        { path: "name", message: "informe o nome" },
        { path: "sizePrices.0.priceCents", message: "preço inválido" },
      ],
    });
    expect(actionError(error)).toEqual({
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { name: "informe o nome", "sizePrices.0.priceCents": "preço inválido" },
    });
  });

  it("NOT_FOUND vira mensagem genérica", () => {
    expect(actionError(new DomainError("NOT_FOUND"))).toEqual({
      status: "error",
      message: "Item não encontrado.",
      fieldErrors: {},
    });
  });

  it("outros erros são relançados", () => {
    expect(() => actionError(new Error("banco caiu"))).toThrow("banco caiu");
  });

  it("helpers de sucesso e erro de campo", () => {
    expect(success("Salvo.")).toEqual({ status: "success", message: "Salvo." });
    expect(fieldError("price", "preço inválido")).toEqual({
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: { price: "preço inválido" },
    });
  });
});
