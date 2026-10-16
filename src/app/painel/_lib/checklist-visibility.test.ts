import { describe, expect, it } from "vitest";
import { shouldShowChecklist } from "./checklist-visibility";

describe("shouldShowChecklist", () => {
  it("mostra quando nunca foi fechado", () => {
    expect(shouldShowChecklist({ sessionId: "s1", dismissedFor: null, pending: 2 })).toBe(true);
  });

  it("esconde quando fechado nesta sessão", () => {
    expect(shouldShowChecklist({ sessionId: "s1", dismissedFor: "s1", pending: 2 })).toBe(false);
  });

  it("volta numa sessão nova", () => {
    expect(shouldShowChecklist({ sessionId: "s2", dismissedFor: "s1", pending: 2 })).toBe(true);
  });

  it("some quando tudo concluído", () => {
    expect(shouldShowChecklist({ sessionId: "s2", dismissedFor: null, pending: 0 })).toBe(false);
  });
});
