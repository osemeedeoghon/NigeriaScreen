import type { VerificationStatus } from "@/types/viewing";

const STYLES: Record<VerificationStatus, string> = {
  verified: "border-palm/60 bg-palm-deep/30 text-palm",
  pending: "border-gold/60 bg-gold/10 text-gold",
  rejected: "border-terracotta/60 bg-clay/30 text-terracotta",
  expired: "border-line bg-surface text-cream-muted",
};

export default function StatusBadge({ status, active = true }: { status: VerificationStatus; active?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STYLES[status]}`}>{status}</span>
      {!active && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-cream-muted">Inactive</span>}
    </span>
  );
}

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Verification and last-checked dates for admin lists. */
export function CheckDates({ verifiedAt, lastCheckedAt }: { verifiedAt: string | null; lastCheckedAt: string | null }) {
  return (
    <p className="text-xs text-cream-muted">
      Verified: {verifiedAt ? dateTime.format(new Date(verifiedAt)) : "never"} · Last checked:{" "}
      {lastCheckedAt ? dateTime.format(new Date(lastCheckedAt)) : "never"}
    </p>
  );
}
