import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getAllFilms,
  getAllFilmSlugs,
  getAllGenres,
  getFeaturedFilms,
  getFeaturedPeople,
  getFilmActors,
  getFilmById,
  getFilmBySlug,
  getFilmDirectors,
  getFilmGenres,
  getFilmsByGenre,
  getFilmsByPerson,
  getGenreById,
  getGenreBySlug,
  getPersonById,
  getTrendingFilms,
} from "./catalogue.ts";

describe("film lookups", () => {
  test("getAllFilms returns all 25 films with derived credits", () => {
    const films = getAllFilms();
    assert.equal(films.length, 25);
    assert.ok(films.every((film) => film.actorIds.length > 0 && film.directorIds.length > 0));
  });

  test("getFilmById finds a film and returns undefined for unknown IDs", () => {
    assert.equal(getFilmById("film-third-mainland")?.title, "Third Mainland");
    assert.equal(getFilmById("film-does-not-exist"), undefined);
    assert.equal(getFilmById(""), undefined);
  });

  test("getFilmBySlug finds a film and returns undefined for unknown slugs", () => {
    assert.equal(getFilmBySlug("kano-nights")?.id, "film-kano-nights");
    assert.equal(getFilmBySlug("not-a-real-film"), undefined);
  });

  test("getFeaturedFilms returns only featured films", () => {
    const featured = getFeaturedFilms();
    assert.ok(featured.length > 0);
    assert.ok(featured.every((film) => film.featured));
  });

  test("getTrendingFilms resolves the curated order", () => {
    const trending = getTrendingFilms();
    assert.equal(trending.length, 10);
    assert.equal(trending[0].id, "film-third-mainland");
  });
});

describe("genre lookups", () => {
  test("getAllGenres returns the eight genres", () => {
    assert.deepEqual(
      getAllGenres().map((genre) => genre.slug),
      ["drama", "romance", "comedy", "thriller", "action", "family", "historical", "crime"],
    );
  });

  test("getGenreById and getGenreBySlug handle unknown values", () => {
    assert.equal(getGenreById("genre-crime")?.name, "Crime");
    assert.equal(getGenreById("genre-western"), undefined);
    assert.equal(getGenreBySlug("action")?.id, "genre-action");
    assert.equal(getGenreBySlug("western"), undefined);
  });

  test("getFilmsByGenre returns tagged films and an empty list for unknown genres", () => {
    const historical = getFilmsByGenre("genre-historical");
    assert.ok(historical.length >= 3);
    assert.ok(historical.every((film) => film.genreIds.includes("genre-historical")));
    assert.deepEqual(getFilmsByGenre("genre-missing"), []);
  });

  test("every genre has at least one film", () => {
    for (const genre of getAllGenres()) assert.ok(getFilmsByGenre(genre.id).length > 0, genre.name);
  });

  test("getFilmGenres resolves a film's genres in order", () => {
    const film = getFilmBySlug("okada-express")!;
    assert.deepEqual(getFilmGenres(film).map((g) => g.name), ["Action", "Comedy"]);
  });
});

describe("people lookups", () => {
  test("getPersonById handles unknown IDs", () => {
    assert.equal(getPersonById("person-zainab-musa-lawal")?.profession, "director");
    assert.equal(getPersonById("person-nobody"), undefined);
  });

  test("getFilmActors returns cast with character names", () => {
    const cast = getFilmActors("film-harmattan-letters");
    assert.deepEqual(
      cast.map((member) => [member.person.name, member.characterName]),
      [
        ["Ifeoma Adebanjo-Eze", "Hauwa Sani"],
        ["Aminu Garba-Lawson", "Malam Bashir"],
      ],
    );
    assert.deepEqual(getFilmActors("film-missing"), []);
  });

  test("getFilmDirectors returns directors and an empty list for unknown films", () => {
    assert.deepEqual(getFilmDirectors("film-kano-nights").map((p) => p.name), ["Zainab Musa-Lawal"]);
    assert.deepEqual(getFilmDirectors("film-missing"), []);
  });

  test("actor-directors can appear in both roles on one film", () => {
    const film = getFilmBySlug("port-harcourt-blues")!;
    assert.ok(film.actorIds.includes("person-tamuno-briggs-alagoa"));
    assert.ok(film.directorIds.includes("person-tamuno-briggs-alagoa"));
  });

  test("getFilmsByPerson lists a person's films newest first", () => {
    const films = getFilmsByPerson("person-zainab-musa-lawal");
    assert.equal(films.length, 4);
    assert.ok(films.every((film, i) => i === 0 || films[i - 1].releaseYear >= film.releaseYear));
    assert.deepEqual(getFilmsByPerson("person-nobody"), []);
  });

  test("getFeaturedPeople resolves six personalities", () => {
    assert.equal(getFeaturedPeople().length, 6);
  });
});

describe("film detail route data", () => {
  // /films/[slug] prerenders getAllFilmSlugs() and calls notFound() when getFilmBySlug misses.
  test("every static param resolves to a film", () => {
    const slugs = getAllFilmSlugs();
    assert.equal(slugs.length, 25);
    for (const slug of slugs) assert.ok(getFilmBySlug(slug), slug);
  });

  test("slugs are URL-safe", () => {
    for (const slug of getAllFilmSlugs()) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  test("unknown, malformed and case-variant slugs resolve to nothing", () => {
    for (const slug of ["unknown-film", "Kano-Nights", "kano-nights/", "../kano-nights", "%20", ""]) {
      assert.equal(getFilmBySlug(slug), undefined, slug);
    }
  });
});
