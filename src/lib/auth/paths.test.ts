import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isGuestOnlyPath, isProtectedPath, loginHref, safeNextPath, signupHref } from "./paths.ts";

describe("protected routes", () => {
  test("every account page needs a signed-in user", () => {
    for (const path of ["/account", "/account/watchlist", "/account/watched", "/account/update-password", "/admin", "/admin/viewing", "/admin/viewing/kano-nights"]) {
      assert.ok(isProtectedPath(path), path);
    }
  });

  test("public pages stay public", () => {
    for (const path of ["/", "/films", "/films/kano-nights", "/genres/drama", "/login", "/signup", "/accounts", "/accountant", "/administrator", "/films/admin"]) {
      assert.equal(isProtectedPath(path), false, path);
    }
  });

  test("sign-in pages are guest only", () => {
    for (const path of ["/login", "/signup", "/forgot-password"]) assert.ok(isGuestOnlyPath(path), path);
    assert.equal(isGuestOnlyPath("/account"), false);
  });
});

describe("safeNextPath", () => {
  test("keeps same-site paths with their query string", () => {
    assert.equal(safeNextPath("/films/kano-nights"), "/films/kano-nights");
    assert.equal(safeNextPath("/films?genre=drama&q=love"), "/films?genre=drama&q=love");
    assert.equal(safeNextPath("/account/watchlist"), "/account/watchlist");
  });

  test("blocks open redirects and odd input", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "films",
      "/fi\nlms",
      "",
      null,
      undefined,
      42,
      "/" + "a".repeat(400),
    ]) {
      assert.equal(safeNextPath(value), "/account", String(value));
    }
  });

  test("never sends a user back to a sign-in page", () => {
    assert.equal(safeNextPath("/login"), "/account");
    assert.equal(safeNextPath("/signup?next=/films"), "/account");
  });

  test("uses the given fallback", () => {
    assert.equal(safeNextPath("https://evil.example", "/"), "/");
  });
});

describe("sign-in links", () => {
  test("carry a safe return path", () => {
    assert.equal(loginHref("/films/kano-nights"), "/login?next=%2Ffilms%2Fkano-nights");
    assert.equal(signupHref("/films?q=love"), "/signup?next=%2Ffilms%3Fq%3Dlove");
  });

  test("drop unsafe or missing return paths", () => {
    assert.equal(loginHref("https://evil.example"), "/login");
    assert.equal(loginHref(), "/login");
    assert.equal(signupHref("//evil.example"), "/signup");
  });
});
