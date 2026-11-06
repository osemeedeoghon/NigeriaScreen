import Link from "next/link";
import { getFilmsByPerson } from "@/lib/catalogue";
import { filmHref, professionLabel } from "@/lib/format";
import type { Person } from "@/types";

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

/** Profile card with a generated monogram portrait in place of a photograph. */
export default function PersonalityCard({ person }: { person: Person }) {
  const [from, to] = person.profileImage.palette;
  const knownFor = getFilmsByPerson(person.id).slice(0, 2);

  return (
    <article id={`person-${person.id}`} className="flex h-full flex-col rounded-2xl border border-line bg-ink-2 p-5">
      <div
        role="img"
        aria-label={`Monogram portrait placeholder for ${person.name}`}
        className="relative mb-5 flex aspect-square w-20 items-center justify-center overflow-hidden rounded-full sm:w-24"
        style={{ background: `conic-gradient(from 210deg, ${from}, ${to}, ${from})` }}
      >
        <span aria-hidden="true" className="absolute inset-1.5 rounded-full bg-ink/80" />
        <span aria-hidden="true" className="relative font-display text-2xl font-semibold text-cream sm:text-3xl">
          {initials(person.name)}
        </span>
      </div>
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{professionLabel(person.profession)}</p>
      <h3 className="mt-1 font-display text-xl font-semibold text-cream">{person.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-cream-muted">{person.biography}</p>
      {knownFor.length > 0 && (
        <p className="mt-4 border-t border-line pt-3 text-sm text-cream-muted">
          <span className="text-cream">Known for:</span>{" "}
          {knownFor.map((film, i) => (
            <span key={film.id}>
              {i > 0 && ", "}
              <Link href={filmHref(film.slug)} className="underline decoration-line underline-offset-4 hover:text-gold">
                {film.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
