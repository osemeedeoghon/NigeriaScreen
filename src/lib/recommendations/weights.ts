/**
 * Tunable numbers for the content-based recommender. Every component of a
 * film's score is first squashed into the range -1..1, then multiplied by its
 * weight here, so no single kind of activity can dominate the total.
 */
export const SIGNAL_WEIGHTS = {
  /** A rating's pull on the user's taste profile, by star value. */
  rating: { 5: 2, 4: 1.5, 3: 0.5, 2: -1, 1: -1.5 } as Record<number, number>,
  /** Marked as watched without a rating. */
  watched: 1,
  /** On the watchlist, not yet watched. Intent counts, but less than viewing. */
  watchlist: 0.75,
  /** "Not interested": a mild push away from similar films. */
  notInterested: -0.75,
} as const;

export const SCORE_WEIGHTS = {
  /** How well the film's genres match genres the user engages with. */
  genre: 3,
  /** Primary language matches languages the user engages with. */
  language: 1.5,
  /** Shares cast or director with films the user liked. */
  people: 2,
  /** Genre and language overlap with the user's watchlist. */
  watchlist: 1.5,
  /** One of the user's chosen favourite genres. */
  favouriteGenre: 1.5,
  /** In one of the user's chosen languages. */
  preferredLanguage: 1.25,
} as const;

export const TUNING = {
  /**
   * Affinity saturation: affinity = 1 - e^(-total / SATURATION). With 2, one
   * liked film gives ~0.4 and five give ~0.9, so repeats matter but level off.
   */
  saturation: 2,
  /** Rating from which a film's cast and directors count as "rated highly". */
  highRating: 4,
  /** Ratings at or below this exclude the film from recommendations. */
  poorRating: 2,
  /** Days a "hide" lasts before the film may be suggested again. */
  dismissDays: 30,
  /** A film needs at least this score to be recommended at all. */
  minScore: 0.6,
  /** And at least one reason contributing this much, so every pick is explainable. */
  minReasonWeight: 0.35,
  /** Items per homepage section (the first few show; the rest behind "Show more"). */
  sectionSize: 8,
  /**
   * "Recommended for You" takes its top picks first, then the themed sections
   * fill, then it is topped up from what is left, so one section can't use
   * every good match in a small catalogue.
   */
  recommendedFirstPicks: 4,
  /** Sections with fewer items than this are not shown. */
  minSectionItems: 2,
  /** Members needed before a film counts as "popular" (also enforced in SQL). */
  popularMinMembers: 3,
} as const;
