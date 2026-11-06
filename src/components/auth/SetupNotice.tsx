/** Shown in place of account features until Supabase environment variables are set. */
export default function SetupNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className="rounded-xl border border-dashed border-gold/50 px-4 py-4 text-sm leading-relaxed text-cream-muted">
      <p className="font-semibold text-cream">Accounts aren&rsquo;t switched on yet</p>
      {!compact && (
        <p className="mt-1">
          This copy of NaijaScreen isn&rsquo;t connected to Supabase. Add the values from <code>.env.example</code> to{" "}
          <code>.env.local</code> and restart the server to enable sign-in, watchlists and reviews.
        </p>
      )}
    </div>
  );
}
