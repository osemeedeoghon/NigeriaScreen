import type { ReactNode } from "react";

export default function AdminSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-line bg-ink-2/80 p-6 sm:p-8">
      <h2 id={id} className="font-display text-2xl font-semibold text-cream">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-cream-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
