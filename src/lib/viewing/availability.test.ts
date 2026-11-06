import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FilmViewingOption } from "../../types/viewing.ts";
import { ACCESS_LABELS, confirmedOptions, coveredCountries, filterByCountry, summariseCountries } from "./availability.ts";

let next = 0;
function option(overrides: Partial<FilmViewingOption> = {}): FilmViewingOption {
  next += 1;
  return {
    id: `option-${next}`,
    filmId: "film-kano-nights",
    provider: { id: "p1", name: "Test Provider", slug: "test-provider", logoUrl: null, isActive: true },
    destinationUrl: `https://provider.example/${next}`,
    accessType: "subscription",
    countries: ["NG"],
    audioLanguages: [],
    subtitleLanguages: [],
    availabilityNotes: null,
    verificationStatus: "verified",
    verifiedAt: "2026-11-01T00:00:00Z",
    lastCheckedAt: "2026-11-01T00:00:00Z",
    isActive: true,
    ...overrides,
  };
}

describe("confirmed options", () => {
  test("only active, verified options from active providers are shown", () => {
    const shown = option();
    const hidden = [
      option({ verificationStatus: "pending" }),
      option({ verificationStatus: "rejected" }),
      option({ verificationStatus: "expired" }),
      option({ isActive: false }),
      option({ provider: { id: "p2", name: "Gone", slug: "gone", logoUrl: null, isActive: false } }),
    ];
    assert.deepEqual(confirmedOptions([...hidden, shown]).map((o) => o.id), [shown.id]);
  });

  test("an empty list stays empty", () => {
    assert.deepEqual(confirmedOptions([]), []);
    assert.deepEqual(coveredCountries([]), []);
  });

  test("free options come first, then subscription, rental and purchase", () => {
    const list = ["purchase", "rental", "subscription", "free_with_ads", "free", "other"].map((accessType) =>
      option({ accessType: accessType as FilmViewingOption["accessType"] }),
    );
    assert.deepEqual(confirmedOptions(list).map((o) => o.accessType), ["free", "free_with_ads", "subscription", "rental", "purchase", "other"]);
  });
});

describe("country filtering", () => {
  const ng = option({ countries: ["NG"] });
  const ngGh = option({ countries: ["NG", "GH"] });
  const gb = option({ countries: ["GB"] });

  test("filters to options verified for the chosen country", () => {
    assert.deepEqual(filterByCountry([ng, ngGh, gb], "GH").map((o) => o.id), [ngGh.id]);
    assert.deepEqual(filterByCountry([ng, ngGh, gb], "NG").map((o) => o.id), [ng.id, ngGh.id]);
  });

  test("no selection shows every option; an uncovered country shows none", () => {
    assert.equal(filterByCountry([ng, ngGh, gb], null).length, 3);
    assert.deepEqual(filterByCountry([ng, ngGh, gb], "US"), []);
  });

  test("lists covered countries by name", () => {
    assert.deepEqual(coveredCountries([ng, ngGh, gb]), [
      { code: "GH", name: "Ghana" },
      { code: "NG", name: "Nigeria" },
      { code: "GB", name: "United Kingdom" },
    ]);
  });

  test("summarises long country lists without claiming worldwide availability", () => {
    assert.equal(summariseCountries(["NG"]), "Nigeria");
    assert.equal(summariseCountries(["NG", "GH"]), "Nigeria and Ghana");
    assert.equal(summariseCountries(["NG", "GH", "GB", "US", "CA"]), "Nigeria, Ghana, United Kingdom and 2 more");
  });
});

describe("access types", () => {
  test("each access type has a label and a clear action", () => {
    assert.equal(ACCESS_LABELS.subscription.action, "Watch now");
    assert.equal(ACCESS_LABELS.rental.action, "Rent");
    assert.equal(ACCESS_LABELS.purchase.action, "Buy");
    assert.equal(ACCESS_LABELS.free_with_ads.label, "Free with ads");
    assert.equal(Object.keys(ACCESS_LABELS).length, 6);
  });
});
