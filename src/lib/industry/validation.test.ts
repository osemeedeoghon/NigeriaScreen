import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  intentOf,
  parseFilmography,
  parseLinkLines,
  parseViewingLinks,
  validateApplication,
  validateCompany,
  validateFilmmakerProfile,
  validatePromotion,
  validatePublishSlug,
  validateSubmission,
} from "./validation.ts";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};

const application = {
  accountType: "filmmaker",
  professionalName: "  Ada   Obi ",
  professionalRole: "director",
  biography: "Director of short films in Lagos since 2015.",
  country: "ng",
  city: "Lagos",
  portfolioLinks: "https://ada.example/reel\nhttps://ada.example/reel",
};

describe("filmmaker onboarding", () => {
  test("a complete application can be submitted, normalised", () => {
    const result = validateApplication(form(application), "submit");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.professionalName, "Ada Obi");
      assert.equal(result.data.country, "NG");
      assert.deepEqual(result.data.portfolioLinks, ["https://ada.example/reel"]);
      assert.equal(result.data.status, "pending_review");
      assert.equal(result.data.companyName, null);
    }
  });

  test("drafts may be incomplete; submitting needs a biography and country", () => {
    const partial = form({ professionalName: "Ada", professionalRole: "actor" });
    assert.equal(validateApplication(partial, "draft").ok, true);
    const submitted = validateApplication(partial, "submit");
    assert.equal(submitted.ok, false);
    if (!submitted.ok) assert.deepEqual(Object.keys(submitted.errors).sort(), ["biography", "country"]);
  });

  test("company applications need a company name", () => {
    const result = validateApplication(form({ ...application, accountType: "company" }), "submit");
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.companyName);
  });

  test("rejects unknown roles, account types, countries and unsafe links", () => {
    const result = validateApplication(
      form({ ...application, accountType: "admin", professionalRole: "boss", country: "XX", portfolioLinks: "javascript:alert(1)" }),
      "submit",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["accountType", "country", "portfolioLinks", "professionalRole"]);
  });

  test("the intent button decides draft or submit; anything else is a draft", () => {
    assert.equal(intentOf(form({ intent: "submit" })), "submit");
    assert.equal(intentOf(form({ intent: "approve" })), "draft");
    assert.equal(intentOf(form({})), "draft");
  });
});

describe("filmmaker profiles", () => {
  test("builds a slug from the name and parses filmography lines", () => {
    const result = validateFilmmakerProfile(
      form({
        professionalName: "Chiamaka Ndukwe-Obi",
        professionalRole: "actor",
        expertise: "Period drama, Stage combat, Period drama",
        languages: ["ig", "en"],
        filmography: "Red Earth Rising | 2024 | Lead\nThird Mainland | 2025 | Supporting",
        visibility: "public",
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.slug, "chiamaka-ndukwe-obi");
      assert.deepEqual(result.data.expertise, ["Period drama", "Stage combat"]);
      assert.deepEqual(result.data.filmography, [
        { title: "Red Earth Rising", year: 2024, role: "Lead" },
        { title: "Third Mainland", year: 2025, role: "Supporting" },
      ]);
      assert.equal(result.data.visibility, "public");
    }
  });

  test("defaults to private and rejects bad slugs, languages and links", () => {
    const result = validateFilmmakerProfile(
      form({ professionalName: "Ada", professionalRole: "editor", slug: "Ada Obi!", languages: ["zz"], avatarUrl: "http://ada.example/me.jpg", socialLinks: "data:x" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["avatarUrl", "languages", "slug", "socialLinks"]);
    const ok = validateFilmmakerProfile(form({ professionalName: "Ada", professionalRole: "editor" }));
    assert.equal(ok.ok && ok.data.visibility, "private");
  });

  test("filmography lines must be Title | Year | Role", () => {
    assert.ok(parseFilmography("Just a title").error);
    assert.ok(parseFilmography("Film | 1890 | Actor").error);
    assert.ok(parseFilmography("Film | 2020 |").error);
    assert.deepEqual(parseFilmography("").entries, []);
  });
});

describe("production companies", () => {
  test("validates public contact details and requires a description to submit", () => {
    const base = { name: "Ada Films", description: "Lagos production house making drama.", country: "NG" };
    assert.equal(validateCompany(form(base), "submit").ok, true);
    const bad = validateCompany(form({ ...base, description: "Short", publicEmail: "not-an-email", publicPhone: "call me" }), "submit");
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["description", "publicEmail", "publicPhone"]);
  });
});

describe("company public email (audit fix)", () => {
  test("mailto parameters and encoded characters are refused", () => {
    const base = { name: "Ada Films" };
    for (const publicEmail of ["info@co.ng?cc=victim%40x.com", "info@co.ng&body=hi", "a b@co.ng", "info@co"]) {
      const result = validateCompany(form({ ...base, publicEmail }), "draft");
      assert.equal(result.ok, false, publicEmail);
    }
    assert.equal(validateCompany(form({ ...base, publicEmail: "Info@Small-Films.com.ng" }), "draft").ok, true);
  });
});

describe("film submission validation", () => {
  const complete = {
    title: "A New Film",
    synopsis: "A spoiler-free synopsis that is long enough.",
    releaseYear: "2026",
    runtimeMinutes: "95",
    genres: ["drama", "romance"],
    language: "yo",
    country: "NG",
    director: "Ada Obi",
    producers: "Bayo Ade\nChi Eze",
    castNames: "One Actor, Two Actor",
    trailerUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    viewingLinks: "Official site | https://film.example/watch",
    rightsConfirmed: "on",
  };

  test("a complete submission with confirmed rights can be submitted", () => {
    const result = validateSubmission(form(complete), "submit", new Set());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.producers, ["Bayo Ade", "Chi Eze"]);
      assert.deepEqual(result.data.viewingLinks, [{ label: "Official site", url: "https://film.example/watch" }]);
      assert.equal(result.data.status, "pending_review");
    }
  });

  test("submitting without the rights confirmation is refused; a draft is allowed", () => {
    const noRights: Record<string, string | string[]> = { ...complete };
    delete noRights.rightsConfirmed;
    const submitted = validateSubmission(form(noRights), "submit", new Set());
    assert.equal(submitted.ok, false);
    if (!submitted.ok) assert.match(submitted.errors.rightsConfirmed ?? "", /rights/);
    assert.equal(validateSubmission(form(noRights), "draft", new Set()).ok, true);
  });

  test("a draft needs only a title", () => {
    assert.equal(validateSubmission(form({ title: "Working title" }), "draft", new Set()).ok, true);
    assert.equal(validateSubmission(form({}), "draft", new Set()).ok, false);
  });

  test("rejects unsafe URLs, unknown genres, bad numbers and companies the user isn't in", () => {
    const result = validateSubmission(
      form({
        ...complete,
        trailerUrl: "javascript:alert(1)",
        posterUrl: "file:///poster.jpg",
        websiteUrl: "http://film.example",
        viewingLinks: "Pirate | ftp://stream.example",
        genres: ["drama", "western"],
        releaseYear: "1800",
        runtimeMinutes: "ninety",
        companyId: "11111111-1111-4111-8111-111111111111",
      }),
      "submit",
      new Set(["22222222-2222-4222-8222-222222222222"]),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(Object.keys(result.errors).sort(), ["companyId", "genres", "posterUrl", "releaseYear", "runtimeMinutes", "trailerUrl", "viewingLinks", "websiteUrl"]);
    }
  });

  test("viewing links need a label and an https URL", () => {
    assert.ok(parseViewingLinks("https://no-label.example").error);
    assert.ok(parseViewingLinks("Label | http://insecure.example").error);
    assert.equal(parseViewingLinks(Array.from({ length: 11 }, (_, i) => `P${i} | https://p${i}.example`).join("\n")).error, "Add at most 10 viewing links.");
    assert.deepEqual(parseLinkLines("", 5), { links: [] });
  });

  test("an approved film's address must not reuse a catalogue film's", () => {
    assert.deepEqual(validatePublishSlug("a-new-film"), { ok: true, slug: "a-new-film" });
    assert.equal(validatePublishSlug("kano-nights").ok, false);
    assert.equal(validatePublishSlug("Bad Slug").ok, false);
  });
});

describe("promotion requests", () => {
  const films = new Set(["film-a-new-film"]);
  const base = { filmId: "film-a-new-film", placement: "new_release_spotlight", startsOn: "2026-11-10", endsOn: "2026-11-30" };
  const today = "2026-11-05";

  test("accepts a request for the requester's own approved film", () => {
    assert.deepEqual(validatePromotion(form(base), films, today), {
      ok: true,
      data: { filmId: "film-a-new-film", placement: "new_release_spotlight", genre: null, startsOn: "2026-11-10", endsOn: "2026-11-30", message: null },
    });
  });

  test("only the requester's approved films may be promoted", () => {
    const result = validatePromotion(form({ ...base, filmId: "film-kano-nights" }), films, today);
    assert.equal(result.ok, false);
  });

  test("dates must be in order, not in the past, and at most 90 days", () => {
    const check = (startsOn: string, endsOn: string) => validatePromotion(form({ ...base, startsOn, endsOn }), films, today).ok;
    assert.equal(check("2026-11-01", "2026-11-10"), false);
    assert.equal(check("2026-11-20", "2026-11-10"), false);
    assert.equal(check("2026-11-10", "2027-03-01"), false);
    assert.equal(check("2026-11-05", "2026-11-05"), true);
  });

  test("genre spotlights need a genre; unknown placements are refused", () => {
    assert.equal(validatePromotion(form({ ...base, placement: "genre_spotlight" }), films, today).ok, false);
    assert.equal(validatePromotion(form({ ...base, placement: "genre_spotlight", genre: "drama" }), films, today).ok, true);
    assert.equal(validatePromotion(form({ ...base, placement: "paid_banner" }), films, today).ok, false);
  });
});
