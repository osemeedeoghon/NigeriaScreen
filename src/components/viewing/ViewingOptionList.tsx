"use client";

import { useId, useMemo, useState } from "react";
import { ACCESS_LABELS, coveredCountries, filterByCountry, summariseCountries } from "@/lib/viewing/availability";
import { countryName } from "@/lib/viewing/countries";
import { languageName } from "@/lib/viewing/languages";
import type { FilmViewingOption } from "@/types/viewing";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Confirmed viewing options with a country picker. Defaults to every country
 * rather than guessing where the viewer is.
 */
export default function ViewingOptionList({ options, filmTitle }: { options: FilmViewingOption[]; filmTitle: string }) {
  const [country, setCountry] = useState<string>("");
  const selectId = useId();
  const countries = useMemo(() => coveredCountries(options), [options]);
  const shown = filterByCountry(options, country || null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor={selectId} className="text-sm font-semibold text-cream">
          Your country
        </label>
        <select
          id={selectId}
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-cream"
        >
          <option value="">All listed countries</option>
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <p className="text-xs text-cream-muted" aria-live="polite">
          {country
            ? `${shown.length} confirmed ${shown.length === 1 ? "option" : "options"} in ${countryName(country)}`
            : `${options.length} confirmed ${options.length === 1 ? "option" : "options"}; availability varies by country`}
        </p>
      </div>

      {shown.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((option) => (
            <OptionCard key={option.id} option={option} filmTitle={filmTitle} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-cream-muted">
          We haven&rsquo;t confirmed an option for {countryName(country)} yet. It may still be available there.
        </p>
      )}
    </div>
  );
}

function OptionCard({ option, filmTitle }: { option: FilmViewingOption; filmTitle: string }) {
  const access = ACCESS_LABELS[option.accessType];
  const audio = option.audioLanguages.map((code) => languageName(code) ?? code);
  const subtitles = option.subtitleLanguages.map((code) => languageName(code) ?? code);

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-ink-2 p-5">
      <div className="flex items-start gap-3">
        {option.provider.logoUrl ? (
          // Logos are admin-supplied https URLs from arbitrary hosts, so next/image can't be configured for them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.provider.logoUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-lg bg-cream object-contain p-1"
          />
        ) : (
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface font-display text-lg font-semibold text-gold">
            {option.provider.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-cream">{option.provider.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-gold/50 px-2 py-0.5 font-semibold text-gold">{access.label}</span>
            {option.verifiedAt && (
              <span className="inline-flex items-center gap-1 text-palm">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Verified {dateFormat.format(new Date(option.verifiedAt))}
              </span>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-cream-muted">Countries:</dt>
          <dd className="text-cream" title={option.countries.map(countryName).join(", ")}>
            {summariseCountries(option.countries)}
          </dd>
        </div>
        {audio.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-cream-muted">Audio:</dt>
            <dd className="text-cream">{audio.join(", ")}</dd>
          </div>
        )}
        {subtitles.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-cream-muted">Subtitles:</dt>
            <dd className="text-cream">{subtitles.join(", ")}</dd>
          </div>
        )}
      </dl>
      {option.availabilityNotes && <p className="mt-3 text-xs text-cream-muted">{option.availabilityNotes}</p>}

      <div className="mt-auto pt-5">
        <a
          href={option.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream"
        >
          {access.action}
          <span className="sr-only">
            {" "}
            {filmTitle} on {option.provider.name} (opens in a new tab)
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </li>
  );
}
