import Link from "next/link";
import { Feedback } from "@/components/industry/Panel";
import PortalGate from "@/components/industry/PortalGate";
import { ApplicationForm } from "@/components/industry/PortalForms";
import StatusPill from "@/components/industry/StatusPill";
import { getPortalAccess } from "@/lib/industry/access";
import { countryOptions } from "@/lib/industry/options";
import { getOwnApplication } from "@/lib/industry/queries";
import { ownerCanEdit } from "@/lib/industry/status";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const STEPS = ["Choose your account type and role", "Tell us about your work", "Add portfolio links", "Submit for review"];

export default function OnboardingPage() {
  return (
    <PortalGate label="Loading your application…">
      <Onboarding />
    </PortalGate>
  );
}

async function Onboarding() {
  const access = await getPortalAccess("/filmmaker/onboarding");
  const application = await getOwnApplication(access.user.id);
  const status = application?.status ?? "draft";
  const editable = !application || ownerCanEdit(status);

  const initial: Record<string, string> = application
    ? {
        accountType: application.account_type,
        professionalName: application.professional_name,
        professionalRole: application.professional_role,
        companyName: application.company_name ?? "",
        biography: application.biography,
        country: application.country ?? "",
        city: application.city ?? "",
        portfolioLinks: application.portfolio_links.join("\n"),
      }
    : { accountType: "filmmaker" };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-14">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">Request filmmaker access</h1>
        <p className="mt-2 max-w-2xl text-cream-muted">
          For actors, directors, producers, crew and production companies. A moderator reviews every request; registering doesn&rsquo;t make
          anyone &ldquo;verified&rdquo;.
        </p>

        {application && (
          <div className="mt-6 space-y-3">
            <p className="flex flex-wrap items-center gap-3 text-sm text-cream-muted">
              Status: <StatusPill status={status} />
              {application.submitted_at && <span>Submitted {dateFormat.format(new Date(application.submitted_at))}</span>}
              {application.reviewed_at && <span>· Reviewed {dateFormat.format(new Date(application.reviewed_at))}</span>}
            </p>
            <Feedback text={application.reviewer_feedback} tone={status === "rejected" ? "terracotta" : "gold"} />
          </div>
        )}

        <div className="mt-8">
          {access.isMember ? (
            <div className="rounded-2xl border border-palm/60 p-6">
              <p className="font-semibold text-cream">You&rsquo;re approved.</p>
              <Link href="/filmmaker/profile" className="mt-3 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
                Set up your profile
              </Link>
            </div>
          ) : editable ? (
            <ApplicationForm initial={initial} countries={countryOptions()} />
          ) : (
            <p className="rounded-2xl border border-line p-6 text-cream-muted">
              {status === "rejected"
                ? "This application wasn't approved. If you think that's a mistake, contact the NaijaScreen team."
                : "Your application is with the moderators. You'll get a notification when it's reviewed."}
            </p>
          )}
        </div>
      </div>
      <aside aria-labelledby="steps-heading" className="h-fit rounded-2xl border border-line bg-ink-2 p-6">
        <h2 id="steps-heading" className="font-display text-xl font-semibold text-cream">
          How it works
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-cream-muted">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-gold">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-cream-muted">
          Statuses: Draft → Pending review → Approved, Rejected or Changes requested. If changes are requested, edit and resubmit here.
        </p>
      </aside>
    </div>
  );
}
