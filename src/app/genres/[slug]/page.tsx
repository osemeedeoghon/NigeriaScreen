import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FilmGrid from "@/components/FilmGrid";
import { getAllGenres, getFilmsByGenre, getGenreBySlug } from "@/lib/catalogue";
import { discoveryHref, sortFilms } from "@/lib/discovery";

/** Prerender every genre. Unknown slugs are rejected with a 404 by src/proxy.ts. */
export function generateStaticParams() {
  return getAllGenres().map((genre) => ({ slug: genre.slug }));
}

export async function generateMetadata({ params }: PageProps<"/genres/[slug]">): Promise<Metadata> {
  const genre = getGenreBySlug((await params).slug);
  if (!genre) return { title: "Genre not found — NaijaScreen" };
  return { title: `${genre.name} films — NaijaScreen`, description: genre.description, alternates: { canonical: `/genres/${genre.slug}` } };
}

export default async function GenrePage({ params }: PageProps<"/genres/[slug]">) {
  const genre = getGenreBySlug((await params).slug);
  if (!genre) notFound();

  const films = sortFilms(getFilmsByGenre(genre.id), "newest");
  const otherGenres = getAllGenres().filter((other) => other.id !== genre.id);
  const accent = genre.artwork.accent;

  return (
    <main id="main" className="relative overflow-hidden">
      <div aria-hidden="true" className="texture-adire absolute inset-x-0 top-0 h-96" />
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6 sm:pt-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-cream-muted">
            <li>
              <Link href="/" className="hover:text-gold">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/#genres" className="hover:text-gold">
                Genres
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-cream">
              {genre.name}
            </li>
          </ol>
        </nav>

        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span aria-hidden="true" className="mb-5 block h-1 w-14 rounded-full" style={{ background: accent }} />
            <h1 className="font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl lg:text-6xl">
              {genre.name}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-cream-muted">{genre.description}</p>
            <p className="mt-3 text-sm font-semibold tracking-[0.2em] text-gold uppercase">
              {films.length} {films.length === 1 ? "film" : "films"}
            </p>
          </div>
          {films.length > 0 && (
            <Link
              href={discoveryHref({ genres: [genre.slug] })}
              className="self-start rounded-full border border-gold/60 px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-ink sm:self-auto"
            >
              Filter and sort these films <span aria-hidden="true">→</span>
            </Link>
          )}
        </header>

        {films.length > 0 ? (
          <>
            <h2 className="sr-only">{genre.name} films</h2>
            <FilmGrid films={films} label={`${genre.name} films`} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <h2 className="font-display text-2xl font-semibold text-cream">No {genre.name.toLowerCase()} films yet</h2>
            <p className="mx-auto mt-2 max-w-md text-cream-muted">
              We haven&rsquo;t added any films in this genre to the catalogue. Explore another genre below.
            </p>
            <Link
              href="/films"
              className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
            >
              Browse all films
            </Link>
          </div>
        )}

        <nav aria-labelledby="other-genres" className="mt-16 border-t border-line pt-10">
          <h2 id="other-genres" className="text-sm font-semibold text-cream">
            More genres
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {otherGenres.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/genres/${other.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-sm text-cream-muted transition-colors hover:border-cream-muted hover:text-cream"
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: other.artwork.accent }} />
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
