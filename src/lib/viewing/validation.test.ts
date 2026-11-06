import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  checkHttpsUrl,
  isAccessType,
  isKnownFilmId,
  isVerificationStatus,
  parseCountryList,
  parseLanguageList,
  slugify,
  validateProvider,
  validateTrailer,
  validateViewingOption,
} from "./validation.ts";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const PROVIDER = "11111111-1111-4111-8111-111111111111";
const context = { providerIds: new Set([PROVIDER]) };
const validOption = {
  filmId: "film-kano-nights",
  providerId: PROVIDER,
  destinationUrl: "https://provider.example/films/kano-nights",
  accessType: "rental",
  countries: "ng, GH gb",
  audioLanguages: "ha en",
  subtitleLanguages: "en",
  availabilityNotes: "",
};

describe("destination URL safety", () => {
  test("accepts and normalises public https links", () => {
    assert.deepEqual(checkHttpsUrl("  https://Provider.Example/watch?id=1 "), { ok: true, url: "https://provider.example/watch?id=1" });
    assert.deepEqual(checkHttpsUrl("https://provider.example"), { ok: true, url: "https://provider.example/" });
  });

  test("rejects unsafe and non-https schemes", () => {
    for (const value of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "http://provider.example",
      "ftp://provider.example",
      "vbscript:msgbox(1)",
      "blob:https://provider.example/1",
      "//provider.example/path",
      "provider.example/path",
    ]) {
      assert.equal(checkHttpsUrl(value).ok, false, value);
    }
  });

  test("rejects credentials, local or numeric hosts, whitespace and control characters", () => {
    for (const value of [
      "https://user:pass@provider.example/",
      "https://user@provider.example/",
      "https://localhost/film",
      "https://intranet/film",
      "https://127.0.0.1/film",
      "https://[::1]/film",
      "https://printer.local/film",
      "https://provider.example/a b",
      "https://provider.example/\u0000",
      "",
      `https://provider.example/${"a".repeat(2001)}`,
    ]) {
      assert.equal(checkHttpsUrl(value).ok, false, JSON.stringify(value));
    }
  });
});

describe("countries and languages", () => {
  test("country codes are normalised, deduplicated and checked against ISO 3166-1", () => {
    assert.deepEqual(parseCountryList("ng, GH;gb  NG"), { codes: ["NG", "GH", "GB"], invalid: [] });
    assert.deepEqual(parseCountryList("NG, UK, XX, nigeria"), { codes: ["NG"], invalid: ["UK", "XX", "NIGERIA"] });
    assert.deepEqual(parseCountryList(""), { codes: [], invalid: [] });
  });

  test("language codes must be known ISO 639 codes", () => {
    assert.deepEqual(parseLanguageList("EN, yo ig ha pcm ijc"), { codes: ["en", "yo", "ig", "ha", "pcm", "ijc"], invalid: [] });
    assert.deepEqual(parseLanguageList("english, zz, e"), { codes: [], invalid: ["english", "zz", "e"] });
  });

  test("access types and verification statuses", () => {
    for (const type of ["subscription", "free", "free_with_ads", "rental", "purchase", "other"]) assert.ok(isAccessType(type), type);
    for (const type of ["Free", "stream", "", null, 1]) assert.equal(isAccessType(type), false, String(type));
    for (const status of ["pending", "verified", "rejected", "expired"]) assert.ok(isVerificationStatus(status), status);
    for (const status of ["unverified", "approved", "VERIFIED", ""]) assert.equal(isVerificationStatus(status), false, status);
  });

  test("film references must exist in the catalogue", () => {
    assert.ok(isKnownFilmId("film-kano-nights"));
    for (const id of ["kano-nights", "film-not-real", "", null]) assert.equal(isKnownFilmId(id), false, String(id));
  });
});

describe("viewing option validation", () => {
  test("a complete option passes and is normalised", () => {
    const result = validateViewingOption(form(validOption), context);
    assert.deepEqual(result, {
      ok: true,
      data: {
        filmId: "film-kano-nights",
        providerId: PROVIDER,
        destinationUrl: "https://provider.example/films/kano-nights",
        accessType: "rental",
        countries: ["NG", "GH", "GB"],
        audioLanguages: ["ha", "en"],
        subtitleLanguages: ["en"],
        availabilityNotes: null,
      },
    });
  });

  test("each bad field is reported", () => {
    const result = validateViewingOption(
      form({ ...validOption, filmId: "film-fake", providerId: "nope", accessType: "stream", destinationUrl: "javascript:alert(1)", countries: "UK", audioLanguages: "xx" }),
      context,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(Object.keys(result.errors).sort(), ["accessType", "audioLanguages", "countries", "destinationUrl", "filmId", "providerId"]);
    }
  });

  test("at least one checked country is required, so nothing implies worldwide availability", () => {
    const result = validateViewingOption(form({ ...validOption, countries: "" }), context);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.countries ?? "", /at least one country/);
  });

  test("duplicates of an existing option are caught before saving", () => {
    const existing = [{ id: "a", providerId: PROVIDER, accessType: "rental", destinationUrl: "https://provider.example/films/kano-nights" }];
    const duplicate = validateViewingOption(form(validOption), { ...context, existing });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.match(duplicate.errors.destinationUrl ?? "", /already has this link/);
    // A different access type for the same link is allowed.
    assert.equal(validateViewingOption(form({ ...validOption, accessType: "purchase" }), { ...context, existing }).ok, true);
    // Editing the same record is not a duplicate of itself.
    assert.equal(validateViewingOption(form(validOption), { ...context, existing, editingId: "a" }).ok, true);
  });
});

describe("provider validation", () => {
  test("makes a slug from the name and checks links", () => {
    const result = validateProvider(form({ name: "  Ọ̀run Films  ", websiteUrl: "https://provider.example", logoUrl: "", description: "" }));
    assert.deepEqual(result, {
      ok: true,
      data: { name: "Ọ̀run Films", slug: "orun-films", websiteUrl: "https://provider.example/", logoUrl: null, description: null },
    });
  });

  test("rejects unsafe website and logo links", () => {
    const result = validateProvider(form({ name: "X", websiteUrl: "http://provider.example", logoUrl: "data:image/png;base64,AAA" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["logoUrl", "websiteUrl"]);
  });

  test("slugify", () => {
    assert.equal(slugify("Naija Stream+ (Official)"), "naija-stream-official");
    assert.equal(slugify("---"), "");
  });
});

describe("trailer validation", () => {
  test("accepts YouTube and Vimeo links and keeps only provider and id", () => {
    const result = validateTrailer(form({ filmId: "film-kano-nights", title: "Official trailer", videoUrl: "https://youtu.be/dQw4w9WgXcQ?t=10" }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.video, { provider: "youtube", videoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
      assert.equal(result.data.embeddable, true);
    }
  });

  test("rejects other hosts, bad dates and unknown films", () => {
    const result = validateTrailer(form({ filmId: "film-fake", title: "", videoUrl: "https://evil.example/embed/x", publishedOn: "2025-02-30" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["filmId", "publishedOn", "title", "videoUrl"]);
  });

  test("embedding can be switched off for link-only trailers", () => {
    const result = validateTrailer(form({ filmId: "film-kano-nights", title: "Teaser", videoUrl: "https://vimeo.com/123456789", embeddable: "off" }));
    assert.equal(result.ok && result.data.embeddable, false);
  });
});
