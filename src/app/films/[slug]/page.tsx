import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LibraryButtons from "@/components/library/LibraryButtons";
import PosterArt from "@/components/PosterArt";
import PublishedFilmView from "@/components/industry/PublishedFilmView";
import FilmReviews, { FilmReviewsSkeleton } from "@/components/reviews/FilmReviews";
import WhereToWatch, { WhereToWatchSkeleton } from "@/components/viewing/WhereToWatch";
import { getAllFilmSlugs, getFilmActors, getFilmBySlug, getFilmDirectors, getFilmGenres } from "@/lib/catalogue";
import { formatRuntime } from "@/lib/format";
import { getPublishedFilmBySlug } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Prerender every catalogue film. Other slugs may be films listed from
 * approved submissions (published_films), rendered on request; anything else
 * is a 404 (the proxy returns the real status).
 */
export function generateStaticParams() {
  return getAllFilmSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/films/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const film = getFilmBySlug(slug);
  if (!film) {
    const listed = isSupabaseConfigured() ? await getPublishedFilmBySlug(slug) : null;
    return listed
      ? {
          title: `${listed.title} (${listed.release_year}) — NaijaScreen`,
          description: listed.synopsis,
          alternates: { canonical: `/films/${listed.slug}` },
        }
      : { title: "Film not found — NaijaScreen", robots: { index: false } };
  }
  const title = `${film.title} (${film.releaseYear}) — NaijaScreen`;
  return {
    title,
    description: film.synopsis,
    alternates: { canonical: `/films/${film.slug}` },
    openGraph: { type: "website", title, description: film.synopsis, url: `/films/${film.slug}` },
  };
}

export default async function FilmPage({ params }: PageProps<"/films/[slug]">) {
  const { slug } = await params;
  const film = getFilmBySlug(slug);
  if (!film) {
    if (!isSupabaseConfigured()) notFound();
    return (
      <main id="main">
        <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-16 text-cream-muted" role="status">Loading film…</p>}>
          <PublishedFilmView slug={slug} />
        </Suspense>
      </main>
    );
  }

  const genres = getFilmGenres(film);
  const directors = getFilmDirectors(film.id);
  const cast = getFilmActors(film.id);

  const facts = [
    { label: "Released", value: film.status === "upcoming" ? `Coming ${film.releaseYear}` : String(film.releaseYear) },
    { label: "Runtime", value: formatRuntime(film.runtimeMinutes) },
    { label: "Rating", value: film.ageRating },
    { label: "Language", value: film.language },
    { label: "Country", value: film.country },
  ];

  return (
    <>
      <main id="main">
        <article className="relative overflow-hidden">
          <div aria-hidden="true" className="texture-adire absolute inset-0" />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[36rem] opacity-70"
            style={{ background: `radial-gradient(70% 80% at 75% 0%, ${film.artwork.palette[1]}66, transparent 70%)` }}
          />

          <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:px-8 lg:pb-24">
            <nav aria-label="Breadcrumb" className="mb-8 text-sm">
              <ol className="flex flex-wrap items-center gap-2 text-cream-muted">
                <li>
                  <Link href="/" className="hover:text-gold">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/films" className="hover:text-gold">
                    Films
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-cream">
                  {film.title}
                </li>
              </ol>
            </nav>

            <div className="grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-14">
              <PosterArt
                art={film.artwork}
                title={film.title}
                year={film.releaseYear}
                size="lg"
                className="mx-auto w-full max-w-[16rem] shadow-2xl shadow-black/60 ring-1 ring-gold/20 md:max-w-none"
              />

              <div>
                {film.status === "upcoming" && (
                  <p className="mb-4 inline-flex rounded-full border border-palm/60 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-palm uppercase">
                    Upcoming release
                  </p>
                )}
                <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-cream sm:text-5xl lg:text-6xl">
                  {film.title}
                </h1>

                <ul aria-label="Genres" className="mt-5 flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <li key={genre.id}>
                      <Link
                        href={`/genres/${genre.slug}`}
                        className="inline-block rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-cream/5"
                        style={{ borderColor: `${genre.artwork.accent}80`, color: genre.artwork.accent }}
                      >
                        {genre.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream">{film.synopsis}</p>

                <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-xs font-semibold tracking-[0.2em] text-cream-muted uppercase">{fact.label}</dt>
                      <dd className="mt-1 font-semibold text-cream">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <LibraryButtons filmId={film.id} filmTitle={film.title} upcoming={film.status === "upcoming"} variant="full" />
                  <a href="#where-to-watch" className="rounded-full px-4 py-2.5 text-sm font-semibold text-gold hover:text-cream">
                    Where to watch <span aria-hidden="true">↓</span>
                  </a>
                </div>

                <div className="mt-10 grid max-w-2xl gap-8 sm:grid-cols-[1fr_2fr]">
                  <section aria-labelledby="director-heading">
                    <h2 id="director-heading" className="text-sm font-semibold text-cream">
                      {directors.length === 1 ? "Director" : "Directors"}
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {directors.map((person) => (
                        <li key={person.id} className="text-cream-muted">
                          {person.name}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="cast-heading">
                    <h2 id="cast-heading" className="text-sm font-semibold text-cream">
                      Cast
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {cast.map(({ person, characterName }) => (
                        <li key={person.id} className="flex flex-wrap gap-x-2">
                          <span className="text-cream">{person.name}</span>
                          {characterName && <span className="text-cream-muted">as {characterName}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <p className="mt-10 text-xs text-cream-muted">
                  Fictional sample record for development. Not a real film or production.
                </p>
              </div>
            </div>

            <div className="mt-16 rounded-3xl border border-line bg-ink-2/80 p-6 sm:p-8">
              <Suspense fallback={<WhereToWatchSkeleton />}>
                <WhereToWatch film={film} />
              </Suspense>
            </div>

            <div className="mt-16">
              <Suspense fallback={<FilmReviewsSkeleton />}>
                <FilmReviews film={film} />
              </Suspense>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
