/** Placeholder while the signed-in user's data streams in. */
export default function AccountSkeleton({ label = "Loading your account…" }: { label?: string }) {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-8 w-56 animate-pulse rounded-lg bg-surface" />
      <div aria-hidden="true" className="h-4 w-80 max-w-full animate-pulse rounded bg-surface" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
