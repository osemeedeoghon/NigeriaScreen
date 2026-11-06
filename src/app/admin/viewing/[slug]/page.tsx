import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import AdminActionButton from "@/components/admin/AdminActionButton";
import { TrailerForm, ViewingOptionForm } from "@/components/admin/AdminForms";
import AdminSection from "@/components/admin/AdminSection";
import StatusBadge, { CheckDates } from "@/components/admin/StatusBadge";
import SetupNotice from "@/components/auth/SetupNotice";
import { requireAdmin } from "@/lib/auth/admin";
import { getFilmBySlug } from "@/lib/catalogue";
import { filmHref } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ACCESS_LABELS } from "@/lib/viewing/availability";
import { countryName } from "@/lib/viewing/countries";
import { languageName } from "@/lib/viewing/languages";
import { TRAILER_PROVIDER_NAMES } from "@/lib/viewing/trailers";
import { setTrailerActive, setTrailerStatus, setViewingOptionActive, setViewingOptionStatus } from "@/lib/viewing/actions";
import { listFilmOptionsForAdmin, listFilmTrailersForAdmin, listProviders } from "@/lib/viewing/queries";
import type { FilmTrailer, FilmViewingOption, VerificationStatus, ViewingProvider } from "@/types/viewing";

export const metadata: Metadata = { title: "Manage film viewing — NaijaScreen" };

export default function AdminFilmViewingPage({ params }: PageProps<"/admin/viewing/[slug]">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Checking administrator access…" />}>
      <AdminFilmViewing params={params} />
    </Suspense>
  );
}

async function AdminFilmViewing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdmin(`/admin/viewing/${slug}`);
  const film = getFilmBySlug(slug);
  if (!film) notFound();

  const [providers, options, trailers] = await Promise.all([
    listProviders(),
    listFilmOptionsForAdmin(film.id),
    listFilmTrailersForAdmin(film.id),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-cream-muted">
          <Link href="/admin/viewing" className="hover:text-gold">
            Where to watch
          </Link>{" "}
          / <span className="text-cream">{film.title}</span>
        </nav>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-cream">{film.title}</h1>
        <p className="mt-2 text-sm text-cream-muted">
          {film.releaseYear} · film id <code className="text-cream">{film.id}</code> ·{" "}
          <Link href={filmHref(film.slug)} className="font-semibold text-gold hover:text-cream">
            View public page
          </Link>
        </p>
        {film.isFictional && (
          <p className="mt-4 max-w-3xl rounded-xl border border-gold/50 px-4 py-3 text-sm text-cream">
            This is a fictional sample film. It has no real viewing options or trailers, so don&rsquo;t add real platform links
            to it.
          </p>
        )}
      </header>

      <AdminSection id="options-heading" title="Viewing options">
        {options === null ? (
          <LoadError />
        ) : options.length === 0 ? (
          <p className="mb-6 text-sm text-cream-muted">No viewing options for this film yet.</p>
        ) : (
          <ul className="mb-8 space-y-4">
            {options.map((option) => (
              <OptionRow key={option.id} option={option} filmId={film.id} providers={providers ?? []} />
            ))}
          </ul>
        )}
        <h3 className="mb-4 font-semibold text-cream">Add a viewing option</h3>
        {providers === null ? <LoadError /> : <ViewingOptionForm filmId={film.id} providers={providers} />}
      </AdminSection>

      <AdminSection id="trailers-heading" title="Trailers" description="YouTube or Vimeo uploads by the film's owner or distributor. Only approved trailers are shown.">
        {trailers === null ? (
          <LoadError />
        ) : trailers.length === 0 ? (
          <p className="mb-6 text-sm text-cream-muted">No trailers for this film yet.</p>
        ) : (
          <ul className="mb-8 space-y-4">
            {trailers.map((trailer) => (
              <TrailerRow key={trailer.id} trailer={trailer} filmId={film.id} />
            ))}
          </ul>
        )}
        <h3 className="mb-4 font-semibold text-cream">Add a trailer</h3>
        <TrailerForm filmId={film.id} />
      </AdminSection>
    </div>
  );
}

function OptionRow({ option, filmId, providers }: { option: FilmViewingOption; filmId: string; providers: ViewingProvider[] }) {
  const languages = (codes: string[]) => (codes.length ? codes.map((code) => languageName(code) ?? code).join(", ") : "not recorded");
  return (
    <li className="rounded-2xl border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-cream">
            {option.provider.name} · {ACCESS_LABELS[option.accessType].label}
          </p>
          <a href={option.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-gold hover:text-cream">
            {option.destinationUrl}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <StatusBadge status={option.verificationStatus} active={option.isActive} />
      </div>
      <dl className="mt-3 grid gap-1 text-sm text-cream-muted sm:grid-cols-3">
        <div>
          <dt className="inline">Countries: </dt>
          <dd className="inline text-cream">{option.countries.map(countryName).join(", ")}</dd>
        </div>
        <div>
          <dt className="inline">Audio: </dt>
          <dd className="inline text-cream">{languages(option.audioLanguages)}</dd>
        </div>
        <div>
          <dt className="inline">Subtitles: </dt>
          <dd className="inline text-cream">{languages(option.subtitleLanguages)}</dd>
        </div>
      </dl>
      <div className="mt-2">
        <CheckDates verifiedAt={option.verifiedAt} lastCheckedAt={option.lastCheckedAt} />
      </div>
      <StatusActions
        status={option.verificationStatus}
        active={option.isActive}
        setStatus={(status) => setViewingOptionStatus.bind(null, option.id, status)}
        setActive={(active) => setViewingOptionActive.bind(null, option.id, active)}
        noun="option"
      />
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-cream-muted hover:text-cream">Edit this option</summary>
        <div className="mt-4">
          <ViewingOptionForm filmId={filmId} providers={providers} option={option} />
        </div>
      </details>
    </li>
  );
}

function TrailerRow({ trailer, filmId }: { trailer: FilmTrailer; filmId: string }) {
  return (
    <li className="rounded-2xl border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-cream">
            {trailer.title} · {TRAILER_PROVIDER_NAMES[trailer.videoProvider]}
            {!trailer.embeddable && <span className="ml-2 text-xs text-cream-muted">(link only)</span>}
          </p>
          <a href={trailer.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-gold hover:text-cream">
            {trailer.videoUrl}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <StatusBadge status={trailer.verificationStatus} active={trailer.isActive} />
      </div>
      <div className="mt-2">
        <CheckDates verifiedAt={trailer.verifiedAt} lastCheckedAt={trailer.lastCheckedAt} />
      </div>
      <StatusActions
        status={trailer.verificationStatus}
        active={trailer.isActive}
        setStatus={(status) => setTrailerStatus.bind(null, trailer.id, status)}
        setActive={(active) => setTrailerActive.bind(null, trailer.id, active)}
        noun="trailer"
      />
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-cream-muted hover:text-cream">Edit this trailer</summary>
        <div className="mt-4">
          <TrailerForm filmId={filmId} trailer={trailer} />
        </div>
      </details>
    </li>
  );
}

type Bound = () => Promise<{ ok: boolean; message: string }>;

function StatusActions({
  status,
  active,
  setStatus,
  setActive,
  noun,
}: {
  status: VerificationStatus;
  active: boolean;
  setStatus: (status: VerificationStatus) => Bound;
  setActive: (active: boolean) => Bound;
  noun: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status !== "verified" && (
        <AdminActionButton
          label="Verify"
          tone="positive"
          confirm={`Only verify after checking this ${noun} on the official source. Verify now?`}
          run={setStatus("verified")}
        />
      )}
      {status !== "rejected" && (
        <AdminActionButton label="Reject" tone="danger" confirm={`Reject this ${noun} and hide it from viewers?`} run={setStatus("rejected")} />
      )}
      {status !== "expired" && (
        <AdminActionButton label="Expire" tone="danger" confirm={`Mark this ${noun} as no longer available?`} run={setStatus("expired")} />
      )}
      {status !== "pending" && <AdminActionButton label="Back to pending" run={setStatus("pending")} />}
      {active ? (
        <AdminActionButton label="Deactivate" tone="danger" confirm={`Hide this ${noun} from viewers?`} run={setActive(false)} />
      ) : (
        <AdminActionButton label="Reactivate" tone="positive" run={setActive(true)} />
      )}
    </div>
  );
}

function LoadError() {
  return (
    <p role="alert" className="rounded-xl border border-terracotta/60 bg-clay/20 px-4 py-3 text-sm text-cream">
      This couldn&rsquo;t be loaded. Refresh to try again.
    </p>
  );
}
