import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./nav";

describe("isNavItemActive", () => {
  it.each([
    ["/painel", "/painel", true],
    ["/painel/pedidos", "/painel", false],
    ["/painel/pedidos", "/painel/pedidos", true],
    ["/painel/pedidos/abc", "/painel/pedidos", true],
    ["/painel/pedidosx", "/painel/pedidos", false],
    ["/painel/cardapio", "/painel/cardapio", true],
    ["/painel/cardapio/adicionais", "/painel/cardapio", false],
    ["/painel/cardapio/adicionais", "/painel/cardapio/adicionais", true],
    ["/painel/loja", "/painel/loja", true],
    ["/painel/metricas", "/painel/loja", false],
  ])("%s com item %s → %s", (pathname, href, expected) => {
    expect(isNavItemActive(pathname, href)).toBe(expected);
  });
});
