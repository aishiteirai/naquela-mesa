import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "./errors";
import { imageUrlSchema, zodIssuesToDomainError } from "./validation";

describe("zodIssuesToDomainError", () => {
  it("converte issues do Zod em DomainError VALIDATION com caminho em texto", () => {
    const result = z.object({ theme: z.object({ primary: z.string().min(7, "curto") }) }).safeParse({ theme: { primary: "x" } });
    if (result.success) throw new Error("esperava falha");

    const error = zodIssuesToDomainError(result.error);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("VALIDATION");
    expect(error.details).toEqual({ issues: [{ path: "theme.primary", message: "curto" }] });
  });
});

describe("imageUrlSchema", () => {
  it.each(["https://cdn.exemplo.com/logo.png", "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp"])("aceita %s", (url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    "http://cdn.exemplo.com/logo.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/uploads/../.env",
    "/uploads/logo.png",
    "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.svg",
  ])("recusa %s", (url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(false);
  });
});
