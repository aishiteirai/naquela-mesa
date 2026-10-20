import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/errors";
import { CONNECTION_ERROR, actionError, fieldError, success, withConnectionError } from "./action-state";

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

describe("withConnectionError", () => {
  it("devolve o resultado da action", async () => {
    await expect(withConnectionError(async () => success("ok"))()).resolves.toEqual(success("ok"));
  });

  it("transforma falha (rede, servidor fora) em estado de erro", async () => {
    const failing = withConnectionError(async (_prev: unknown) => {
      throw new TypeError("Failed to fetch");
    });
    await expect(failing(null)).resolves.toEqual({ status: "error", message: CONNECTION_ERROR, fieldErrors: {} });
  });
});
