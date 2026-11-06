import Link from "next/link";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import SubmissionEditor from "@/components/industry/SubmissionEditor";
import { getPortalAccess } from "@/lib/industry/access";
import { getOwnCompanies } from "@/lib/industry/queries";

export default function NewSubmissionPage() {
  return (
    <PortalGate label="Loading the submission form…">
      <NewSubmission />
    </PortalGate>
  );
}

async function NewSubmission() {
  const access = await getPortalAccess("/filmmaker/submissions/new");
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const companies = await getOwnCompanies(access.user.id);
  return (
    <div className="max-w-4xl">
      <Link href="/filmmaker/submissions" className="text-sm text-cream-muted hover:text-gold">
        ← Submissions
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">Submit a film</h1>
      <p className="mt-2 text-cream-muted">Save a draft at any time. Required fields only apply when you submit for review.</p>
      <div className="mt-8">
        <SubmissionEditor companies={companies} />
      </div>
    </div>
  );
}
