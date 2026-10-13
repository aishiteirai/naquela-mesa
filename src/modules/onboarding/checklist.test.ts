import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist } from "./checklist";

const empty = {
  logoUrl: null,
  hoursCount: 0,
  deliveryEnabled: true,
  deliveryFee: { strategy: "fixed" as const, fixedCents: 0 },
  zonesCount: 0,
  pixKey: null,
  productCount: 0,
};

describe("buildOnboardingChecklist", () => {
  it("loja recém-criada tem tudo pendente, na ordem", () => {
    const items = buildOnboardingChecklist(empty);
    expect(items.map((item) => [item.key, item.done])).toEqual([
      ["logo", false],
      ["hours", false],
      ["delivery", false],
      ["pix", false],
      ["menu", false],
    ]);
    expect(items[0]).toEqual({ key: "logo", label: "Enviar o logo da loja", done: false, href: "/painel/loja" });
    expect(items[4]?.href).toBe("/painel/cardapio");
  });

  it("marca cada item conforme a configuração", () => {
    const items = buildOnboardingChecklist({
      ...empty,
      logoUrl: "/uploads/logo.webp",
      hoursCount: 6,
      deliveryFee: { strategy: "fixed", fixedCents: 600 },
      pixKey: "pix@loja.com",
      productCount: 12,
    });
    expect(items.every((item) => item.done)).toBe(true);
  });

  it("entrega: bairros contam quando a taxa é por bairro; sem delivery não pede nada", () => {
    const byZone = { ...empty, deliveryFee: { strategy: "by_neighborhood" as const } };
    expect(buildOnboardingChecklist(byZone)[2]?.done).toBe(false);
    expect(buildOnboardingChecklist({ ...byZone, zonesCount: 3 })[2]?.done).toBe(true);
    expect(buildOnboardingChecklist({ ...empty, deliveryEnabled: false })[2]?.done).toBe(true);
  });
});
