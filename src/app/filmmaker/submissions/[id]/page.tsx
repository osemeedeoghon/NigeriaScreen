import Link from "next/link";
import { notFound } from "next/navigation";
import AdminActionButton from "@/components/admin/AdminActionButton";
import Panel, { Feedback } from "@/components/industry/Panel";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import StatusPill from "@/components/industry/StatusPill";
import SubmissionEditor from "@/components/industry/SubmissionEditor";
import SubmissionHistory from "@/components/industry/SubmissionHistory";
import { deleteDraftSubmission } from "@/lib/industry/actions";
import { getPortalAccess } from "@/lib/industry/access";
import { getOwnCompanies, getSubmissionWithHistory } from "@/lib/industry/queries";
import { ownerCanEdit } from "@/lib/industry/status";

export default function SubmissionPage({ params, searchParams }: PageProps<"/filmmaker/submissions/[id]">) {
  return (
    <PortalGate label="Loading the submission…">
      <SubmissionDetail params={params} searchParams={searchParams} />
    </PortalGate>
  );
}

async function SubmissionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const access = await getPortalAccess(`/filmmaker/submissions/${id}`);
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const [found, companies] = await Promise.all([getSubmissionWithHistory(id), getOwnCompanies(access.user.id)]);
  if (!found) notFound();
  const { submission, events } = found;
  const editable = ownerCanEdit(submission.status);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-14">
      <div className="space-y-6">
        <Link href="/filmmaker/submissions" className="text-sm text-cream-muted hover:text-gold">
          ← Submissions
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">{submission.title}</h1>
          <StatusPill status={submission.status} />
        </div>
        {query.saved && (
          <p role="status" className="rounded-xl border border-palm/60 bg-palm-deep/20 px-4 py-3 text-sm text-cream">
            {query.saved === "submit" ? "Submitted for review." : "Draft saved."}
          </p>
        )}
        <Feedback text={submission.reviewer_feedback} tone={submission.status === "rejected" ? "terracotta" : "gold"} />
        {submission.status === "approved" && submission.published_film_id && (
          <p className="rounded-xl border border-palm/60 px-4 py-3 text-sm text-cream">
            Approved and listed.{" "}
            <Link href={`/films/${submission.published_film_id.replace(/^film-/, "")}`} className="font-semibold text-gold hover:text-cream">
              View the public page →
            </Link>
          </p>
        )}
        {editable ? (
          <>
            <SubmissionEditor submission={submission} companies={companies} />
            {submission.status === "draft" && (
              <AdminActionButton label="Delete draft" tone="danger" confirm="Delete this draft permanently?" run={deleteDraftSubmission.bind(null, submission.id)} />
            )}
          </>
        ) : (
          <Panel title="Submitted details" description="Locked while it's with the moderators.">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Year", submission.release_year],
                ["Runtime", submission.runtime_minutes ? `${submission.runtime_minutes} min` : null],
                ["Director", submission.director],
                ["Language", submission.language],
                ["Country", submission.country],
                ["Genres", submission.genres.join(", ")],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-cream-muted">{label}</dt>
                  <dd className="text-cream">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm whitespace-pre-line text-cream">{submission.synopsis}</p>
          </Panel>
        )}
      </div>
      <aside aria-labelledby="history-heading" className="h-fit rounded-2xl border border-line bg-ink-2 p-6">
        <h2 id="history-heading" className="mb-4 font-display text-xl font-semibold text-cream">
          History
        </h2>
        <SubmissionHistory events={events} />
      </aside>
    </div>
  );
}
