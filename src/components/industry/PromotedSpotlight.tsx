import { cacheLife } from "next/cache";
import { PLACEMENT_LABELS, type Placement } from "@/lib/industry/constants";
import type { PublishedFilm } from "@/lib/industry/queries";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import SectionHeading from "../SectionHeading";
import { PublishedFilmCard } from "./DirectoryCards";

/** Approved, currently running editorial placements. Public data, so it may be cached and shared. */
async function getSpotlight(): Promise<{ film: PublishedFilm; placement: Placement }[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  try {
    const { data: promotions } = await supabase.rpc("get_active_promotions");
    if (!promotions?.length) return [];
    const { data: films } = await supabase.from("published_films").select("*").in("id", [...new Set(promotions.map((p) => p.film_id))]).eq("is_active", true);
    const byId = new Map((films ?? []).map((f) => [f.id, f]));
    const seen = new Set<string>();
    return promotions.flatMap((p) => {
      const film = byId.get(p.film_id);
      if (!film || seen.has(film.id)) return [];
      seen.add(film.id);
      return [{ film, placement: p.placement as Placement }];
    });
  } catch {
    return [];
  }
}

/** Homepage section for moderator-approved editorial placements. Hidden when there are none. */
export default async function PromotedSpotlight() {
  const items = await getSpotlight();
  if (!items.length) return null;
  return (
    <section aria-labelledby="spotlight-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        id="spotlight-title"
        eyebrow="Editorial spotlight"
        title="From the filmmakers"
        description="New films listed by their filmmakers, chosen by NaijaScreen editors. These are editorial picks, not paid placements."
      />
      <ul className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ film, placement }) => (
          <PublishedFilmCard key={film.id} film={film} label={PLACEMENT_LABELS[placement]} />
        ))}
      </ul>
    </section>
  );
}
