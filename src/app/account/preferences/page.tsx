import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSkeleton from "@/components/account/AccountSkeleton";
import HiddenFilms from "@/components/account/HiddenFilms";
import PreferencesForm from "@/components/account/PreferencesForm";
import SetupNotice from "@/components/auth/SetupNotice";
import { requireUser } from "@/lib/auth/session";
import { getAllGenres } from "@/lib/catalogue";
import { LANGUAGE_CODES } from "@/lib/catalogueLanguages";
import { getOwnProfile } from "@/lib/library/queries";
import { getOwnFeedback, preferencesFrom } from "@/lib/recommendations/queries";
import { TUNING } from "@/lib/recommendations/weights";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Discovery preferences — NaijaScreen" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function PreferencesPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense fallback={<AccountSkeleton label="Loading your preferences…" />}>
      <Preferences />
    </Suspense>
  );
}

async function Preferences() {
  const { user } = await requireUser("/account/preferences");
  const [profile, feedback] = await Promise.all([getOwnProfile(user.id), getOwnFeedback()]);
  const preferences = preferencesFrom(profile);
  const hidden = (feedback ?? []).map(({ film, kind, hiddenUntil }) => ({
    filmId: film.id,
    slug: film.slug,
    title: film.title,
    kind,
    until: hiddenUntil ? dateFormat.format(hiddenUntil) : null,
  }));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
      <section aria-labelledby="prefs-heading">
        <h1 id="prefs-heading" className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          Discovery preferences
        </h1>
        <p className="mt-2 max-w-2xl text-cream-muted">
          These shape the recommendations on your homepage, together with the films you save, watch and rate. Only you can see
          them.
        </p>
        <div className="mt-8">
          <PreferencesForm
            languages={Object.entries(LANGUAGE_CODES).map(([name, code]) => ({ code, name }))}
            genres={getAllGenres().map(({ slug, name }) => ({ slug, name }))}
            selectedLanguages={preferences.languages}
            selectedGenres={preferences.genres}
            includeWatched={preferences.includeWatched}
          />
        </div>
      </section>
      <aside aria-labelledby="hidden-heading" className="h-fit rounded-2xl border border-line bg-ink-2 p-6">
        <h2 id="hidden-heading" className="font-display text-xl font-semibold text-cream">
          Hidden recommendations
        </h2>
        <p className="mt-2 mb-4 text-sm text-cream-muted">
          &ldquo;Hide&rdquo; lasts {TUNING.dismissDays} days. &ldquo;Not interested&rdquo; lasts until you undo it.
        </p>
        {feedback === null ? <p className="text-sm text-terracotta">Couldn&rsquo;t load these. Refresh to try again.</p> : <HiddenFilms films={hidden} />}
      </aside>
    </div>
  );
}
