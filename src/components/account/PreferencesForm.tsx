"use client";

import { useActionState } from "react";
import { IDLE } from "@/lib/auth/formState";
import { updateDiscoveryPreferences } from "@/lib/recommendations/actions";
import { FormMessage, SubmitButton } from "../forms/FormControls";

interface PreferencesFormProps {
  languages: { code: string; name: string }[];
  genres: { slug: string; name: string }[];
  selectedLanguages: string[];
  selectedGenres: string[];
  includeWatched: boolean;
}

const chip =
  "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors has-checked:border-gold has-checked:bg-gold has-checked:text-ink border-line text-cream-muted hover:text-cream has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold";

export default function PreferencesForm({ languages, genres, selectedLanguages, selectedGenres, includeWatched }: PreferencesFormProps) {
  const [state, action] = useActionState(updateDiscoveryPreferences, IDLE);
  return (
    <form action={action} className="space-y-8">
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-1 font-semibold text-cream">Preferred languages</legend>
        <p className="mb-3 text-sm text-cream-muted">Films in these languages get a boost.</p>
        <div className="flex flex-wrap gap-2">
          {languages.map((language) => (
            <label key={language.code} className={chip}>
              <input type="checkbox" name="languages" value={language.code} defaultChecked={selectedLanguages.includes(language.code)} className="sr-only" />
              {language.name}
            </label>
          ))}
        </div>
        {state.fieldErrors?.languages && <p className="mt-2 text-sm text-terracotta">{state.fieldErrors.languages}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-semibold text-cream">Favourite genres</legend>
        <p className="mb-3 text-sm text-cream-muted">Used alongside what you watch and rate.</p>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <label key={genre.slug} className={chip}>
              <input type="checkbox" name="genres" value={genre.slug} defaultChecked={selectedGenres.includes(genre.slug)} className="sr-only" />
              {genre.name}
            </label>
          ))}
        </div>
        {state.fieldErrors?.genres && <p className="mt-2 text-sm text-terracotta">{state.fieldErrors.genres}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold text-cream">Watched films</legend>
        <label className="flex items-start gap-3 text-sm text-cream">
          <input type="checkbox" name="includeWatched" defaultChecked={includeWatched} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
          <span>
            Include films I&rsquo;ve already watched in recommendations
            <span className="block text-cream-muted">Films you rated 2 stars or lower are never recommended.</span>
          </span>
        </label>
      </fieldset>

      <p className="text-xs text-cream-muted">
        Themes and moods aren&rsquo;t part of the catalogue yet, so they can&rsquo;t be chosen here. We don&rsquo;t ask for
        anything else about you.
      </p>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
      </div>
    </form>
  );
}
