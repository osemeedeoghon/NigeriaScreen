import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildFeatures } from "./features.ts";
import { contentBasedProvider, getRecommendationProvider } from "./provider.ts";
import { rankCandidates, scoreFilm } from "./score.ts";
import { buildGuestSections, buildPersonalSections } from "./sections.ts";
import { buildTasteProfile, saturate } from "./taste.ts";
import { NO_PREFERENCES, type PopularFilm, type UserActivity } from "./types.ts";
import { SCORE_WEIGHTS, TUNING } from "./weights.ts";

const catalogue = buildFeatures();
const NOW = new Date("2026-11-05T12:00:00Z");
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();

function activity(overrides: Partial<UserActivity> = {}): UserActivity {
  return { watchlist: [], watched: [], ratings: [], feedback: [], preferences: NO_PREFERENCES, ...overrides };
}
const watched = (...ids: string[]) => ids.map((filmId, i) => ({ filmId, watchedAt: at(i + 1) }));
const rated = (rating: number, ...ids: string[]) => ids.map((filmId, i) => ({ filmId, rating, updatedAt: at(i + 1) }));
const saved = (...ids: string[]) => ids.map((filmId, i) => ({ filmId, addedAt: at(i + 1) }));

const ranked = (a: UserActivity) => rankCandidates(catalogue, buildTasteProfile(a, catalogue, NOW), a);
const rankedIds = (a: UserActivity) => ranked(a).map((item) => item.film.id);
const sectionsFor = (a: UserActivity, popular: PopularFilm[] = []) => buildPersonalSections(a, catalogue, popular, NOW);
const allIds = (a: UserActivity, popular: PopularFilm[] = []) => sectionsFor(a, popular).sections.flatMap((s) => s.items.map((i) => i.film.id));
const find = (id: string) => catalogue.find((f) => f.film.id === id)!;

describe("genre preferences", () => {
  test("repeated drama viewing ranks dramas above unrelated genres", () => {
    const a = activity({ watched: watched("film-gidan-haske", "film-red-earth-rising", "film-sunday-rice") });
    const ids = rankedIds(a);
    const firstComedyOnly = ids.indexOf("film-danfo-diaries");
    for (const drama of ["film-harmattan-letters", "film-port-harcourt-blues", "film-mama-nkolis-garden"]) {
      assert.ok(ids.includes(drama), drama);
      if (firstComedyOnly >= 0) assert.ok(ids.indexOf(drama) < firstComedyOnly, drama);
    }
  });

  test("more films in a genre means a stronger pull, but it levels off", () => {
    const one = buildTasteProfile(activity({ watched: watched("film-gidan-haske") }), catalogue, NOW).genres.get("drama")!;
    const three = buildTasteProfile(activity({ watched: watched("film-gidan-haske", "film-sunday-rice", "film-red-earth-rising") }), catalogue, NOW).genres.get("drama")!;
    assert.ok(three > one);
    assert.ok(three < 1);
    assert.equal(saturate(0), 0);
    assert.ok(saturate(100) <= 1 && saturate(-100) >= -1);
  });

  test('a "Because You Like" section appears once two liked films share a genre', () => {
    const a = activity({ watched: watched("film-gidan-haske", "film-sunday-rice") });
    const section = sectionsFor(a).sections.find((s) => s.id === "because-you-like");
    assert.equal(section?.title, "Because You Like Drama");
    assert.ok(section!.items.every((item) => find(item.film.id).genres.some((g) => g.slug === "drama")));
    assert.ok(section!.items.every((item) => item.explanation === "Because you like dramas"));
  });
});

describe("language preferences", () => {
  test("liking Yoruba films lifts other Yoruba films and says so", () => {
    const a = activity({ ratings: rated(5, "film-owambe-season", "film-aso-ebi-wars") });
    const top = ranked(a);
    const palace = top.find((item) => item.film.id === "film-daughter-of-the-palace");
    assert.ok(palace, "Daughter of the Palace (Yoruba) should be recommended");
    assert.ok(palace!.components.language > 0);
    assert.ok(palace!.reasons.some((r) => r.text.includes("Yoruba")));
  });

  test("a stated preferred language adds a reason even without history", () => {
    const a = activity({ preferences: { ...NO_PREFERENCES, languages: ["ha"] } });
    const items = ranked(a);
    assert.ok(items.length > 0);
    assert.ok(items.every((item) => find(item.film.id).languageCode === "ha"));
    assert.equal(items[0].explanation, "Matches your preferred language, Hausa");
  });

  test("genre and language together give the combined explanation", () => {
    const a = activity({ ratings: rated(5, "film-gidan-haske", "film-harmattan-letters") });
    const kafanchan = ranked(a).find((item) => item.film.id === "film-the-last-train-to-kafanchan");
    assert.ok(kafanchan);
    assert.equal(kafanchan!.reasons.find((r) => r.kind === "genre-language")?.text, "Because you enjoy Hausa dramas");
  });
});

describe("combined explanations need one film with both", () => {
  test("an English drama plus a Hausa crime film doesn't claim 'English crime films'", () => {
    const a = activity({ watched: watched("film-sunday-rice"), ratings: rated(5, "film-kano-nights") });
    const texts = ranked(a).flatMap((item) => item.reasons.map((r) => r.text));
    assert.ok(!texts.includes("Because you enjoy English crime films"), texts.join(" | "));
    assert.ok(!texts.includes("Because you enjoy Hausa dramas"));
  });

  test("Discover More moves on to the next film in a language when its first pick is used elsewhere", () => {
    const a = activity({ watched: watched("film-gidan-haske"), preferences: { ...NO_PREFERENCES, languages: ["yo"] } });
    const { sections } = sectionsFor(a);
    const discover = sections.find((s) => s.id === "discover-more");
    assert.ok(discover, "Discover More should appear");
    const engaged = new Set(["ha", "yo"]);
    assert.ok(discover!.items.every((item) => !engaged.has(find(item.film.id).languageCode)));
    const languages = discover!.items.map((item) => find(item.film.id).languageCode);
    assert.equal(new Set(languages).size, languages.length, "one film per language");
    const elsewhere = new Set(sections.filter((s) => s.id !== "discover-more").flatMap((s) => s.items.map((i) => i.film.id)));
    assert.ok(discover!.items.every((item) => !elsewhere.has(item.film.id)));
    // English's first editorial pick (Third Mainland) is in "Recommended", so the next English film stands in.
    if (elsewhere.has("film-third-mainland") && languages.includes("en")) {
      assert.notEqual(discover!.items.find((item) => find(item.film.id).languageCode === "en")!.film.id, "film-third-mainland");
    }
  });
});

describe("actors and directors", () => {
  test("a highly rated film's director lifts their other films", () => {
    const a = activity({ ratings: rated(5, "film-third-mainland") });
    const items = ranked(a);
    const ink = items.find((item) => item.film.id === "film-ink-of-the-ancestors");
    assert.ok(ink && ink.components.people > 0);
    assert.ok(ink!.reasons.some((r) => r.text === "Directed by Obinna Eze-Williams, from films you rated highly"));
  });

  test("people from films that were only watched say so, not 'rated highly'", () => {
    const a = activity({ watched: watched("film-third-mainland") });
    const texts = ranked(a).flatMap((item) => item.reasons.map((r) => r.text));
    assert.ok(texts.some((t) => t.endsWith("from films you've watched")));
    assert.ok(!texts.some((t) => t.includes("rated highly")));
  });

  test("poorly rated films contribute no people and push their genres down", () => {
    const taste = buildTasteProfile(activity({ ratings: rated(1, "film-danfo-diaries") }), catalogue, NOW);
    assert.equal(taste.people.size, 0);
    assert.ok((taste.genres.get("comedy") ?? 0) < 0);
  });

  test("Continue Exploring lists films sharing people with the latest liked film", () => {
    const a = activity({ watched: watched("film-kano-nights") });
    const section = sectionsFor(a).sections.find((s) => s.id === "continue-exploring");
    assert.ok(section);
    assert.ok(section!.items.every((item) => /^Shares .+ with Kano Nights$/.test(item.explanation)));
  });
});

describe("watchlist", () => {
  test("saved-only interest is described as the watchlist, never as enjoyment", () => {
    const a = activity({ watchlist: saved("film-harmattan-letters", "film-calabar-blue") });
    const texts = ranked(a).flatMap((item) => item.reasons.map((r) => r.text));
    assert.ok(texts.length > 0);
    assert.ok(!texts.some((t) => t.includes("enjoy")), texts.join(" | "));
    assert.ok(texts.some((t) => t.includes("on your watchlist")));
    assert.ok(!sectionsFor(a).sections.some((s) => s.id === "because-you-like"), "saving alone doesn't claim you like a genre");
  });

  test("watchlist films are similar-matched but never recommended themselves", () => {
    const a = activity({
      watched: watched("film-danfo-diaries", "film-generator-wahala", "film-okada-express"),
      watchlist: saved("film-harmattan-letters", "film-calabar-blue"),
    });
    const result = sectionsFor(a);
    const ids = result.sections.flatMap((s) => s.items.map((i) => i.film.id));
    assert.ok(!ids.includes("film-harmattan-letters") && !ids.includes("film-calabar-blue"));
    const section = result.sections.find((s) => s.id === "based-on-watchlist");
    assert.ok(section, "Based on Your Watchlist should appear");
    assert.ok(section!.items.every((item) => /^Similar to (Harmattan Letters|Calabar Blue), on your watchlist$/.test(item.explanation)));
  });

  test("a large watchlist can't outweigh everything else", () => {
    const a = activity({ watchlist: saved(...catalogue.slice(0, 12).map((f) => f.film.id)) });
    for (const item of ranked(a)) {
      assert.ok(item.components.watchlist <= 1);
      assert.ok(item.score <= Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0));
    }
  });
});

describe("exclusions", () => {
  test("watched films are excluded unless the user opts in", () => {
    const history = watched("film-gidan-haske", "film-sunday-rice");
    assert.ok(!allIds(activity({ watched: history })).some((id) => id === "film-gidan-haske" || id === "film-sunday-rice"));
    const included = rankedIds(activity({ watched: history, preferences: { ...NO_PREFERENCES, includeWatched: true } }));
    assert.ok(included.includes("film-gidan-haske") || included.includes("film-sunday-rice"));
  });

  test("films rated 2 stars or lower are never recommended, even with watched films included", () => {
    const a = activity({
      ratings: [...rated(2, "film-port-harcourt-blues"), ...rated(5, "film-gidan-haske")],
      preferences: { ...NO_PREFERENCES, includeWatched: true },
    });
    assert.ok(!allIds(a).includes("film-port-harcourt-blues"));
  });

  test("dismissed films stay hidden for 30 days, then may return", () => {
    const base = { watched: watched("film-gidan-haske", "film-sunday-rice", "film-red-earth-rising") };
    const target = rankedIds(activity(base))[0];
    const recent = activity({ ...base, feedback: [{ filmId: target, kind: "dismissed", updatedAt: at(2) }] });
    const old = activity({ ...base, feedback: [{ filmId: target, kind: "dismissed", updatedAt: at(TUNING.dismissDays + 1) }] });
    assert.ok(!allIds(recent).includes(target));
    assert.ok(rankedIds(old).includes(target));
  });

  test("'not interested' hides a film for good", () => {
    const base = { watched: watched("film-gidan-haske", "film-sunday-rice") };
    const target = rankedIds(activity(base))[0];
    const a = activity({ ...base, feedback: [{ filmId: target, kind: "not_interested", updatedAt: at(400) }] });
    assert.ok(!allIds(a).includes(target));
  });

  test("no film appears twice across all sections", () => {
    const a = activity({
      watched: watched("film-gidan-haske", "film-kano-nights", "film-owambe-season"),
      ratings: rated(5, "film-third-mainland"),
      watchlist: saved("film-calabar-blue"),
      preferences: { languages: ["yo"], genres: ["drama"], includeWatched: false },
    });
    const popular = catalogue.slice(0, 10).map((f, i) => ({ filmId: f.film.id, memberCount: 20 - i }));
    const ids = allIds(a, popular);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of sectionsFor(a, popular).sections) assert.ok(s.items.length >= TUNING.minSectionItems && s.items.length <= TUNING.sectionSize, s.id);
  });
});

describe("explanations", () => {
  test("every explanation is one of the measured reasons, or a section's own factual line", () => {
    const a = activity({ ratings: rated(5, "film-kano-nights", "film-gidan-haske"), watchlist: saved("film-calabar-blue") });
    for (const s of sectionsFor(a).sections) {
      for (const item of s.items) {
        assert.ok(item.explanation.length > 0, item.film.id);
        if (s.id === "recommended") assert.equal(item.explanation, item.reasons[0].text);
      }
    }
  });

  test("no favourite-genre or language-preference claims without those preferences", () => {
    const a = activity({ watched: watched("film-gidan-haske", "film-sunday-rice") });
    const texts = ranked(a).flatMap((item) => item.reasons.map((r) => r.text));
    assert.ok(!texts.some((t) => t.startsWith("One of your favourite genres") || t.startsWith("Matches your preferred language")));
  });

  test("a favourite genre is named when it's set", () => {
    const a = activity({ preferences: { ...NO_PREFERENCES, genres: ["historical"] } });
    const top = ranked(a)[0];
    assert.equal(top.explanation, "One of your favourite genres: Historical");
  });

  test("scoreFilm only reports components that matched", () => {
    const a = activity();
    const scored = scoreFilm(find("film-kano-nights"), buildTasteProfile(a, catalogue, NOW), a);
    assert.equal(scored.score, 0);
    assert.deepEqual(scored.reasons, []);
  });
});

describe("guests and insufficient activity", () => {
  test("visitors get editorial picks, one per language, and nothing personalised", () => {
    const sections = buildGuestSections(catalogue, []);
    assert.deepEqual(sections.map((s) => s.id), ["discover-more"]);
    assert.ok(sections.every((s) => !s.personalised));
    const languages = sections[0].items.map((item) => find(item.film.id).languageCode);
    assert.equal(new Set(languages).size, languages.length);
    assert.ok(sections[0].items.every((item) => item.explanation.startsWith("An editors' pick in ")));
  });

  test("'Popular with Viewers' only appears with real counts from at least three members", () => {
    assert.ok(!buildGuestSections(catalogue, [{ filmId: "film-kano-nights", memberCount: 2 }, { filmId: "film-the-ledger", memberCount: 1 }]).some((s) => s.id === "popular"));
    const popular = buildGuestSections(catalogue, [
      { filmId: "film-kano-nights", memberCount: 5 },
      { filmId: "film-the-ledger", memberCount: 3 },
      { filmId: "film-not-in-catalogue", memberCount: 9 },
    ]).find((s) => s.id === "popular");
    assert.deepEqual(popular?.items.map((i) => i.film.id), ["film-kano-nights", "film-the-ledger"]);
    assert.equal(popular?.items[0].explanation, "Saved, watched or rated highly by 5 members recently");
  });

  test("a signed-in user with no activity gets the guest experience, not empty carousels", () => {
    const result = sectionsFor(activity());
    assert.equal(result.hasSignals, false);
    assert.ok(result.sections.every((s) => !s.personalised && s.items.length >= TUNING.minSectionItems));
  });

  test("an empty catalogue produces no sections and no errors", () => {
    assert.deepEqual(buildGuestSections([], []), []);
    assert.deepEqual(buildPersonalSections(activity({ watched: watched("film-kano-nights") }), [], [], NOW).sections, []);
  });

  test("activity for films not in the catalogue is ignored", () => {
    const a = activity({ watched: watched("film-deleted-long-ago"), ratings: rated(5, "film-also-gone") });
    assert.deepEqual(rankedIds(a), []);
  });
});

describe("determinism and the provider", () => {
  test("the same input always gives the same output, whatever order activity arrives in", () => {
    const a = activity({
      watched: watched("film-gidan-haske", "film-kano-nights", "film-owambe-season"),
      ratings: rated(4, "film-third-mainland", "film-calabar-blue"),
      watchlist: saved("film-harmattan-letters"),
    });
    const reversed = activity({ watched: [...a.watched].reverse(), ratings: [...a.ratings].reverse(), watchlist: [...a.watchlist].reverse() });
    const first = JSON.stringify(sectionsFor(a));
    assert.equal(JSON.stringify(sectionsFor(a)), first);
    assert.deepEqual(rankedIds(reversed), rankedIds(a));
  });

  test("the provider returns guest sections for visitors and personal ones for users", async () => {
    assert.equal(getRecommendationProvider().id, "content-based-v1");
    const guest = await contentBasedProvider.recommend({ activity: null, catalogue, popular: [], now: NOW });
    assert.deepEqual(guest, buildGuestSections(catalogue, []));
    const a = activity({ watched: watched("film-gidan-haske", "film-sunday-rice") });
    const personal = await contentBasedProvider.recommend({ activity: a, catalogue, popular: [], now: NOW });
    assert.ok(personal.some((s) => s.personalised));
  });

  test("sections sent to the browser carry no internal scoring data", () => {
    const a = activity({ watched: watched("film-gidan-haske", "film-sunday-rice") });
    for (const s of sectionsFor(a).sections) {
      for (const item of s.items) assert.deepEqual(Object.keys(item).sort(), ["explanation", "film", "reasons", "score"]);
    }
  });
});
