import { describe, expect, it } from "vitest";
import { isSuperAdmin } from "./roles";

describe("isSuperAdmin", () => {
  it("true só para role super_admin", () => {
    expect(isSuperAdmin({ role: "super_admin" })).toBe(true);
  });

  it.each([{ role: "user" }, { role: null }, { role: "admin" }, null, undefined])("false para %o", (user) => {
    expect(isSuperAdmin(user)).toBe(false);
  });
});
