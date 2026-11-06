import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isAdminRole } from "./roles.ts";

describe("admin role check", () => {
  test("only the exact admin role grants admin access", () => {
    assert.equal(isAdminRole("admin"), true);
    for (const role of ["viewer", "Admin", "ADMIN", "admin ", "", null, undefined, true, 1, { role: "admin" }]) {
      assert.equal(isAdminRole(role), false, String(role));
    }
  });
});
