import { STATUS_LABELS } from "@/lib/industry/constants";

const TONES: Record<string, string> = {
  approved: "border-palm/60 bg-palm-deep/30 text-palm",
  verified: "border-palm/60 bg-palm-deep/30 text-palm",
  active: "border-palm/60 bg-palm-deep/30 text-palm",
  pending_review: "border-gold/60 bg-gold/10 text-gold",
  under_review: "border-gold/60 bg-gold/10 text-gold",
  pending: "border-gold/60 bg-gold/10 text-gold",
  invited: "border-gold/60 bg-gold/10 text-gold",
  changes_requested: "border-terracotta/60 bg-clay/20 text-terracotta",
  rejected: "border-terracotta/60 bg-clay/30 text-terracotta",
};

/** Status shown as text, never by colour alone. */
export default function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[status] ?? "border-line bg-surface text-cream-muted"}`}>
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
