import Link from "next/link";
import { notFound } from "next/navigation";
import { getGenreBySlug } from "@/lib/catalogue";
import { formatRuntime } from "@/lib/format";
import { getPublishedFilmBySlug } from "@/lib/industry/queries";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { countryName } from "@/lib/viewing/countries";
import { languageName } from "@/lib/viewing/languages";
import { isApprovedEmbedUrl, parseTrailerUrl, TRAILER_PROVIDER_NAMES, trailerEmbedUrl } from "@/lib/viewing/trailers";
import TrailerPlayer from "../viewing/TrailerPlayer";

/**
 * A film listed from an approved submission. These live in published_films,
 * not the TypeScript catalogue, so search, recommendations, watchlists and
 * reviews don't include them yet (see README).
 */
export default async function PublishedFilmView({ slug }: { slug: string }) {
  const film = await getPublishedFilmBySlug(slug);
  if (!film) notFound();
  const company = film.company_id
    ? ((await createPublicSupabaseClient()?.rpc("get_public_company_for_film", { p_film_id: film.id }))?.data?.[0] ?? null)
    : null;
  const trailer = film.trailer_url ? parseTrailerUrl(film.trailer_url) : null;
  const embed = trailer ? trailerEmbedUrl(trailer.provider, trailer.videoId) : null;

  const facts = [
    { label: "Released", value: String(film.release_year) },
    { label: "Runtime", value: formatRuntime(film.runtime_minutes) },
    { label: "Language", value: languageName(film.language) ?? film.language },
    { label: "Country", value: countryName(film.country) },
  ];

  return (
    <article className="relative overflow-hidden">
      <div aria-hidden="true" className="texture-adire absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-cream-muted">
          <Link href="/" className="hover:text-gold">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/industry" className="hover:text-gold">
            Industry
          </Link>{" "}
          / <span className="text-cream">{film.title}</span>
        </nav>
        <div className="grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-14">
          <div className="mx-auto aspect-[2/3] w-full max-w-[16rem] overflow-hidden rounded-2xl bg-gradient-to-br from-clay to-ink shadow-2xl shadow-black/60 ring-1 ring-gold/20 md:max-w-none">
            {film.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- official poster link from the approved submission
              <img src={film.poster_url} alt={`Poster for ${film.title}`} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <div aria-hidden="true" className="flex h-full items-end p-6 font-display text-3xl font-semibold text-cream">
                {film.title}
              </div>
            )}
          </div>
          <div>
            <p className="mb-4 inline-flex rounded-full border border-gold/60 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              Listed by its filmmakers
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-cream sm:text-5xl lg:text-6xl">{film.title}</h1>
            {film.original_title && <p className="mt-2 text-cream-muted">Original title: {film.original_title}</p>}
            <ul aria-label="Genres" className="mt-5 flex flex-wrap gap-2">
              {film.genres.map((slug) => {
                const genre = getGenreBySlug(slug);
                return genre ? (
                  <li key={slug}>
                    <Link href={`/genres/${slug}`} className="inline-block rounded-full border border-line px-3 py-1 text-sm text-cream-muted hover:text-cream">
                      {genre.name}
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed whitespace-pre-line text-cream">{film.synopsis}</p>
            <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs font-semibold tracking-[0.2em] text-cream-muted uppercase">{fact.label}</dt>
                  <dd className="mt-1 font-semibold text-cream">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <dl className="mt-8 grid max-w-2xl gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-semibold text-cream">Director</dt>
                <dd className="text-cream-muted">{film.director}</dd>
              </div>
              {film.producers.length > 0 && (
                <div>
                  <dt className="font-semibold text-cream">Producers</dt>
                  <dd className="text-cream-muted">{film.producers.join(", ")}</dd>
                </div>
              )}
              {film.cast_names.length > 0 && (
                <div>
                  <dt className="font-semibold text-cream">Cast</dt>
                  <dd className="text-cream-muted">{film.cast_names.join(", ")}</dd>
                </div>
              )}
            </dl>
            {company && (
              <p className="mt-6 text-sm text-cream-muted">
                Production company:{" "}
                <Link href={`/companies/${company.slug}`} className="font-semibold text-gold hover:text-cream">
                  {company.name}
                </Link>
              </p>
            )}
            {film.website_url && (
              <p className="mt-2 text-sm">
                <a href={film.website_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold hover:text-cream">
                  Official website<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </div>
        </div>
        <div className="mt-16 grid gap-10 rounded-3xl border border-line bg-ink-2/80 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(0,28rem)]">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-cream">Where to Watch</h2>
            <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-8 text-cream">
              We haven&rsquo;t confirmed an authorised viewing option for this film yet. Check back later.
            </p>
            <p className="mt-4 text-xs text-cream-muted">
              This film was submitted by its filmmakers and approved by NaijaScreen moderators. Reviews and watchlists for filmmaker-listed films are
              not available yet.
            </p>
          </div>
          {trailer && (
            <TrailerPlayer
              title="Official trailer"
              filmTitle={film.title}
              embedUrl={embed && isApprovedEmbedUrl(embed) ? embed : null}
              watchUrl={trailer.canonicalUrl}
              providerName={TRAILER_PROVIDER_NAMES[trailer.provider]}
              thumbnailUrl={null}
            />
          )}
        </div>
      </div>
    </article>
  );
}
