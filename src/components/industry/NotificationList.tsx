"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationsRead } from "@/lib/industry/actions";
import type { Notification } from "@/lib/industry/queries";

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function NotificationList({ notifications }: { notifications: Notification[] }) {
  const [pending, start] = useTransition();
  const unread = notifications.filter((n) => !n.read_at);
  return (
    <div>
      {unread.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await markNotificationsRead("all")))}
          className="mb-4 rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream hover:border-gold disabled:opacity-60"
        >
          {pending ? "Marking…" : `Mark all ${unread.length} as read`}
        </button>
      )}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {notifications.map((n) => (
          <li key={n.id} className={`px-4 py-4 ${n.read_at ? "" : "bg-gold/5"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-cream">
                {!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold" aria-label="Unread" />}
                {n.link ? (
                  <Link href={n.link} className="hover:text-gold" onClick={() => !n.read_at && start(async () => void (await markNotificationsRead([n.id])))}>
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </p>
              <time dateTime={n.created_at} className="text-xs text-cream-muted">
                {dateTime.format(new Date(n.created_at))}
              </time>
            </div>
            {n.body && <p className="mt-1 text-sm whitespace-pre-line text-cream-muted">{n.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
