import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import SavedFilms from "@/components/account/SavedFilms";
import SetupNotice from "@/components/auth/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Films you've watched — NaijaScreen" };

export default function WatchedPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Loading your watched films…" />}>
      <SavedFilms
        list="watched_films"
        path="/account/watched"
        title="Films you've watched"
        emptyTitle="No films marked as watched"
        emptyText="Mark a film as watched from its card or detail page to keep track of what you've seen."
      />
    </Suspense>
  );
}
