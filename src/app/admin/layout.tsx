import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — NaijaScreen", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main id="main">
      <div className="border-b border-line bg-ink-2/60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-terracotta uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            Administrators only
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
