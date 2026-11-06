import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import SetupNotice from "../auth/SetupNotice";
import AccountSkeleton from "../account/AccountSkeleton";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Wraps a portal page: setup notice without Supabase, otherwise a streamed body. */
export default function PortalGate({ children, label = "Loading…" }: { children: ReactNode; label?: string }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return <Suspense fallback={<AccountSkeleton label={label} />}>{children}</Suspense>;
}

/** Shown on member-only pages to viewers who haven't been approved. */
export function NeedsApproval({ suspended = false }: { suspended?: boolean }) {
  return (
    <div className="max-w-2xl rounded-2xl border border-gold/50 p-6">
      <h1 className="font-display text-2xl font-semibold text-cream">{suspended ? "Your industry access is suspended" : "Approved filmmakers only"}</h1>
      <p className="mt-2 text-cream-muted">
        {suspended
          ? "A moderator has suspended industry features on this account. Your viewer features still work. Check your notifications for the reason."
          : "Profiles, companies, submissions and promotions open once a moderator approves your application."}
      </p>
      {!suspended && (
        <Link href="/filmmaker/onboarding" className="mt-5 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
          Go to your application
        </Link>
      )}
    </div>
  );
}
