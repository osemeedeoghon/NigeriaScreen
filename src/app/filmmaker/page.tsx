import Link from "next/link";
import PortalGate from "@/components/industry/PortalGate";
import Panel from "@/components/industry/Panel";
import StatusPill from "@/components/industry/StatusPill";
import { getPortalAccess } from "@/lib/industry/access";
import { countUnreadNotifications, getOwnApplication, getOwnCompanies, getOwnFilmmakerProfile, getOwnPromotions, getOwnSubmissions } from "@/lib/industry/queries";

export default function FilmmakerDashboardPage() {
  return (
    <PortalGate label="Loading your portal…">
      <Dashboard />
    </PortalGate>
  );
}

async function Dashboard() {
  const access = await getPortalAccess("/filmmaker");
  const [application, profile, companies, submissions, promotions, unread] = await Promise.all([
    getOwnApplication(access.user.id),
    access.isMember ? getOwnFilmmakerProfile(access.user.id) : null,
    access.isMember ? getOwnCompanies(access.user.id) : [],
    access.isMember ? getOwnSubmissions() : [],
    access.isMember ? getOwnPromotions() : [],
    countUnreadNotifications(),
  ]);

  const count = (status: string) => (submissions ?? []).filter((s) => s.status === status).length;
  const accessLabel = access.suspended ? "Suspended" : access.isAdmin ? "Administrator" : access.isMember ? (access.role === "company" ? "Production company" : "Filmmaker") : "Viewer";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-cream">Your filmmaker portal</h1>
          <p className="mt-2 text-cream-muted">
            Account type: <span className="font-semibold text-cream">{accessLabel}</span>
          </p>
        </div>
        <Link href="/account/notifications" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream hover:border-gold">
          Notifications{unread > 0 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs text-ink">{unread} new</span>}
        </Link>
      </header>

      {!access.isMember && (
        <Panel title={access.suspended ? "Industry access suspended" : "Get filmmaker access"} description="Viewers can apply; a moderator approves every account by hand.">
          <div className="flex flex-wrap items-center gap-4">
            {application ? <StatusPill status={application.status} /> : <span className="text-sm text-cream-muted">No application yet.</span>}
            <Link href="/filmmaker/onboarding" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
              {application ? "View your application" : "Start your application"}
            </Link>
          </div>
        </Panel>
      )}

      {access.isMember && (
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Profile" description={profile ? `/${"filmmakers"}/${profile.slug}` : "Set up your public professional profile."}>
            <div className="flex flex-wrap items-center gap-3">
              {profile && <StatusPill status={profile.visibility === "public" ? "active" : "draft"} label={profile.visibility === "public" ? "Public" : "Private"} />}
              {profile && <StatusPill status={profile.verification_status} />}
              <Link href="/filmmaker/profile" className="text-sm font-semibold text-gold hover:text-cream">
                {profile ? "Edit profile" : "Create profile"} →
              </Link>
            </div>
          </Panel>
          <Panel title="Company" description="Production companies and teams you belong to.">
            {companies.length ? (
              <ul className="space-y-2 text-sm">
                {companies.map(({ company, membership }) => (
                  <li key={company.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-cream">{company.name}</span>
                    <StatusPill status={membership.status === "invited" ? "invited" : company.review_status} label={membership.status === "invited" ? "Invitation" : undefined} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cream-muted">None yet.</p>
            )}
            <Link href="/filmmaker/company" className="mt-3 inline-block text-sm font-semibold text-gold hover:text-cream">
              Manage company →
            </Link>
          </Panel>
          <Panel title="Film submissions">
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Drafts", count("draft") + count("changes_requested")],
                ["In review", count("pending_review") + count("under_review")],
                ["Approved", count("approved")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line p-3">
                  <dt className="text-xs text-cream-muted">{label}</dt>
                  <dd className="font-display text-2xl font-semibold text-cream">{value}</dd>
                </div>
              ))}
            </dl>
            <Link href="/filmmaker/submissions" className="mt-4 inline-block text-sm font-semibold text-gold hover:text-cream">
              Your submissions →
            </Link>
          </Panel>
          <Panel title="Promotions" description="Editorial placements for your approved films. No paid promotion exists yet.">
            <p className="text-sm text-cream-muted">{(promotions ?? []).filter((p) => p.status === "pending").length} pending request(s).</p>
            <Link href="/filmmaker/promotions" className="mt-3 inline-block text-sm font-semibold text-gold hover:text-cream">
              Request a placement →
            </Link>
          </Panel>
        </div>
      )}
    </div>
  );
}
