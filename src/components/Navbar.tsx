"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Wordmark from "./Wordmark";

const links = [
  { href: "/films", label: "Browse films" },
  { href: "/#featured", label: "Featured" },
  { href: "/#genres", label: "Genres" },
  { href: "/#trending", label: "Trending" },
  { href: "/#people", label: "People" },
  { href: "/#stories", label: "Stories" },
  { href: "/industry", label: "Industry" },
];

interface NavbarProps {
  /** Account actions for wide screens, streamed in by the server. */
  account: ReactNode;
  /** Account actions inside the mobile menu. */
  mobileAccount: ReactNode;
}

export default function Navbar({ account, mobileAccount }: NavbarProps) {
  const [open, setOpen] = useState(false);

  // Close the mobile menu when any link inside it is followed.
  const closeOnLink = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ink/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Wordmark />

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-cream-muted transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden lg:block">{account}</div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-cream lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
          </svg>
        </button>
      </nav>

      <div id="mobile-menu" hidden={!open} onClick={closeOnLink} className="border-t border-line/70 bg-ink lg:hidden">
        <ul className="mx-auto max-w-7xl space-y-1 px-4 py-4">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-md px-3 py-3 text-base font-medium text-cream hover:bg-surface"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="mt-2 border-t border-line/70 pt-4">{mobileAccount}</li>
        </ul>
      </div>
    </header>
  );
}
