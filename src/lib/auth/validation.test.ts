import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cleanLine,
  cleanMultiline,
  isCatalogueFilmId,
  validateEmail,
  validateNewPassword,
  validatePasswordChange,
  validateProfile,
  validateResetRequest,
  validateReview,
  validateSignIn,
  validateSignUp,
} from "./validation.ts";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const validSignUp = { displayName: "Ada", email: "ada@example.com", password: "naija2026", confirmPassword: "naija2026" };

describe("registration validation", () => {
  test("accepts valid details and normalises them", () => {
    const result = validateSignUp(form({ ...validSignUp, displayName: "  Ada   Obi ", email: " Ada@Example.COM " }));
    assert.deepEqual(result, { ok: true, data: { displayName: "Ada Obi", email: "ada@example.com", password: "naija2026" } });
  });

  test("reports every missing field", () => {
    const result = validateSignUp(form({}));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["displayName", "email", "password"]);
  });

  test("rejects bad emails", () => {
    for (const email of ["ada", "ada@", "@example.com", "ada@example", "ada @example.com", `${"a".repeat(250)}@example.com`]) {
      assert.ok(validateEmail(email), email);
    }
    assert.equal(validateEmail("ada.obi+films@mail.example.ng"), undefined);
  });

  test("enforces password rules", () => {
    assert.match(validateNewPassword("") ?? "", /Choose/);
    assert.match(validateNewPassword("short1") ?? "", /at least 8/);
    assert.match(validateNewPassword("allletters") ?? "", /letter and one number/);
    assert.match(validateNewPassword("12345678") ?? "", /letter and one number/);
    assert.match(validateNewPassword("a1".repeat(40)) ?? "", /72/);
    assert.equal(validateNewPassword("naija2026"), undefined);
  });

  test("requires matching passwords", () => {
    const result = validateSignUp(form({ ...validSignUp, confirmPassword: "naija2027" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errors.confirmPassword, "Passwords do not match.");
  });

  test("caps the display name and strips control characters", () => {
    const result = validateSignUp(form({ ...validSignUp, displayName: "x".repeat(51) }));
    assert.equal(result.ok, false);
    assert.equal(cleanLine("Ada\u0000\u0007 Obi"), "Ada Obi");
  });
});

describe("login validation", () => {
  test("needs an email and a password", () => {
    const result = validateSignIn(form({ email: "", password: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.email);
      assert.equal(result.errors.password, "Enter your password.");
    }
  });

  test("does not apply new-password rules to existing passwords", () => {
    assert.deepEqual(validateSignIn(form({ email: "ADA@example.com", password: "old" })), {
      ok: true,
      data: { email: "ada@example.com", password: "old" },
    });
  });

  test("password reset and change", () => {
    assert.equal(validateResetRequest(form({ email: "nope" })).ok, false);
    assert.equal(validateResetRequest(form({ email: "ada@example.com" })).ok, true);
    assert.equal(validatePasswordChange(form({ password: "naija2026", confirmPassword: "naija2026" })).ok, true);
    assert.equal(validatePasswordChange(form({ password: "naija2026", confirmPassword: "" })).ok, false);
  });
});

describe("profile validation", () => {
  test("normalises username and allows empty optional fields", () => {
    assert.deepEqual(validateProfile(form({ displayName: "Ada", username: "@Ada_Obi", avatarUrl: "" })), {
      ok: true,
      data: { displayName: "Ada", username: "ada_obi", avatarUrl: null },
    });
    assert.deepEqual(validateProfile(form({ displayName: "Ada", username: "", avatarUrl: "" })), {
      ok: true,
      data: { displayName: "Ada", username: null, avatarUrl: null },
    });
  });

  test("rejects bad usernames and non-https images", () => {
    for (const username of ["ab", "has space", "way_too_long_username_here", "émile"]) {
      const result = validateProfile(form({ displayName: "Ada", username }));
      assert.equal(result.ok, false, username);
    }
    for (const avatarUrl of ["http://example.com/a.jpg", "javascript:alert(1)", "not a url", `https://example.com/${"a".repeat(500)}`]) {
      const result = validateProfile(form({ displayName: "Ada", avatarUrl }));
      assert.equal(result.ok, false, avatarUrl);
    }
  });
});

describe("review validation", () => {
  test("accepts a rating with or without text", () => {
    assert.deepEqual(validateReview(form({ rating: "4", body: "" })), { ok: true, data: { rating: 4, body: null } });
    assert.deepEqual(validateReview(form({ rating: "5", body: "  Loved it.\n\n\n\nGo see it.  " })), {
      ok: true,
      data: { rating: 5, body: "Loved it.\n\nGo see it." },
    });
  });

  test("rejects missing, fractional and out-of-range ratings", () => {
    for (const rating of ["", "0", "6", "3.5", "four", "-1"]) {
      assert.equal(validateReview(form({ rating })).ok, false, rating);
    }
  });

  test("caps review length and removes control characters", () => {
    assert.equal(validateReview(form({ rating: "3", body: "a".repeat(2001) })).ok, false);
    assert.equal(cleanMultiline("Good\u0000 film\r\nreally"), "Good film\nreally");
  });

  test("text is kept as plain text, not interpreted", () => {
    const result = validateReview(form({ rating: "3", body: "<script>alert(1)</script>" }));
    assert.deepEqual(result, { ok: true, data: { rating: 3, body: "<script>alert(1)</script>" } });
  });
});

describe("film ids", () => {
  test("only catalogue film ids may be stored", () => {
    assert.equal(isCatalogueFilmId("film-harmattan-letters"), true);
    for (const value of ["harmattan-letters", "film-not-real", "", null, 7, "film-harmattan-letters'; drop table reviews;--"]) {
      assert.equal(isCatalogueFilmId(value), false, String(value));
    }
  });
});
