import { describe, expect, it } from "vitest";
import { isNavItemActive, pageTrail, PANEL_NAV } from "./nav";

describe("PANEL_NAV", () => {
  it("tem Pedidos em destaque seguido de Cardápio, Histórico e Métricas", () => {
    expect(PANEL_NAV.map((item) => [item.href, item.label, item.primary ?? false])).toEqual([
      ["/painel", "Pedidos", true],
      ["/painel/cardapio", "Cardápio", false],
      ["/painel/pedidos", "Histórico", false],
      ["/painel/metricas", "Métricas", false],
    ]);
  });
});

describe("isNavItemActive", () => {
  it.each([
    ["/painel", "/painel", true],
    ["/painel/pedidos", "/painel", false],
    ["/painel/pedidos", "/painel/pedidos", true],
    ["/painel/pedidos/abc", "/painel/pedidos", true],
    ["/painel/pedidosx", "/painel/pedidos", false],
    ["/painel/cardapio", "/painel/cardapio", true],
    ["/painel/cardapio/qualquer", "/painel/cardapio", true],
    ["/painel/cardapio/adicionais", "/painel/cardapio", true],
    ["/painel/metricas", "/painel/cardapio", false],
  ])("%s com item %s → %s", (pathname, href, expected) => {
    expect(isNavItemActive(pathname, href)).toBe(expected);
  });
});

describe("pageTrail", () => {
  it.each([
    ["/painel", ["Operação", "Pedidos"]],
    ["/painel/pedidos", ["Operação", "Histórico"]],
    ["/painel/metricas", ["Operação", "Métricas"]],
    ["/painel/cardapio", ["Cardápio"]],
    ["/painel/cardapio/adicionais", ["Cardápio"]],
    ["/painel/loja", ["Loja", "Configurações"]],
    ["/outro", []],
  ])("%s → %j", (pathname, expected) => {
    expect(pageTrail(pathname)).toEqual(expected);
  });
});
