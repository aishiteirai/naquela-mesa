import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { dropExpectedErrors } from "./sentry-filter";

const event = { message: "x" };

describe("dropExpectedErrors", () => {
  it("descarta erros de domínio e controles de navegação do Next", () => {
    expect(dropExpectedErrors(event, { originalException: new DomainError("STORE_CLOSED") })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("r"), { digest: "NEXT_REDIRECT;replace;/login;307;" }) })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("n"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }) })).toBeNull();
    expect(dropExpectedErrors(event, { originalException: Object.assign(new Error("nf"), { digest: "NEXT_NOT_FOUND" }) })).toBeNull();
  });

  it("mantém erros inesperados", () => {
    expect(dropExpectedErrors(event, { originalException: new Error("boom") })).toBe(event);
    expect(dropExpectedErrors(event, {})).toBe(event);
  });
});
