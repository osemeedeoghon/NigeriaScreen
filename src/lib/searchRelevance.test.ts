import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAllFilms } from "./catalogue.ts";
import { discoverFilms, EMPTY_STATE, noResultHints, parseDiscoveryParams, serializeDiscoveryState, type DiscoveryState } from "./discovery.ts";
import { normalizeSearchText, rankByRelevance, relevanceScore, suggestTitles } from "./searchRelevance.ts";

const all = getAllFilms();
const titles = (state: Partial<DiscoveryState>) => discoverFilms({ ...EMPTY_STATE, ...state }).map((film) => film.title);
const film = (title: string) => all.find((f) => f.title === title)!;

describe("relevance ranking", () => {
  test("an exact title match comes first", () => {
    assert.equal(titles({ query: "Kano Nights" })[0], "Kano Nights");
    assert.equal(titles({ query: "the ledger" })[0], "The Ledger");
  });

  test("case, extra whitespace, accents and punctuation don't matter", () => {
    assert.equal(titles({ query: "   KANO    nights  " })[0], "Kano Nights");
    assert.equal(normalizeSearchText("  Mama  Nkoli's  Gárden! "), "mama nkoli s garden");
    assert.equal(titles({ query: "mama nkoli's garden" })[0], "Mama Nkoli's Garden");
  });

  test("title matches outrank synopsis-only matches", () => {
    // "love" is in the title of Love at Area Eleven and in other films' synopses.
    const results = titles({ query: "love" });
    assert.equal(results[0], "Love at Area Eleven");
    assert.ok(results.length > 1);
  });

  test("a title prefix beats a word deeper in another title", () => {
    assert.ok(relevanceScore(film("Daughter of the Palace"), "daughter") > relevanceScore(film("Kano Nights"), "daughter"));
    assert.equal(titles({ query: "red earth" })[0], "Red Earth Rising");
  });

  test("actor and director names rank their films", () => {
    const director = titles({ query: "Zainab Musa-Lawal" });
    assert.ok(director.length >= 3);
    for (const title of director.slice(0, 3)) {
      assert.ok(["Kano Nights", "Harmattan Letters", "Gidan Haske", "The Last Train to Kafanchan"].includes(title), title);
    }
    assert.ok(relevanceScore(film("Kano Nights"), "zainab musa lawal") > relevanceScore(film("Kano Nights"), "nights in kano"));
  });

  test("genre and language words count, below title matches", () => {
    assert.ok(relevanceScore(film("Gidan Haske"), "hausa drama") > 0);
    assert.ok(relevanceScore(film("Kano Nights"), "kano") > relevanceScore(film("Gidan Haske"), "kano"));
  });

  test("ranking is stable and doesn't mutate its input", () => {
    const input = [...all];
    const first = rankByRelevance(input, "lagos").map((f) => f.id);
    assert.deepEqual(rankByRelevance(input, "lagos").map((f) => f.id), first);
    assert.deepEqual(input.map((f) => f.id), all.map((f) => f.id));
  });
});

describe("relevance with the existing filters and sorts", () => {
  test("filters still apply to ranked results", () => {
    const results = discoverFilms({ ...EMPTY_STATE, query: "drama", language: "Hausa" });
    assert.ok(results.length > 0);
    assert.ok(results.every((f) => f.language === "Hausa"));
  });

  test("an explicit sort replaces relevance", () => {
    const byTitle = titles({ query: "love", sort: "title-asc" });
    assert.deepEqual(byTitle, [...byTitle].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  });

  test("Best match is the default and stays out of the URL; other sorts are kept", () => {
    assert.equal(parseDiscoveryParams(new URLSearchParams("q=kano")).sort, "relevance");
    assert.equal(serializeDiscoveryState({ ...EMPTY_STATE, query: "kano" }), "q=kano");
    assert.equal(serializeDiscoveryState({ ...EMPTY_STATE, query: "kano", sort: "newest" }), "q=kano&sort=newest");
  });

  test("with no query, Best match is newest first, as before", () => {
    const years = discoverFilms(EMPTY_STATE).map((f) => f.releaseYear);
    assert.deepEqual(years, [...years].sort((a, b) => b - a));
  });
});

describe("no-result help", () => {
  test("suggests close titles for typos", () => {
    assert.deepEqual(suggestTitles("harmatan leters").map((f) => f.title), ["Harmattan Letters"]);
    assert.ok(suggestTitles("kano nigths").some((f) => f.title === "Kano Nights"));
    assert.deepEqual(suggestTitles("zz"), []);
    assert.deepEqual(suggestTitles("completely unrelated words"), []);
  });

  test("points out when filters, not the search, ruled everything out", () => {
    const state = { ...EMPTY_STATE, query: "kano", language: "Igbo" as const };
    assert.equal(discoverFilms(state).length, 0);
    assert.ok(noResultHints(state).matchesWithoutFilters > 0);
    assert.equal(noResultHints({ ...EMPTY_STATE, query: "zzzz" }).matchesWithoutFilters, 0);
  });
});
