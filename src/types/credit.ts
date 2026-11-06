export type CreditRole = "actor" | "director";

/** Join record linking a person to a film. Mirrors a future `film_credits` table. */
export interface FilmCredit {
  filmId: string;
  personId: string;
  role: CreditRole;
  /** Required in practice for actors; omitted for directors. */
  characterName?: string;
}
