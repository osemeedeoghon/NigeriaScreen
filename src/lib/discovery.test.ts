import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAllFilms } from "./catalogue.ts";
import type { DiscoveryState, SortOption } from "./discovery.ts";
import {
  countActiveFilters,
  discoverFilms,
  discoveryHref,
  EMPTY_STATE,
  filterFilms,
  getDiscoveryOptions,
  isDefaultState,
  normalizeText,
  parseDiscoveryParams,
  searchFilms,
  serializeDiscoveryState,
  SORT_OPTIONS,
  sortFilms,
} from "./discovery.ts";

const all = getAllFilms();
const titles = (films: { title: string }[]) => films.map((film) => film.title);
const search = (query: string) => titles(searchFilms(all, query));
const discover = (state: Partial<DiscoveryState>) => discoverFilms({ ...EMPTY_STATE, ...state });
const parse = (query: string) => parseDiscoveryParams(new URLSearchParams(query));

describe("normalizeText", () => {
  test("lower-cases, trims, collapses whitespace and strips accents", () => {
    assert.equal(normalizeText("  Ọmọ   ỌBA \n"), "omo oba");
  });
});

describe("search", () => {
  test("by title", () => {
    assert.deepEqual(search("kano nights"), ["Kano Nights"]);
  });

  test("by synopsis", () => {
    assert.deepEqual(search("postmistress"), ["Harmattan Letters"]);
  });

  test("by actor", () => {
    const results = search("Folake Odusanya-Blake");
    assert.deepEqual(results.sort(), ["Aso-Ebi Wars", "Calabar Blue", "Love at Area Eleven", "The Ledger"]);
  });

  test("by director", () => {
    assert.deepEqual(search("halima").sort(), ["Beyond the Moat", "Daughter of the Palace", "Red Earth Rising"]);
  });

  test("by genre name", () => {
    const results = searchFilms(all, "historical");
    assert.ok(results.length >= 4);
    assert.ok(results.every((film) => film.genreIds.includes("genre-historical")));
  });

  test("by language", () => {
    const results = searchFilms(all, "Yoruba");
    assert.deepEqual(titles(results).sort(), ["Aso-Ebi Wars", "Daughter of the Palace", "Owambe Season"]);
  });

  test("is case-insensitive and ignores extra whitespace", () => {
    assert.deepEqual(search("   KANO    nights  "), search("kano nights"));
  });

  test("requires every word to match, in any field", () => {
    assert.deepEqual(search("hausa crime"), ["Kano Nights"]);
  });

  test("empty and whitespace-only queries return every film", () => {
    assert.equal(searchFilms(all, "").length, all.length);
    assert.equal(searchFilms(all, "    ").length, all.length);
  });

  test("returns nothing for an unmatched query", () => {
    assert.deepEqual(search("zzzz-no-such-film"), []);
  });
});

describe("filters", () => {
  test("single genre", () => {
    const results = filterFilms(all, { ...EMPTY_STATE, genres: ["action"] });
    assert.ok(results.length > 0);
    assert.ok(results.every((film) => film.genreIds.includes("genre-action")));
  });

  test("multiple genres match any selected genre", () => {
    const action = filterFilms(all, { ...EMPTY_STATE, genres: ["action"] });
    const historical = filterFilms(all, { ...EMPTY_STATE, genres: ["historical"] });
    const both = filterFilms(all, { ...EMPTY_STATE, genres: ["action", "historical"] });
    const union = new Set([...action, ...historical].map((film) => film.id));
    assert.deepEqual(new Set(both.map((film) => film.id)), union);
  });

  test("language", () => {
    const results = filterFilms(all, { ...EMPTY_STATE, language: "Igbo" });
    assert.equal(results.length, 4);
    assert.ok(results.every((film) => film.language === "Igbo"));
  });

  test("release year", () => {
    const results = filterFilms(all, { ...EMPTY_STATE, year: 2024 });
    assert.ok(results.length > 0);
    assert.ok(results.every((film) => film.releaseYear === 2024));
  });

  test("age rating and status", () => {
    assert.ok(filterFilms(all, { ...EMPTY_STATE, rating: "PG" }).every((film) => film.ageRating === "PG"));
    assert.deepEqual(titles(filterFilms(all, { ...EMPTY_STATE, status: "upcoming" })).sort(), [
      "A Wedding in Jos",
      "Ojuelegba Run",
    ]);
  });

  test("different filters combine with AND", () => {
    assert.deepEqual(titles(discover({ language: "Yoruba", genres: ["drama"] })), ["Daughter of the Palace"]);
  });

  test("search combines with filters", () => {
    assert.deepEqual(titles(discover({ query: "princess", language: "Yoruba", genres: ["drama"] })), [
      "Daughter of the Palace",
    ]);
    assert.deepEqual(titles(discover({ query: "princess", language: "Hausa" })), []);
  });

  test("options are derived from the catalogue", () => {
    const options = getDiscoveryOptions();
    assert.deepEqual(new Set(options.languages), new Set(all.map((film) => film.language)));
    assert.equal(options.genres.length, 8);
    assert.deepEqual(options.years, [...new Set(all.map((film) => film.releaseYear))].sort((a, b) => b - a));
    assert.ok(options.ratings.every((rating) => all.some((film) => film.ageRating === rating)));
  });

  test("counts active filters", () => {
    assert.equal(countActiveFilters(EMPTY_STATE), 0);
    assert.equal(countActiveFilters({ ...EMPTY_STATE, genres: ["drama", "comedy"], year: 2025 }), 3);
  });
});

describe("sorting", () => {
  const isSorted = <T>(items: T[], compare: (a: T, b: T) => number) =>
    items.every((item, i) => i === 0 || compare(items[i - 1], item) <= 0);

  const checks: Record<SortOption, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    // Without a query, "Best match" is newest first.
    relevance: (a, b) => b.releaseYear - a.releaseYear,
    newest: (a, b) => b.releaseYear - a.releaseYear,
    oldest: (a, b) => a.releaseYear - b.releaseYear,
    "title-asc": (a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
    "title-desc": (a, b) => b.title.localeCompare(a.title, "en", { sensitivity: "base" }),
    shortest: (a, b) => a.runtimeMinutes - b.runtimeMinutes,
    longest: (a, b) => b.runtimeMinutes - a.runtimeMinutes,
  };

  for (const { value } of SORT_OPTIONS) {
    test(`${value} orders every film`, () => {
      const sorted = sortFilms(all, value);
      assert.equal(sorted.length, all.length);
      assert.ok(isSorted(sorted, checks[value]), titles(sorted).join(", "));
    });
  }

  test("specific orderings", () => {
    assert.equal(sortFilms(all, "title-asc")[0].title, "A Wedding in Jos");
    assert.equal(sortFilms(all, "title-desc")[0].title, "Third Mainland");
    assert.equal(sortFilms(all, "shortest")[0].title, "Generator Wahala");
    assert.equal(sortFilms(all, "longest")[0].title, "Red Earth Rising");
  });

  test("does not mutate the catalogue", () => {
    const before = all.map((film) => film.id);
    sortFilms(all, "title-desc");
    discover({ sort: "longest" });
    assert.deepEqual(getAllFilms().map((film) => film.id), before);
  });

  test("sorting applies after search and filters", () => {
    const results = discover({ genres: ["comedy"], sort: "shortest" });
    assert.ok(results.every((film) => film.genreIds.includes("genre-comedy")));
    assert.ok(isSorted(results, checks.shortest));
  });
});

describe("URL state", () => {
  test("restores a full state from query parameters", () => {
    assert.deepEqual(parse("q=love&genre=drama&genre=comedy&language=Yoruba&year=2025&rating=PG&status=released&sort=title-asc"), {
      query: "love",
      genres: ["drama", "comedy"],
      language: "Yoruba",
      year: 2025,
      rating: "PG",
      status: "released",
      sort: "title-asc",
    });
  });

  test("accepts comma-separated genres and case-insensitive values", () => {
    const state = parse("genre=DRAMA,comedy&language=yoruba&language=Igbo");
    assert.deepEqual(state.genres, ["drama", "comedy"]);
    assert.equal(state.language, "Yoruba");
  });

  test("drops invalid values safely", () => {
    assert.deepEqual(parse("genre=western&genre=drama&genre=drama&language=Klingon&year=1850&year=abc&rating=X&status=lost&sort=random"), {
      ...EMPTY_STATE,
      genres: ["drama"],
    });
  });

  test("trims and caps the search query", () => {
    assert.equal(parse("q=%20%20love%20%20story%20").query, "love story");
    assert.equal(parse(`q=${"a".repeat(500)}`).query.length, 100);
  });

  test("round-trips through serialization", () => {
    const state: DiscoveryState = { ...EMPTY_STATE, query: "lagos night", genres: ["crime", "thriller"], language: "English", sort: "oldest" };
    const query = serializeDiscoveryState(state);
    assert.equal(query, "q=lagos+night&genre=crime&genre=thriller&language=English&sort=oldest");
    assert.deepEqual(parse(query), state);
  });

  test("clearing everything produces no parameters", () => {
    assert.equal(serializeDiscoveryState(EMPTY_STATE), "");
    assert.equal(discoveryHref({}), "/films");
    assert.ok(isDefaultState(parse("")));
    assert.ok(isDefaultState(parse("genre=nonsense&sort=bogus")));
  });

  test("builds discovery links", () => {
    assert.equal(discoveryHref({ query: "love", genres: ["drama"], language: "Yoruba" }), "/films?q=love&genre=drama&language=Yoruba");
    assert.equal(discoveryHref({ language: "Nigerian Pidgin" }), "/films?language=Nigerian+Pidgin");
  });
});
