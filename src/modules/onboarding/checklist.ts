export type ChecklistKey = "logo" | "hours" | "delivery" | "pix" | "menu";
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean; href: string };

export type ChecklistInput = {
  logoUrl: string | null;
  hoursCount: number;
  deliveryEnabled: boolean;
  deliveryFee: { strategy: "fixed"; fixedCents: number } | { strategy: "by_neighborhood" };
  zonesCount: number;
  pixKey: string | null;
  productCount: number;
};

export function buildOnboardingChecklist(input: ChecklistInput): ChecklistItem[] {
  const deliveryDone =
    !input.deliveryEnabled ||
    (input.deliveryFee.strategy === "fixed" ? input.deliveryFee.fixedCents > 0 : input.zonesCount > 0);

  return [
    { key: "logo", label: "Enviar o logo da loja", done: input.logoUrl !== null, href: "/painel/loja" },
    { key: "hours", label: "Cadastrar os horários de funcionamento", done: input.hoursCount > 0, href: "/painel/loja" },
    { key: "delivery", label: "Definir a taxa de entrega ou os bairros atendidos", done: deliveryDone, href: "/painel/loja" },
    { key: "pix", label: "Cadastrar a chave Pix", done: input.pixKey !== null, href: "/painel/loja" },
    { key: "menu", label: "Conferir o cardápio e os preços", done: input.productCount > 0, href: "/painel/cardapio" },
  ];
}
