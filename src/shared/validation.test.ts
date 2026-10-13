import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "./errors";
import { zodIssuesToDomainError } from "./validation";

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
