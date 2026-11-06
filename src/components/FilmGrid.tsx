import type { Film } from "@/types";
import FilmCard from "./FilmCard";

interface FilmGridProps {
  films: Film[];
  /** Rank shown on each card, looked up by film ID. */
  ranks?: Map<string, number>;
  /** Accessible name for the list. */
  label?: string;
}

/** Responsive poster grid shared by the homepage, /films and genre pages. */
export default function FilmGrid({ films, ranks, label }: FilmGridProps) {
  return (
    <ol aria-label={label} className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {films.map((film) => (
        <li key={film.id}>
          <FilmCard film={film} rank={ranks?.get(film.id)} />
        </li>
      ))}
    </ol>
  );
}
