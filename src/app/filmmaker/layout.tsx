import type { Metadata } from "next";
import SectionTabs from "@/components/industry/SectionTabs";

export const metadata: Metadata = { title: "Filmmaker portal — NaijaScreen", robots: { index: false, follow: false } };

const tabs = [
  { href: "/filmmaker", label: "Dashboard", exact: true },
  { href: "/filmmaker/onboarding", label: "Application" },
  { href: "/filmmaker/profile", label: "Profile" },
  { href: "/filmmaker/company", label: "Company" },
  { href: "/filmmaker/submissions", label: "Submissions" },
  { href: "/filmmaker/promotions", label: "Promotions" },
];

export default function FilmmakerLayout({ children }: LayoutProps<"/filmmaker">) {
  return (
    <main id="main">
      <div className="border-b border-line bg-ink-2/60">
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            Filmmaker portal
          </p>
          <div className="mt-6">
            <SectionTabs label="Filmmaker portal" tabs={tabs} />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{children}</div>
    </main>
  );
}
