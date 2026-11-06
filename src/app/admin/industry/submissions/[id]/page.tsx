import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import SetupNotice from "@/components/auth/SetupNotice";
import { DecisionForm, NoteForm } from "@/components/industry/ModerationForms";
import Panel from "@/components/industry/Panel";
import StatusPill from "@/components/industry/StatusPill";
import SubmissionHistory from "@/components/industry/SubmissionHistory";
import { requireAdmin } from "@/lib/auth/admin";
import { getGenreBySlug } from "@/lib/catalogue";
import { moderateSubmission } from "@/lib/industry/adminActions";
import { adminSubmission } from "@/lib/industry/adminQueries";
import type { SubmissionStatus } from "@/lib/industry/constants";
import { asViewingLinks } from "@/lib/industry/queries";
import { moderatorSubmissionDecisions } from "@/lib/industry/status";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countryName } from "@/lib/viewing/countries";
import { languageName } from "@/lib/viewing/languages";
import { parseTrailerUrl } from "@/lib/viewing/trailers";
import { slugify } from "@/lib/viewing/validation";

export const metadata: Metadata = { title: "Review submission — NaijaScreen" };

export default function AdminSubmissionPage({ params }: PageProps<"/admin/industry/submissions/[id]">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Checking administrator access…" />}>
      <Review params={params} />
    </Suspense>
  );
}

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-gold hover:text-cream">
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/industry/submissions/${id}`);
  const found = await adminSubmission(id);
  if (!found) notFound();
  const { submission: s, events, notes, company } = found;
  const viewing = asViewingLinks(s.viewing_links);
  const trailer = s.trailer_url ? parseTrailerUrl(s.trailer_url) : null;

  const facts: [string, React.ReactNode][] = [
    ["Original title", s.original_title],
    ["Release year", s.release_year],
    ["Runtime", s.runtime_minutes ? `${s.runtime_minutes} minutes` : null],
    ["Genres", s.genres.map((g) => getGenreBySlug(g)?.name ?? g).join(", ")],
    ["Language", s.language ? (languageName(s.language) ?? s.language) : null],
    ["Country", s.country ? countryName(s.country) : null],
    ["Director", s.director],
    ["Producers", s.producers.join(", ")],
    ["Cast", s.cast_names.join(", ")],
    ["Company", company ? `${company.name} (/companies/${company.slug})` : null],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div className="space-y-8">
        <Link href="/admin/industry?view=submissions" className="text-sm text-cream-muted hover:text-gold">
          ← Film submissions
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">{s.title}</h1>
          <StatusPill status={s.status} />
        </div>

        <Panel title="Details">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-cream-muted">{label}</dt>
                <dd className="text-cream">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-cream">Synopsis</h3>
          <p className="mt-1 text-sm whitespace-pre-line text-cream">{s.synopsis || "—"}</p>
        </Panel>

        <Panel title="Links to check" description="Open each one and confirm it's official before approving. Nothing here is fetched or rehosted.">
          <ul className="space-y-2 text-sm">
            <li>
              Trailer: {s.trailer_url ? <External href={s.trailer_url}>{s.trailer_url}</External> : "—"}
              {s.trailer_url && !trailer && <span className="ml-2 text-terracotta">(not YouTube/Vimeo, so it can&rsquo;t be embedded)</span>}
            </li>
            <li>Poster: {s.poster_url ? <External href={s.poster_url}>{s.poster_url}</External> : "—"}</li>
            <li>Website: {s.website_url ? <External href={s.website_url}>{s.website_url}</External> : "—"}</li>
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-cream">Viewing destinations given</h3>
          {viewing.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {viewing.map((link) => (
                <li key={link.url}>
                  {link.label}: <External href={link.url}>{link.url}</External>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-cream-muted">None.</p>
          )}
          <p className="mt-3 text-xs text-cream-muted">Approving doesn&rsquo;t add these to Where to Watch; verified options are managed separately.</p>
        </Panel>

        <Panel title="Rights">
          <p className="text-sm text-cream">{s.rights_confirmed ? "The submitter confirmed they own or are authorised to submit this film." : "Not confirmed."}</p>
          {s.rights_statement && <p className="mt-2 text-sm whitespace-pre-line text-cream-muted">&ldquo;{s.rights_statement}&rdquo;</p>}
          <p className="mt-2 text-xs text-cream-muted">A confirmation isn&rsquo;t proof of copyright. Ask for more information if anything is unclear.</p>
          {s.notes_for_admins && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-cream">Notes from the submitter</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-cream">{s.notes_for_admins}</p>
            </>
          )}
        </Panel>

        <Panel title="Decision">
          <DecisionForm action={moderateSubmission} id={s.id} decisions={moderatorSubmissionDecisions(s.status as SubmissionStatus)} suggestedSlug={slugify(s.title)} />
        </Panel>
      </div>

      <aside className="h-fit space-y-6">
        <div className="rounded-2xl border border-line bg-ink-2 p-6">
          <h2 className="mb-4 font-display text-xl font-semibold text-cream">History</h2>
          <SubmissionHistory events={events} />
        </div>
        <div className="rounded-2xl border border-line bg-ink-2 p-6">
          <h2 className="font-display text-xl font-semibold text-cream">Private notes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-surface px-3 py-2 text-cream">
                {n.note}
              </li>
            ))}
            {!notes.length && <li className="text-cream-muted">None.</li>}
          </ul>
          <div className="mt-4">
            <NoteForm subjectType="submission" subjectId={s.id} />
          </div>
        </div>
      </aside>
    </div>
  );
}
