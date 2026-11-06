/**
 * Builds the homepage recommendation sections. A film appears at most once
 * across all sections, and a section is dropped unless it has enough items.
 */
import type { FilmFeatures, PopularFilm, Recommendation, RecommendationSection, UserActivity } from "./types.ts";
import { compareScored, genrePlural, rankCandidates, filmSimilarity } from "./score.ts";
import { buildTasteProfile, type TasteProfile } from "./taste.ts";
import { TUNING } from "./weights.ts";

class Picker {
  private used = new Set<string>();
  has(id: string) {
    return this.used.has(id);
  }
  take(items: Recommendation[], limit: number = TUNING.sectionSize): Recommendation[] {
    const picked: Recommendation[] = [];
    for (const item of items) {
      if (picked.length >= limit) break;
      if (this.used.has(item.film.id)) continue;
      this.used.add(item.film.id);
      picked.push(item);
    }
    return picked;
  }
  /** Gives back films from a section that ended up too small to show. */
  release(items: Recommendation[]) {
    for (const item of items) this.used.delete(item.film.id);
  }
}

function section(picker: Picker, base: Omit<RecommendationSection, "items">, candidates: Recommendation[]): RecommendationSection | null {
  const items = picker.take(candidates);
  if (items.length < TUNING.minSectionItems) {
    picker.release(items);
    return null;
  }
  // Only what the page needs crosses to the browser: no scores breakdown or taste data.
  return { ...base, items: items.map(({ film, score, reasons, explanation }) => ({ film, score, reasons, explanation })) };
}

const plain = (features: FilmFeatures, text: string, kind: "popular" | "editorial" | "shares-person" | "new-language" | "watchlist" | "genre", weight = 1): Recommendation => ({
  film: features.film,
  score: weight,
  reasons: [{ kind, weight, text }],
  explanation: text,
});

/** "Popular with viewers": real, anonymous counts only; hidden when there are none. */
function popularSection(picker: Picker, popular: PopularFilm[], catalogue: FilmFeatures[], excluded: (id: string) => boolean) {
  const byId = new Map(catalogue.map((features) => [features.film.id, features]));
  const items = popular
    .filter((entry) => entry.memberCount >= TUNING.popularMinMembers && byId.has(entry.filmId) && !excluded(entry.filmId))
    .sort((a, b) => b.memberCount - a.memberCount || a.filmId.localeCompare(b.filmId))
    .map((entry) => plain(byId.get(entry.filmId)!, `Saved, watched or rated highly by ${entry.memberCount} members recently`, "popular", entry.memberCount));
  return section(picker, { id: "popular", title: "Popular with Viewers", description: "What NaijaScreen members are saving and watching. Counts only; no one's activity is shown.", personalised: false }, items);
}

/** One editorial pick per language, for visitors and people without history. */
function editorialLanguagePicks(catalogue: FilmFeatures[], excluded: (id: string) => boolean): Recommendation[] {
  const seen = new Set<string>();
  return [...catalogue]
    .sort((a, b) => a.editorialRank - b.editorialRank)
    .filter((features) => {
      if (excluded(features.film.id) || seen.has(features.languageCode)) return false;
      seen.add(features.languageCode);
      return true;
    })
    .map((features) => plain(features, `An editors' pick in ${features.language}`, "editorial"));
}

export function buildGuestSections(catalogue: FilmFeatures[], popular: PopularFilm[]): RecommendationSection[] {
  const picker = new Picker();
  const none = () => false;
  return [
    popularSection(picker, popular, catalogue, none),
    section(
      picker,
      {
        id: "discover-more",
        title: "Discover More Nollywood",
        description: "A film in each language in the catalogue, chosen by our editors. Sign in to get picks based on what you watch.",
        personalised: false,
      },
      editorialLanguagePicks(catalogue, none),
    ),
  ].filter((s): s is RecommendationSection => s !== null);
}

export interface PersonalResult {
  sections: RecommendationSection[];
  /** False when the user hasn't done enough yet for personal picks. */
  hasSignals: boolean;
}

export function buildPersonalSections(activity: UserActivity, catalogue: FilmFeatures[], popular: PopularFilm[], now: Date): PersonalResult {
  const taste = buildTasteProfile(activity, catalogue, now);
  const excluded = (id: string) => taste.excluded.has(id);
  if (!taste.hasSignals) return { sections: buildGuestSections(catalogue, popular), hasSignals: false };

  const picker = new Picker();
  const ranked = rankCandidates(catalogue, taste, activity);
  const sections: (RecommendationSection | null)[] = [];

  // Top picks first; the rest of "Recommended" is filled after the themed sections.
  const firstPicks = picker.take(ranked, TUNING.recommendedFirstPicks);

  const topGenre = strongestGenre(taste, activity, catalogue);
  if (topGenre) {
    const items = ranked
      .filter((item) => item.features.genres.some((genre) => genre.slug === topGenre.slug))
      .map((item) => ({ ...item, explanation: `Because you like ${genrePlural(topGenre.slug, topGenre.name)}` }));
    sections.push(
      section(picker, { id: "because-you-like", title: `Because You Like ${topGenre.name}`, description: `More ${topGenre.name.toLowerCase()} you haven't seen yet.`, personalised: true }, items),
    );
  }

  if (taste.watchlist.length > 0) {
    const items = ranked
      .filter((item) => item.closestWatchlistFilm && item.components.watchlist >= 0.3)
      .sort((a, b) => b.components.watchlist - a.components.watchlist || compareScored(a, b))
      .map((item) => ({ ...item, explanation: `Similar to ${item.closestWatchlistFilm!.film.title}, on your watchlist` }));
    sections.push(
      section(picker, { id: "based-on-watchlist", title: "Based on Your Watchlist", description: "Close in genre and language to films you've saved.", personalised: true }, items),
    );
  }

  const anchor = taste.liked[0];
  if (anchor) {
    const anchorPeople = new Map(anchor.features.people.map((person) => [person.id, person.name]));
    const items = catalogue
      .filter((features) => features.film.id !== anchor.features.film.id && !excluded(features.film.id))
      .map((features) => ({ features, shared: features.people.filter((person) => anchorPeople.has(person.id)) }))
      .filter(({ shared }) => shared.length > 0)
      .sort((a, b) => b.shared.length - a.shared.length || filmSimilarity(b.features, anchor.features) - filmSimilarity(a.features, anchor.features) || a.features.editorialRank - b.features.editorialRank)
      .map(({ features, shared }) => plain(features, `Shares ${shared[0].name} with ${anchor.features.film.title}`, "shares-person", shared.length));
    sections.push(
      section(picker, { id: "continue-exploring", title: "Continue Exploring", description: `More from the people behind ${anchor.features.film.title}.`, personalised: true }, items),
    );
  }

  // Languages with no activity and no stated preference: a gentle nudge outward.
  // Films already shown above are skipped so the next film in that language is used.
  const engaged = new Set([...taste.languages.keys(), ...activity.preferences.languages]);
  const fresh = editorialLanguagePicks(
    catalogue.filter((features) => !engaged.has(features.languageCode)),
    (id) => excluded(id) || picker.has(id),
  );
  sections.push(
    section(
      picker,
      { id: "discover-more", title: "Discover More Nollywood", description: "Languages you haven't explored on NaijaScreen yet.", personalised: true },
      fresh.map((item) => ({ ...item, explanation: `A ${item.film.language}-language film, new to your history`, reasons: [{ kind: "new-language" as const, weight: 1, text: `A ${item.film.language}-language film, new to your history` }] })),
    ),
  );

  sections.push(popularSection(picker, popular, catalogue, excluded));

  picker.release(firstPicks);
  const recommended = section(
    picker,
    { id: "recommended", title: "Recommended for You", description: "Ranked by how closely each film matches what you watch, save, rate and prefer.", personalised: true },
    [...firstPicks, ...ranked.filter((item) => !firstPicks.some((pick) => pick.film.id === item.film.id))],
  );

  return { sections: [recommended, ...sections].filter((s): s is RecommendationSection => s !== null), hasSignals: true };
}

/** The genre with the strongest positive pull, backed by two films or an explicit favourite. */
function strongestGenre(taste: TasteProfile, activity: UserActivity, catalogue: FilmFeatures[]) {
  const names = new Map<string, string>(catalogue.flatMap((features) => features.genres.map((genre) => [genre.slug, genre.name] as const)));
  const favourites: readonly string[] = activity.preferences.genres;
  const candidates = [...taste.genres]
    .filter(([slug, value]) => value > 0 && ((taste.genreSupport.get(slug) ?? 0) >= 2 || favourites.includes(slug)))
    .map(([slug, value]) => ({ slug, value: value + (favourites.includes(slug) ? 0.25 : 0) }));
  for (const slug of favourites) {
    if (!candidates.some((c) => c.slug === slug)) candidates.push({ slug, value: 0.25 });
  }
  const top = candidates.sort((a, b) => b.value - a.value || a.slug.localeCompare(b.slug))[0];
  return top && names.has(top.slug) ? { slug: top.slug, name: names.get(top.slug)! } : null;
}
