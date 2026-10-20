import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./login-error";

describe("loginErrorMessage", () => {
  it("credencial errada", () => {
    expect(loginErrorMessage(401)).toBe("Email ou senha inválidos.");
    expect(loginErrorMessage(400)).toBe("Email ou senha inválidos.");
  });
  it("muitas tentativas", () => {
    expect(loginErrorMessage(429)).toBe("Muitas tentativas. Tente novamente em instantes.");
  });
  it("servidor fora ou sem rede não culpa a senha", () => {
    expect(loginErrorMessage(500)).toBe("Não foi possível entrar agora. Tente de novo em instantes.");
    expect(loginErrorMessage(undefined)).toBe("Não foi possível entrar agora. Tente de novo em instantes.");
  });
});
