import type { Metadata } from "next";
import AccountTabs from "@/components/account/AccountTabs";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { robots: NO_INDEX };

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <main id="main" className="relative">
      <div className="border-b border-line bg-ink-2/60">
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            Your NaijaScreen
          </p>
          <div className="mt-6">
            <AccountTabs />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{children}</div>
    </main>
  );
}
