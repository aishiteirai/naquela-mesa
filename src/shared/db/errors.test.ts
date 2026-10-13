import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors";

describe("isUniqueViolation", () => {
  it("reconhece erro do pg com code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("reconhece erro embrulhado em cause (Drizzle)", () => {
    expect(isUniqueViolation(new Error("query falhou", { cause: { code: "23505" } }))).toBe(true);
  });

  it.each([{ code: "23503" }, new Error("x"), null, undefined, "23505"])("false para %o", (error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
