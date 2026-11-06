import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import AdminActionButton from "@/components/admin/AdminActionButton";
import SetupNotice from "@/components/auth/SetupNotice";
import { DecisionForm, NoteForm, SuspensionForm } from "@/components/industry/ModerationForms";
import { EmptyState } from "@/components/industry/Panel";
import StatusPill from "@/components/industry/StatusPill";
import { requireAdmin } from "@/lib/auth/admin";
import { moderateApplication, moderateCompany, moderateProfile, moderatePromotion, setPublishedFilmActive } from "@/lib/industry/adminActions";
import {
  adminAccounts,
  adminApplications,
  adminCompanies,
  adminCounts,
  adminNotesFor,
  adminProfiles,
  adminPromotions,
  adminPublishedFilms,
  adminSubmissions,
  type ModerationNote,
} from "@/lib/industry/adminQueries";
import { PLACEMENT_LABELS, ROLE_LABELS, STATUS_LABELS, type Placement, type ProfessionalRole, type PromotionStatus, type ReviewStatus } from "@/lib/industry/constants";
import { moderatorPromotionDecisions, moderatorReviewDecisions } from "@/lib/industry/status";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countryName } from "@/lib/viewing/countries";

export const metadata: Metadata = { title: "Industry moderation — NaijaScreen" };

const VIEWS = [
  { id: "applications", label: "Applications", statuses: ["pending_review", "changes_requested", "approved", "rejected"] },
  { id: "submissions", label: "Film submissions", statuses: ["pending_review", "under_review", "changes_requested", "approved", "rejected"] },
  { id: "profiles", label: "Profile verification", statuses: ["pending", "verified", "rejected", "unverified"] },
  { id: "companies", label: "Companies", statuses: ["pending_review", "changes_requested", "approved", "rejected"] },
  { id: "promotions", label: "Promotions", statuses: ["pending", "approved", "rejected", "expired", "cancelled"] },
  { id: "listings", label: "Approved listings", statuses: [] },
  { id: "accounts", label: "Accounts", statuses: [] },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const when = (value: string | null) => (value ? dateFormat.format(new Date(value)) : "—");

export default function AdminIndustryPage({ searchParams }: PageProps<"/admin/industry">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Checking administrator access…" />}>
      <Moderation searchParams={searchParams} />
    </Suspense>
  );
}

async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/industry");
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const view = (VIEWS.find((v) => v.id === pick("view"))?.id ?? "applications") as ViewId;
  const config = VIEWS.find((v) => v.id === view)!;
  const status = (config.statuses as readonly string[]).includes(pick("status")) ? pick("status") : null;
  const q = pick("q").slice(0, 80);
  const counts = await adminCounts();
  const pendingFor: Partial<Record<ViewId, number>> = counts
    ? { applications: counts.applications, submissions: counts.submissions, profiles: counts.profiles, companies: counts.companies, promotions: counts.promotions }
    : {};
  const href = (next: Record<string, string | null>) => {
    const search = new URLSearchParams();
    const merged = { view, status, q, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    return `/admin/industry?${search}`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-cream">Industry moderation</h1>
        <p className="mt-2 max-w-3xl text-cream-muted">
          Every decision runs through a database function that checks you&rsquo;re an administrator and that you aren&rsquo;t reviewing your
          own work. The person affected is notified, and submission decisions are kept in the history.
        </p>
      </header>

      <nav aria-label="Moderation queues" className="flex gap-1 overflow-x-auto border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/admin/industry?view=${v.id}`}
            aria-current={v.id === view ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap ${v.id === view ? "border-gold text-cream" : "border-transparent text-cream-muted hover:text-cream"}`}
          >
            {v.label}
            {pendingFor[v.id] ? <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs text-ink">{pendingFor[v.id]}</span> : null}
          </Link>
        ))}
      </nav>

      {view !== "accounts" && (
        <form action="/admin/industry" className="flex flex-wrap items-end gap-3" role="search">
          <input type="hidden" name="view" value={view} />
          {config.statuses.length > 0 && (
            <label className="text-sm text-cream">
              <span className="mb-1 block font-semibold">Status</span>
              <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-line bg-ink-2 px-3 py-2">
                <option value="">{view === "profiles" ? "Any" : "All except drafts"}</option>
                {config.statuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view !== "promotions" && (
            <label className="text-sm text-cream">
              <span className="mb-1 block font-semibold">Search</span>
              <input type="search" name="q" defaultValue={q} placeholder="Name or title" className="rounded-lg border border-line bg-ink-2 px-3 py-2" />
            </label>
          )}
          <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream hover:border-gold">
            Apply
          </button>
          {(status || q) && (
            <Link href={href({ status: null, q: null })} className="py-2 text-sm text-cream-muted hover:text-cream">
              Clear
            </Link>
          )}
        </form>
      )}

      {view === "applications" && <Applications status={status} q={q} />}
      {view === "submissions" && <Submissions status={status} q={q} />}
      {view === "profiles" && <Profiles status={status} q={q} />}
      {view === "companies" && <Companies status={status} q={q} />}
      {view === "promotions" && <Promotions status={status} />}
      {view === "listings" && <Listings q={q} />}
      {view === "accounts" && <Accounts />}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="rounded-2xl border border-line bg-ink-2/80 p-5">{children}</li>;
}

function Notes({ notes, subjectType, subjectId }: { notes: ModerationNote[]; subjectType: string; subjectId: string }) {
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <h4 className="text-sm font-semibold text-cream">Private notes</h4>
      {notes.length ? (
        <ul className="space-y-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-surface px-3 py-2 text-cream">
              {n.note} <span className="text-xs text-cream-muted">· {when(n.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cream-muted">None.</p>
      )}
      <NoteForm subjectType={subjectType} subjectId={subjectId} />
    </div>
  );
}

const Links = ({ links }: { links: string[] }) =>
  links.length ? (
    <ul className="mt-2 space-y-1 text-sm">
      {links.map((link) => (
        <li key={link}>
          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-gold hover:text-cream">
            {link}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-cream-muted">No links given.</p>
  );

async function Applications({ status, q }: { status: string | null; q: string }) {
  const rows = await adminApplications(status, q);
  const notes = await adminNotesFor("application", rows.map((r) => r.id));
  if (!rows.length) return <EmptyState title="No applications match">Nothing waiting with these filters.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((a) => (
        <Row key={a.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-cream">
              {a.professional_name} · {ROLE_LABELS[a.professional_role as ProfessionalRole]}
              {a.account_type === "company" && <span className="text-cream-muted"> · company: {a.company_name}</span>}
            </p>
            <StatusPill status={a.status} />
          </div>
          <p className="mt-1 text-xs text-cream-muted">
            {a.country ? countryName(a.country) : "No country"}
            {a.city && `, ${a.city}`} · submitted {when(a.submitted_at)} · reviewed {when(a.reviewed_at)}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-gold">Review</summary>
            <p className="mt-3 text-sm whitespace-pre-line text-cream">{a.biography || "No biography."}</p>
            <Links links={a.portfolio_links} />
            <div className="mt-5">
              <DecisionForm action={moderateApplication} id={a.id} decisions={moderatorReviewDecisions(a.status as ReviewStatus)} />
            </div>
            <Notes notes={notes.get(a.id) ?? []} subjectType="application" subjectId={a.id} />
          </details>
        </Row>
      ))}
    </ul>
  );
}

async function Submissions({ status, q }: { status: string | null; q: string }) {
  const rows = await adminSubmissions(status, q);
  if (!rows.length) return <EmptyState title="No submissions match">Nothing waiting with these filters.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((s) => (
        <Row key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/admin/industry/submissions/${s.id}`} className="font-semibold text-cream hover:text-gold">
              {s.title} {s.release_year && <span className="text-cream-muted">({s.release_year})</span>}
            </Link>
            <StatusPill status={s.status} />
          </div>
          <p className="mt-1 text-xs text-cream-muted">
            Directed by {s.director ?? "—"} · submitted {when(s.submitted_at)} · {s.rights_confirmed ? "rights confirmed by submitter" : "rights not confirmed"}
          </p>
        </Row>
      ))}
    </ul>
  );
}

async function Profiles({ status, q }: { status: string | null; q: string }) {
  const rows = await adminProfiles(status ?? (q ? null : "pending"), q);
  if (!rows.length) return <EmptyState title="No profiles match">No verification requests with these filters.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((p) => (
        <Row key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-cream">
              {p.professional_name} · {ROLE_LABELS[p.professional_role as ProfessionalRole]}
            </p>
            <span className="flex gap-2">
              <StatusPill status={p.verification_status} />
              <StatusPill status={p.visibility === "public" ? "active" : "draft"} label={p.visibility === "public" ? "Public" : "Private"} />
            </span>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-gold">Review</summary>
            <p className="mt-3 text-sm whitespace-pre-line text-cream">{p.biography || "No biography."}</p>
            <Links links={[...(p.website_url ? [p.website_url] : []), ...p.portfolio_links, ...p.social_links]} />
            <div className="mt-5">
              <DecisionForm
                action={moderateProfile}
                id={p.id}
                decisions={p.verification_status === "verified" ? ["unverified"] : p.verification_status === "pending" ? ["verified", "rejected"] : ["verified"]}
              />
            </div>
          </details>
        </Row>
      ))}
    </ul>
  );
}

async function Companies({ status, q }: { status: string | null; q: string }) {
  const rows = await adminCompanies(status, q);
  const notes = await adminNotesFor("company", rows.map((r) => r.id));
  if (!rows.length) return <EmptyState title="No companies match">Nothing waiting with these filters.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((c) => {
        const reviewDecisions = moderatorReviewDecisions(c.review_status as ReviewStatus);
        const verifyDecisions =
          c.review_status !== "approved" ? [] : c.verification_status === "pending" ? ["verified", "verification_rejected"] : c.verification_status === "verified" ? ["unverified"] : ["verified"];
        return (
          <Row key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-cream">{c.name}</p>
              <span className="flex gap-2">
                <StatusPill status={c.review_status} />
                <StatusPill status={c.verification_status} />
              </span>
            </div>
            <p className="mt-1 text-xs text-cream-muted">
              {c.country ? countryName(c.country) : "No country"}
              {c.city && `, ${c.city}`} · submitted {when(c.submitted_at)}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-gold">Review</summary>
              <p className="mt-3 text-sm whitespace-pre-line text-cream">{c.description || "No description."}</p>
              <Links links={[...(c.website_url ? [c.website_url] : []), ...c.social_links]} />
              <p className="mt-2 text-sm text-cream-muted">
                Public contact: {c.public_email ?? "none"} · {c.public_phone ?? "no phone"}
              </p>
              <div className="mt-5">
                <DecisionForm action={moderateCompany} id={c.id} decisions={[...reviewDecisions, ...verifyDecisions]} />
              </div>
              <Notes notes={notes.get(c.id) ?? []} subjectType="company" subjectId={c.id} />
            </details>
          </Row>
        );
      })}
    </ul>
  );
}

async function Promotions({ status }: { status: string | null }) {
  const rows = await adminPromotions(status);
  if (!rows.length) return <EmptyState title="No promotion requests">Nothing with these filters.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <Row key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-cream">
              {r.filmTitle} · {PLACEMENT_LABELS[r.placement as Placement]}
              {r.genre && ` (${r.genre})`}
            </p>
            <StatusPill status={r.status} />
          </div>
          <p className="mt-1 text-xs text-cream-muted">
            {r.starts_on} to {r.ends_on} · editorial, unpaid · requested {when(r.created_at)}
          </p>
          {r.message && <p className="mt-2 text-sm text-cream">&ldquo;{r.message}&rdquo;</p>}
          {moderatorPromotionDecisions(r.status as PromotionStatus).length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-gold">Decide</summary>
              <div className="mt-4">
                <DecisionForm action={moderatePromotion} id={r.id} decisions={moderatorPromotionDecisions(r.status as PromotionStatus)} />
              </div>
            </details>
          )}
        </Row>
      ))}
    </ul>
  );
}

async function Listings({ q }: { q: string }) {
  const rows = await adminPublishedFilms(q);
  if (!rows.length) return <EmptyState title="No approved listings yet">Approving a film submission publishes it here.</EmptyState>;
  return (
    <ul className="space-y-4">
      {rows.map((f) => (
        <Row key={f.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/films/${f.slug}`} className="font-semibold text-cream hover:text-gold">
              {f.title} ({f.release_year})
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill status={f.is_active ? "active" : "draft"} label={f.is_active ? "Listed" : "Hidden"} />
              {f.is_active ? (
                <AdminActionButton label="Hide listing" tone="danger" confirm={`Hide "${f.title}" from the public?`} run={setPublishedFilmActive.bind(null, f.id, false)} />
              ) : (
                <AdminActionButton label="Restore listing" tone="positive" run={setPublishedFilmActive.bind(null, f.id, true)} />
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-cream-muted">
            /films/{f.slug} · published {when(f.published_at)}
          </p>
        </Row>
      ))}
    </ul>
  );
}

async function Accounts() {
  const rows = await adminAccounts();
  if (!rows.length) return <EmptyState title="No industry accounts yet" />;
  return (
    <ul className="space-y-4">
      {rows.map((a) => (
        <Row key={a.user_id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-cream">
              {a.display_name}
              {a.profile_slug && (
                <Link href={`/filmmakers/${a.profile_slug}`} className="ml-2 text-sm font-normal text-gold hover:text-cream">
                  /filmmakers/{a.profile_slug}
                </Link>
              )}
            </p>
            <span className="flex gap-2">
              <StatusPill status="active" label={a.role} />
              {a.suspended_at && <StatusPill status="rejected" label="Suspended" />}
            </span>
          </div>
          {a.suspension_reason && <p className="mt-1 text-sm text-cream-muted">Reason: {a.suspension_reason}</p>}
          {a.role !== "admin" && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-gold">{a.suspended_at ? "Restore" : "Suspend"}</summary>
              <div className="mt-4 max-w-md">
                <SuspensionForm userId={a.user_id} suspended={Boolean(a.suspended_at)} />
              </div>
            </details>
          )}
        </Row>
      ))}
    </ul>
  );
}
