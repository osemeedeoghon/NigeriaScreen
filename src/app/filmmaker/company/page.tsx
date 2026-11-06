import Link from "next/link";
import AdminActionButton from "@/components/admin/AdminActionButton";
import Panel, { EmptyState, Feedback } from "@/components/industry/Panel";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import { CompanyForm, InviteForm } from "@/components/industry/PortalForms";
import StatusPill from "@/components/industry/StatusPill";
import { acceptInvite, removeMember, requestCompanyVerification } from "@/lib/industry/actions";
import { getPortalAccess } from "@/lib/industry/access";
import { countryOptions } from "@/lib/industry/options";
import { getOwnCompanies } from "@/lib/industry/queries";
import { ownerCanEdit } from "@/lib/industry/status";

export default function CompanyPage() {
  return (
    <PortalGate label="Loading your companies…">
      <Companies />
    </PortalGate>
  );
}

async function Companies() {
  const access = await getPortalAccess("/filmmaker/company");
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const companies = await getOwnCompanies(access.user.id);
  const invitations = companies.filter((c) => c.membership.status === "invited");
  const active = companies.filter((c) => c.membership.status === "active");
  const countries = countryOptions();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">Production companies</h1>
        <p className="mt-2 max-w-2xl text-cream-muted">
          Create a company profile, invite your team and link films to it. Companies appear in the directory once a moderator approves them.
        </p>
      </header>

      {invitations.length > 0 && (
        <Panel title="Invitations">
          <ul className="space-y-3">
            {invitations.map(({ company, membership }) => (
              <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
                <span className="text-cream">
                  {company.name} invited you as a {membership.member_role}.
                </span>
                <span className="flex flex-wrap gap-2">
                  <AdminActionButton label="Accept" tone="positive" run={acceptInvite.bind(null, membership.id)} />
                  <AdminActionButton label="Decline" tone="danger" confirm={`Decline the invitation from ${company.name}?`} run={removeMember.bind(null, membership.id)} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {active.map(({ company, membership, roster }) => {
        const manager = membership.member_role === "owner" || membership.member_role === "manager";
        return (
          <Panel
            key={company.id}
            title={company.name}
            description={`/companies/${company.slug} · you are ${membership.member_role === "owner" ? "the owner" : `a ${membership.member_role}`}`}
            action={
              <span className="flex flex-wrap gap-2">
                <StatusPill status={company.review_status} />
                <StatusPill status={company.verification_status} />
              </span>
            }
          >
            <div className="space-y-8">
              <Feedback text={company.reviewer_feedback} tone={company.review_status === "rejected" ? "terracotta" : "gold"} />
              {company.review_status === "approved" && company.visibility === "public" && (
                <Link href={`/companies/${company.slug}`} className="text-sm font-semibold text-gold hover:text-cream">
                  View public page →
                </Link>
              )}
              {manager && company.review_status === "approved" && (
                <p className="text-sm text-cream-muted">Saving changes to an approved company sends it back to the moderators and removes any verification until they approve it again.</p>
              )}
              {manager ? (
                <CompanyForm
                  companyId={company.id}
                  countries={countries}
                  canSubmit={ownerCanEdit(company.review_status)}
                  locked={company.review_status === "pending_review" || company.review_status === "rejected"}
                  initial={{
                    name: company.name,
                    slug: company.slug,
                    logoUrl: company.logo_url ?? "",
                    description: company.description,
                    country: company.country ?? "",
                    city: company.city ?? "",
                    websiteUrl: company.website_url ?? "",
                    publicEmail: company.public_email ?? "",
                    publicPhone: company.public_phone ?? "",
                    socialLinks: company.social_links.join("\n"),
                    visibility: company.visibility,
                    reviewStatus: company.review_status,
                  }}
                />
              ) : (
                <p className="text-sm text-cream-muted">Only the owner and managers can edit company details.</p>
              )}
              {manager && company.review_status === "approved" && (company.verification_status === "unverified" || company.verification_status === "rejected") && (
                <AdminActionButton label="Request company verification" tone="positive" run={requestCompanyVerification.bind(null, company.id)} />
              )}

              <div>
                <h3 className="mb-3 font-semibold text-cream">Team</h3>
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {roster.map((member) => (
                    <li key={member.member_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="text-cream">
                        {member.profile_slug ? (
                          <Link href={`/filmmakers/${member.profile_slug}`} className="hover:text-gold">
                            {member.profile_name}
                          </Link>
                        ) : (
                          member.display_name
                        )}
                        <span className="ml-2 text-cream-muted capitalize">{member.member_role}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {member.status === "invited" && <StatusPill status="invited" label="Invited" />}
                        {member.member_role !== "owner" && (manager || member.is_self) && (
                          <AdminActionButton
                            label={member.is_self ? "Leave" : "Remove"}
                            tone="danger"
                            confirm={member.is_self ? `Leave ${company.name}?` : `Remove ${member.profile_name ?? member.display_name}?`}
                            run={removeMember.bind(null, member.member_id)}
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {manager && (
                <div>
                  <h3 className="mb-3 font-semibold text-cream">Invite a team member</h3>
                  <InviteForm companyId={company.id} />
                </div>
              )}
            </div>
          </Panel>
        );
      })}

      <Panel title="Create a company" description="It starts as a draft. Submit it for review when it's ready.">
        {active.length === 0 && invitations.length === 0 && (
          <div className="mb-6">
            <EmptyState title="No companies yet">Create one below, or ask a company owner to invite you.</EmptyState>
          </div>
        )}
        <CompanyForm initial={{ visibility: "public" }} countries={countries} canSubmit />
      </Panel>
    </div>
  );
}
