import { describe, expect, it } from "vitest";
import { closedNotice } from "./closed-notice";

describe("closedNotice", () => {
  it("mensagem genérica não repete", () => {
    expect(closedNotice("Fechado no momento")).toBe("A loja está fechada agora.");
  });

  it("mensagem específica vai como complemento", () => {
    expect(closedNotice("Abrimos às 18:00")).toBe("A loja está fechada agora. Abrimos às 18:00");
  });
});
