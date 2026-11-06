import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Suspense } from "react";
import { AccountMenuPlaceholder } from "@/components/account/AccountMenu";
import AccountNav, { LibraryLoader } from "@/components/account/AccountNav";
import Footer from "@/components/Footer";
import LibraryProvider from "@/components/library/LibraryProvider";
import Navbar from "@/components/Navbar";
import { indexingAllowed, NO_INDEX } from "@/lib/seo";
import { getSiteUrl } from "@/lib/supabase/config";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const description =
  "Discover Nollywood films, explore genres, meet the actors and directors behind them, and find legitimate places to watch.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "NaijaScreen — Discover Nollywood films",
  description,
  applicationName: "NaijaScreen",
  openGraph: { type: "website", siteName: "NaijaScreen", locale: "en_NG", title: "NaijaScreen — Discover Nollywood films", description },
  twitter: { card: "summary", title: "NaijaScreen — Discover Nollywood films", description },
  // Off until the real catalogue launches (NEXT_PUBLIC_ALLOW_INDEXING).
  robots: indexingAllowed() ? undefined : NO_INDEX,
};

export const viewport: Viewport = {
  themeColor: "#14100d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:font-semibold focus:text-ink"
        >
          Skip to main content
        </a>
        <LibraryProvider>
          {/* Session-dependent pieces stream in; everything else stays in the static shell. */}
          <Navbar
            account={
              <Suspense fallback={<AccountMenuPlaceholder variant="desktop" />}>
                <AccountNav variant="desktop" />
              </Suspense>
            }
            mobileAccount={
              <Suspense fallback={<AccountMenuPlaceholder variant="mobile" />}>
                <AccountNav variant="mobile" />
              </Suspense>
            }
          />
          {children}
          <Footer />
          <Suspense fallback={null}>
            <LibraryLoader />
          </Suspense>
        </LibraryProvider>
      </body>
    </html>
  );
}
