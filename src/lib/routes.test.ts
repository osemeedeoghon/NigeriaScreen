import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAllFilmSlugs, getAllGenres, getFilmsByGenre, getGenreBySlug } from "./catalogue.ts";
import { databaseRoute, isKnownCatalogueRoute } from "./routes.ts";

describe("genre routes", () => {
  test("every genre slug is a valid route with films", () => {
    for (const genre of getAllGenres()) {
      assert.ok(isKnownCatalogueRoute(`/genres/${genre.slug}`), genre.slug);
      assert.equal(getGenreBySlug(genre.slug)?.id, genre.id);
      assert.ok(getFilmsByGenre(genre.id).length > 0, genre.slug);
    }
  });

  test("unknown, mis-cased and malformed genre slugs are rejected", () => {
    for (const path of ["/genres/western", "/genres/Drama", "/genres/drama%20", "/genres/%E0%A4%A"]) {
      assert.equal(isKnownCatalogueRoute(path), false, path);
    }
    assert.equal(getGenreBySlug("western"), undefined);
  });
});

describe("film routes", () => {
  test("every film slug is a valid route, with or without a trailing slash", () => {
    for (const slug of getAllFilmSlugs()) {
      assert.ok(isKnownCatalogueRoute(`/films/${slug}`), slug);
      assert.ok(isKnownCatalogueRoute(`/films/${slug}/`), slug);
    }
  });

  test("unknown film slugs are rejected", () => {
    assert.equal(isKnownCatalogueRoute("/films/not-a-real-film"), false);
  });

  test("other paths are left to the router", () => {
    for (const path of ["/", "/films", "/genres", "/films/kano-nights/cast", "/about"]) {
      assert.ok(isKnownCatalogueRoute(path), path);
    }
  });
});

describe("database-backed routes", () => {
  test("catalogue films never need a database lookup", () => {
    for (const slug of getAllFilmSlugs()) assert.equal(databaseRoute(`/films/${slug}`), null, slug);
  });

  test("other film, filmmaker and company slugs are looked up", () => {
    assert.deepEqual(databaseRoute("/films/a-new-film"), { kind: "film", slug: "a-new-film" });
    assert.deepEqual(databaseRoute("/filmmakers/ada-obi"), { kind: "filmmaker", slug: "ada-obi" });
    assert.deepEqual(databaseRoute("/companies/ada-films/"), { kind: "company", slug: "ada-films" });
  });

  test("malformed slugs and unrelated paths are not looked up", () => {
    for (const path of ["/filmmakers/Ada", "/companies/a%20b", "/films/%E0%A4%A", "/filmmakers", "/genres/drama", "/industry/filmmakers", "/filmmakers/a/b"]) {
      assert.equal(databaseRoute(path), null, path);
    }
  });
});
