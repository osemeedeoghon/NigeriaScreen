"use client";

import Link from "next/link";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loginHref, signupHref } from "@/lib/auth/paths";
import { setLibraryEntry, type LibraryList } from "@/lib/library/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface LibrarySnapshotProps {
  userId: string;
  watchlist: string[];
  watched: string[];
}

interface Notice {
  message: string;
  /** Show sign-in and sign-up links with the message. */
  auth?: boolean;
}

interface LibraryValue {
  /** False until the server has said who is signed in. */
  ready: boolean;
  signedIn: boolean;
  has: (list: LibraryList, filmId: string) => boolean;
  pending: (list: LibraryList, filmId: string) => boolean;
  toggle: (list: LibraryList, filmId: string, filmTitle: string) => void;
  /** Replaces local state with what the server rendered. */
  sync: (snapshot: LibrarySnapshotProps | null) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

const LIST_LABELS: Record<LibraryList, { added: string; removed: string; prompt: string }> = {
  watchlist: { added: "added to your watchlist", removed: "removed from your watchlist", prompt: "save films to your watchlist" },
  watched_films: { added: "marked as watched", removed: "no longer marked as watched", prompt: "keep track of films you've watched" },
};

const keyOf = (list: LibraryList, filmId: string) => `${list}:${filmId}`;

/**
 * Holds the signed-in user's watchlist and watched ids for every film card on
 * the page. Changes are optimistic and go through Server Actions, which check
 * the session again; the database's RLS policies are the real boundary.
 */
export default function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Set<string>>(() => new Set());
  const [inFlight, setInFlight] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const configured = isSupabaseConfigured();

  const sync = useCallback((snapshot: LibrarySnapshotProps | null) => {
    setReady(true);
    setUserId(snapshot?.userId ?? null);
    setEntries(
      new Set([
        ...(snapshot?.watchlist ?? []).map((id) => keyOf("watchlist", id)),
        ...(snapshot?.watched ?? []).map((id) => keyOf("watched_films", id)),
      ]),
    );
  }, []);

  const flip = (key: string, on: boolean) =>
    setEntries((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggle = useCallback(
    async (list: LibraryList, filmId: string, filmTitle: string) => {
      const labels = LIST_LABELS[list];
      if (!configured) {
        setNotice({ message: "Accounts aren't switched on for this copy of NaijaScreen yet." });
        return;
      }
      if (!userId) {
        setNotice({ message: `Sign in or create a free account to ${labels.prompt}.`, auth: true });
        return;
      }
      const key = keyOf(list, filmId);
      if (inFlight.has(key)) return;
      const adding = !entries.has(key);

      flip(key, adding);
      setInFlight((current) => new Set(current).add(key));
      try {
        const result = await setLibraryEntry(list, filmId, adding);
        if (result.ok) {
          setNotice({ message: `${filmTitle} ${adding ? labels.added : labels.removed}.` });
        } else {
          flip(key, !adding);
          setNotice(
            result.reason === "signed-out"
              ? { message: `Your session has ended. Sign in again to ${labels.prompt}.`, auth: true }
              : { message: "That didn't save. Check your connection and try again." },
          );
        }
      } catch {
        flip(key, !adding);
        setNotice({ message: "That didn't save. Check your connection and try again." });
      } finally {
        setInFlight((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [configured, userId, entries, inFlight],
  );

  const value = useMemo<LibraryValue>(
    () => ({
      ready: ready || !configured,
      signedIn: userId !== null,
      has: (list, filmId) => entries.has(keyOf(list, filmId)),
      pending: (list, filmId) => inFlight.has(keyOf(list, filmId)),
      toggle,
      sync,
    }),
    [ready, configured, userId, entries, inFlight, toggle, sync],
  );

  const dismiss = useCallback(() => setNotice(null), []);

  return (
    <LibraryContext value={value}>
      {children}
      <LibraryNotice notice={notice} onDismiss={dismiss} />
    </LibraryContext>
  );
}

export function useLibrary(): LibraryValue {
  const value = use(LibraryContext);
  if (!value) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return value;
}

/** Rendered by the server inside a Suspense boundary to hand over the user's saved films. */
export function LibrarySync({ snapshot }: { snapshot: LibrarySnapshotProps | null }) {
  const { sync } = useLibrary();
  useEffect(() => sync(snapshot), [snapshot, sync]);
  return null;
}

/** Toast-style confirmation or sign-in prompt, announced to screen readers. */
function LibraryNotice({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notice) return;
    // Sign-in prompts stay until dismissed; confirmations fade after a few seconds.
    if (!notice.auth) timer.current = setTimeout(onDismiss, 4000);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [notice, onDismiss]);

  const here = typeof window === "undefined" ? undefined : window.location.pathname + window.location.search;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      {notice && (
        <div
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-2xl shadow-black/60"
        >
          <div className="flex-1 text-sm text-cream">
            <p>{notice.message}</p>
            {notice.auth && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={loginHref(here)}
                  onClick={onDismiss}
                  className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-cream"
                >
                  Sign in
                </Link>
                <Link
                  href={signupHref(here)}
                  onClick={onDismiss}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-cream transition-colors hover:border-gold"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 text-cream-muted hover:text-cream"
            aria-label="Dismiss message"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
