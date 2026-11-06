import Link from "next/link";
import Panel, { EmptyState } from "@/components/industry/Panel";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import StatusPill from "@/components/industry/StatusPill";
import { getPortalAccess } from "@/lib/industry/access";
import { getOwnSubmissions } from "@/lib/industry/queries";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function SubmissionsPage() {
  return (
    <PortalGate label="Loading your submissions…">
      <Submissions />
    </PortalGate>
  );
}

async function Submissions() {
  const access = await getPortalAccess("/filmmaker/submissions");
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const submissions = await getOwnSubmissions();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">Film submissions</h1>
          <p className="mt-2 max-w-2xl text-cream-muted">
            Submit a film for the catalogue. Nothing is published until a moderator approves it, and NaijaScreen never hosts films.
          </p>
        </div>
        <Link href="/filmmaker/submissions/new" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
          New submission
        </Link>
      </header>
      <Panel title="Your submissions">
        {submissions === null ? (
          <p role="alert" className="text-sm text-terracotta">Couldn&rsquo;t load your submissions. Refresh to try again.</p>
        ) : submissions.length === 0 ? (
          <EmptyState title="No submissions yet">Start a draft; you can save and come back before submitting.</EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div>
                  <Link href={`/filmmaker/submissions/${s.id}`} className="font-semibold text-cream hover:text-gold">
                    {s.title}
                  </Link>
                  <p className="text-xs text-cream-muted">Updated {dateFormat.format(new Date(s.updated_at))}</p>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
