import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import SavedFilms from "@/components/account/SavedFilms";
import SetupNotice from "@/components/auth/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Your watchlist — NaijaScreen" };

export default function WatchlistPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Loading your watchlist…" />}>
      <SavedFilms
        list="watchlist"
        path="/account/watchlist"
        title="Your watchlist"
        emptyTitle="Nothing saved yet"
        emptyText="Tap the bookmark on any film to save it here for later."
      />
    </Suspense>
  );
}
