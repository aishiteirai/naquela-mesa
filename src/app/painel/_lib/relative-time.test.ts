import { describe, expect, it } from "vitest";
import { minutesAgo } from "./relative-time";

const now = new Date("2026-10-16T20:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("minutesAgo", () => {
  it.each([
    [0, "agora"],
    [59, "agora"],
    [180, "há 3 min"],
    [59 * 60, "há 59 min"],
    [60 * 60, "há 1 h"],
    [2 * 3600 + 5 * 60, "há 2 h"],
  ])("%is → %s", (seconds, expected) => {
    expect(minutesAgo(ago(seconds), now)).toBe(expected);
  });
  it("data no futuro vira agora", () => {
    expect(minutesAgo(ago(-30), now)).toBe("agora");
  });
});
