import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import ProfileForm from "@/components/account/ProfileForm";
import SetupNotice from "@/components/auth/SetupNotice";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getAccountCounts, getOwnProfile } from "@/lib/library/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Your account — NaijaScreen" };

export default function AccountPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountOverview />
    </Suspense>
  );
}

async function AccountOverview() {
  const { user } = await requireUser("/account");
  const [profile, counts] = await Promise.all([getOwnProfile(user.id), getAccountCounts()]);
  const name = profile?.display_name ?? "NaijaScreen viewer";

  const stats = [
    { label: "On your watchlist", value: counts?.watchlist ?? 0, href: "/account/watchlist" },
    { label: "Films watched", value: counts?.watched ?? 0, href: "/account/watched" },
    { label: "Reviews written", value: counts?.reviews ?? 0 },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-gold-deep font-display text-2xl font-semibold text-ink"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">{name}</h1>
            <p className="truncate text-cream-muted">{user.email}</p>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-ink-2 p-5">
              <dt className="text-sm text-cream-muted">{stat.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-cream">
                {stat.href ? (
                  <Link href={stat.href} className="hover:text-gold">
                    {stat.value}
                  </Link>
                ) : (
                  stat.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="profile-heading" className="mt-12 max-w-xl">
          <h2 id="profile-heading" className="font-display text-2xl font-semibold text-cream">
            Profile details
          </h2>
          <div className="mt-6">
            <ProfileForm displayName={name} username={profile?.username ?? null} avatarUrl={profile?.avatar_url ?? null} />
          </div>
        </section>
      </div>

      <aside aria-labelledby="security-heading" className="h-fit rounded-2xl border border-line bg-ink-2 p-6">
        <h2 id="security-heading" className="font-display text-xl font-semibold text-cream">
          Sign-in and security
        </h2>
        <p className="mt-2 text-sm text-cream-muted">Signed in as {user.email}.</p>
        <div className="mt-6 space-y-3">
          <Link
            href="/account/update-password"
            className="block rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold text-cream transition-colors hover:border-gold"
          >
            Change password
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-full border border-terracotta/60 px-4 py-2.5 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
