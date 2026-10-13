import { describe, expect, it } from "vitest";
import { normalizeBrazilPhone } from "./phone";

describe("normalizeBrazilPhone", () => {
  it.each([
    ["(11) 98888-7777", "+5511988887777"],
    ["11 3333-4444", "+551133334444"],
    ["+55 11 98888-7777", "+5511988887777"],
    ["5511988887777", "+5511988887777"],
    ["+1 415 555 0100", "+14155550100"],
    ["011 98888-7777", "+5511988887777"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it.each(["", "123", "abc", "98888-7777", "+55", "+55 98888-7777"])("recusa %s", (input) => {
    expect(normalizeBrazilPhone(input)).toBeNull();
  });
});
