"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/account", label: "Profile" },
  { href: "/account/watchlist", label: "Watchlist" },
  { href: "/account/watched", label: "Watched" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/notifications", label: "Notifications" },
];

export default function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              current ? "border-gold text-cream" : "border-transparent text-cream-muted hover:text-cream"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
