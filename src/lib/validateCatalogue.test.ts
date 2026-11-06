import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogueInput } from "./validateCatalogue.ts";
import { validateCatalogue } from "./validateCatalogue.ts";
import { featuredPersonIds, trendingFilmIds } from "../data/collections.ts";
import { credits } from "../data/credits.ts";
import { filmRecords } from "../data/films.ts";
import { genres } from "../data/genres.ts";
import { people } from "../data/people.ts";

const real: CatalogueInput = { films: filmRecords, genres, people, credits, trendingFilmIds, featuredPersonIds };

/** A copy of the real catalogue with one part replaced, so each test breaks exactly one thing. */
const withChange = (change: Partial<CatalogueInput>): CatalogueInput => ({ ...real, ...change });
const firstFilm = filmRecords[0];
const expectIssue = (input: CatalogueInput, pattern: RegExp) => {
  const issues = validateCatalogue(input);
  assert.ok(issues.some((issue) => pattern.test(issue)), `Expected an issue matching ${pattern}, got:\n${issues.join("\n")}`);
};

describe("sample catalogue", () => {
  test("passes every integrity check", () => {
    assert.deepEqual(validateCatalogue(real), []);
  });

  test("has the agreed size", () => {
    assert.equal(filmRecords.length, 25);
    assert.equal(genres.length, 8);
    assert.equal(people.length, 20);
  });

  test("covers English, Yoruba, Igbo and Hausa", () => {
    const languages = new Set(filmRecords.map((film) => film.language));
    for (const language of ["English", "Yoruba", "Igbo", "Hausa"]) assert.ok(languages.has(language as never), language);
  });

  test("marks every film and person as fictional", () => {
    assert.ok(filmRecords.every((film) => film.isFictional === true));
    assert.ok(people.every((person) => person.isFictional === true));
  });

  test("credits every person at least once", () => {
    const credited = new Set(credits.map((credit) => credit.personId));
    assert.deepEqual(people.filter((person) => !credited.has(person.id)).map((p) => p.id), []);
  });

  test("contains no viewing destinations or trailer links", () => {
    // Where to watch and trailers live in Supabase (Stage 5), never in the fictional catalogue.
    for (const film of filmRecords) {
      assert.ok(!/https?:\/\//.test(JSON.stringify(film)), film.id);
    }
  });

  test("uses no generic placeholder titles or names", () => {
    const placeholder = /^(film|movie|actor|director|person|genre)\s*\d+$/i;
    assert.ok(filmRecords.every((film) => !placeholder.test(film.title)));
    assert.ok(people.every((person) => !placeholder.test(person.name)));
  });
});

describe("validateCatalogue detects", () => {
  test("duplicate film IDs", () => {
    expectIssue(withChange({ films: [...filmRecords, { ...firstFilm, slug: "another-slug" }] }), /Duplicate film id/);
  });

  test("duplicate slugs", () => {
    expectIssue(withChange({ films: [...filmRecords, { ...firstFilm, id: "film-copy" }] }), /Duplicate film slug/);
  });

  test("missing genre references", () => {
    expectIssue(withChange({ films: [{ ...firstFilm, genreIds: ["genre-missing"] }, ...filmRecords.slice(1)] }), /unknown genre reference genre-missing/);
  });

  test("missing actor references", () => {
    const bad = { filmId: firstFilm.id, personId: "person-missing", role: "actor" as const, characterName: "Ghost" };
    expectIssue(withChange({ credits: [...credits, bad] }), /unknown actor reference person-missing/);
  });

  test("missing director references", () => {
    const bad = { filmId: firstFilm.id, personId: "person-missing", role: "director" as const };
    expectIssue(withChange({ credits: [...credits, bad] }), /unknown director reference person-missing/);
  });

  test("films with no director", () => {
    const withoutDirector = credits.filter((c) => !(c.filmId === firstFilm.id && c.role === "director"));
    expectIssue(withChange({ credits: withoutDirector }), /has no director/);
  });

  test("credits pointing at unknown films", () => {
    expectIssue(withChange({ credits: [...credits, { ...credits[0], filmId: "film-missing" }] }), /unknown film reference film-missing/);
  });

  test("roles that contradict a person's profession", () => {
    const actorOnly = people.find((p) => p.profession === "actor")!;
    expectIssue(withChange({ credits: [...credits, { filmId: firstFilm.id, personId: actorOnly.id, role: "director" }] }), /profession is actor/);
  });

  for (const year of [1899, 2099, 2024.5, Number.NaN]) {
    test(`invalid release year ${year}`, () => {
      expectIssue(withChange({ films: [{ ...firstFilm, releaseYear: year }, ...filmRecords.slice(1)] }), /invalid release year/);
    });
  }

  for (const runtime of [0, -10, 12, 600, 95.5]) {
    test(`invalid runtime ${runtime}`, () => {
      expectIssue(withChange({ films: [{ ...firstFilm, runtimeMinutes: runtime }, ...filmRecords.slice(1)] }), /invalid runtime/);
    });
  }

  for (const field of ["title", "synopsis", "slug", "country"] as const) {
    test(`missing required field "${field}"`, () => {
      expectIssue(withChange({ films: [{ ...firstFilm, [field]: "" }, ...filmRecords.slice(1)] }), new RegExp(`missing required field "${field}"`));
    });
  }

  test("films with no genres", () => {
    expectIssue(withChange({ films: [{ ...firstFilm, genreIds: [] }, ...filmRecords.slice(1)] }), /at least one genre/);
  });

  test("badly formatted slugs", () => {
    expectIssue(withChange({ films: [{ ...firstFilm, slug: "Harmattan Letters!" }, ...filmRecords.slice(1)] }), /invalid slug/);
    expectIssue(withChange({ films: [{ ...firstFilm, id: "Harmattan_Letters" }, ...filmRecords.slice(1)] }), /invalid id format/);
    expectIssue(withChange({ films: [{ ...firstFilm, slug: "harmattan" }, ...filmRecords.slice(1)] }), /id must be "film-harmattan"/);
  });

  test("unknown IDs in curated lists", () => {
    expectIssue(withChange({ trendingFilmIds: ["film-missing"] }), /Trending list: unknown film/);
  });
});
