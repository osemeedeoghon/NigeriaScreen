"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";

const accountLinks = [
  { href: "/account", label: "Profile" },
  { href: "/account/watchlist", label: "Watchlist" },
  { href: "/account/watched", label: "Watched films" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/filmmaker", label: "Filmmaker portal" },
];

interface AccountMenuProps {
  /** Display name of the signed-in user, or null for visitors. */
  name: string | null;
  /** From the server-read profile; only changes which links are shown. */
  isAdmin?: boolean;
  variant: "desktop" | "mobile";
}

const adminLinks = [
  { href: "/admin/viewing", label: "Admin: where to watch" },
  { href: "/admin/industry", label: "Admin: industry" },
];

export default function AccountMenu({ name, isAdmin = false, variant }: AccountMenuProps) {
  const links = isAdmin ? [...accountLinks, ...adminLinks] : accountLinks;
  if (variant === "mobile") return <MobileAccount name={name} links={links} />;
  if (!name) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-cream transition-colors hover:text-gold">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold whitespace-nowrap text-gold transition-colors hover:bg-gold hover:text-ink"
        >
          Join free
        </Link>
      </div>
    );
  }
  return <DesktopMenu name={name} links={links} />;
}

function DesktopMenu({ name, links }: { name: string; links: typeof accountLinks }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm font-semibold text-cream transition-colors hover:border-gold"
      >
        <Avatar name={name} />
        <span className="max-w-32 truncate">{name}</span>
        <span className="sr-only">: account menu</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-ink-2 py-2 shadow-2xl shadow-black/60"
      >
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-cream hover:bg-surface">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={signOut} className="mt-1 border-t border-line pt-1">
          <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-terracotta hover:bg-surface">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function MobileAccount({ name, links }: { name: string | null; links: typeof accountLinks }) {
  if (!name) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link href="/login" className="block rounded-full border border-line px-4 py-3 text-center font-semibold text-cream">
          Sign in
        </Link>
        <Link href="/signup" className="block rounded-full bg-gold px-4 py-3 text-center font-semibold text-ink">
          Join free
        </Link>
      </div>
    );
  }
  return (
    <div>
      <p className="flex items-center gap-3 px-3 pb-2 text-sm text-cream-muted">
        <Avatar name={name} />
        Signed in as <span className="truncate font-semibold text-cream">{name}</span>
      </p>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="block rounded-md px-3 py-3 text-base font-medium text-cream hover:bg-surface">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button type="submit" className="mt-1 block w-full rounded-md px-3 py-3 text-left text-base font-medium text-terracotta hover:bg-surface">
          Sign out
        </button>
      </form>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-gold-deep text-xs font-bold text-ink"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Same footprint as the visitor links, so the header doesn't jump while the session loads. */
export function AccountMenuPlaceholder({ variant }: { variant: "desktop" | "mobile" }) {
  return variant === "desktop" ? (
    <div aria-hidden="true" className="h-9 w-40 animate-pulse rounded-full bg-surface" />
  ) : (
    <div aria-hidden="true" className="h-12 animate-pulse rounded-full bg-surface" />
  );
}
