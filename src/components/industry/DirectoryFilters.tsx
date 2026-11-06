import Link from "next/link";
import type { ReactNode } from "react";

/** A plain GET form, so filters work without JavaScript and are shareable as URLs. */
export default function DirectoryFilters({ action, children, active }: { action: string; children: ReactNode; active: boolean }) {
  return (
    <form action={action} role="search" className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-ink-2 p-4">
      {children}
      <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
        Filter
      </button>
      {active && (
        <Link href={action} className="py-2.5 text-sm text-cream-muted hover:text-cream">
          Clear filters
        </Link>
      )}
    </form>
  );
}

export function FilterSelect({ label, name, value, options, anyLabel }: { label: string; name: string; value: string; options: { value: string; label: string }[]; anyLabel: string }) {
  return (
    <label className="text-sm text-cream">
      <span className="mb-1 block font-semibold">{label}</span>
      <select name={name} defaultValue={value} className="rounded-lg border border-line bg-ink px-3 py-2">
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterText({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="text-sm text-cream">
      <span className="mb-1 block font-semibold">{label}</span>
      <input type="text" name={name} defaultValue={value} maxLength={80} className="rounded-lg border border-line bg-ink px-3 py-2" />
    </label>
  );
}
