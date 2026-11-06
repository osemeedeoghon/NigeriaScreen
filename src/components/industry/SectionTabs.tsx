"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

interface Tab {
  href: string;
  label: string;
  exact?: boolean;
}

function Tabs({ label, tabs, pathname }: { label: string; tabs: Tab[]; pathname: string | null }) {
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const current = pathname !== null && (tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`));
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

function ActiveTabs(props: { label: string; tabs: Tab[] }) {
  return <Tabs {...props} pathname={usePathname()} />;
}

/**
 * Underlined tab links; the current page is marked for screen readers. On
 * dynamic routes the path is request data, so the static shell shows the
 * same links without a highlight until it's known.
 */
export default function SectionTabs(props: { label: string; tabs: Tab[] }) {
  return (
    <Suspense fallback={<Tabs {...props} pathname={null} />}>
      <ActiveTabs {...props} />
    </Suspense>
  );
}
