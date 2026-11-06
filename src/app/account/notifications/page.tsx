import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import SetupNotice from "@/components/auth/SetupNotice";
import { EmptyState } from "@/components/industry/Panel";
import NotificationList from "@/components/industry/NotificationList";
import { requireUser } from "@/lib/auth/session";
import { getOwnNotifications } from "@/lib/industry/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Notifications — NaijaScreen" };

export default function NotificationsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Loading notifications…" />}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  await requireUser("/account/notifications");
  const notifications = await getOwnNotifications();
  return (
    <section aria-labelledby="notifications-heading" className="max-w-3xl">
      <h1 id="notifications-heading" className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
        Notifications
      </h1>
      <p className="mt-2 mb-8 text-cream-muted">Updates on your applications, submissions and promotions. Only you can see these; nothing is emailed.</p>
      {notifications === null ? (
        <p role="alert" className="text-sm text-terracotta">Couldn&rsquo;t load notifications. Refresh to try again.</p>
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications">You&rsquo;ll see updates here when something changes.</EmptyState>
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </section>
  );
}
