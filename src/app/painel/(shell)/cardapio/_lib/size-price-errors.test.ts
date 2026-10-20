import { describe, expect, it } from "vitest";
import { success } from "@/app/_lib/action-state";
import { mapSizePriceErrors } from "./size-price-errors";

describe("mapSizePriceErrors", () => {
  const sizes = [{ sizeId: "broto" }, { sizeId: "grande" }];

  it("aponta o erro do índice para o campo do tamanho", () => {
    const state = { status: "error" as const, message: "Confira os campos destacados.", fieldErrors: { "sizePrices.1.priceCents": "preço acima do limite", name: "obrigatório" } };
    expect(mapSizePriceErrors(state, sizes)).toEqual({
      ...state,
      fieldErrors: { "price:grande": "preço acima do limite", name: "obrigatório" },
    });
  });

  it("mantém a chave quando o índice não existe e não mexe em sucesso", () => {
    const state = { status: "error" as const, message: "x", fieldErrors: { "sizePrices.9.priceCents": "y" } };
    expect(mapSizePriceErrors(state, sizes)).toEqual(state);
    expect(mapSizePriceErrors(success("ok"), sizes)).toEqual(success("ok"));
  });
});
