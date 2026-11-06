import type { ReactNode } from "react";

/** The bordered card used across the portal and moderation pages. */
export default function Panel({ title, description, children, id, action }: { title: string; description?: ReactNode; children: ReactNode; id?: string; action?: ReactNode }) {
  const headingId = id ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-line bg-ink-2/80 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-display text-2xl font-semibold text-cream">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-cream-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-xl font-semibold text-cream">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-cream-muted">{children}</div>}
    </div>
  );
}

/** Reviewer feedback, shown to the applicant when there is any. */
export function Feedback({ text, tone = "gold" }: { text: string | null; tone?: "gold" | "terracotta" }) {
  if (!text) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone === "gold" ? "border-gold/50" : "border-terracotta/60 bg-clay/20"}`}>
      <p className="font-semibold text-cream">Message from the moderators</p>
      <p className="mt-1 whitespace-pre-line text-cream">{text}</p>
    </div>
  );
}
