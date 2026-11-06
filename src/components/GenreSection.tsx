import { getAllGenres, getFilmsByGenre } from "@/lib/catalogue";
import BrowseAllLink from "./BrowseAllLink";
import GenreCard from "./GenreCard";
import SectionHeading from "./SectionHeading";

export default function GenreSection() {
  return (
    <section id="genres" aria-labelledby="genres-title" className="border-y border-line/60 bg-ink-2/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          id="genres-title"
          eyebrow="Browse by genre"
          title="Pick a mood, find a film"
          description="Open a genre to see every film in it."
          action={<BrowseAllLink />}
        />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {getAllGenres().map((genre) => (
            <li key={genre.id}>
              <GenreCard genre={genre} filmCount={getFilmsByGenre(genre.id).length} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
