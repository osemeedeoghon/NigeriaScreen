import { getFeaturedFilms, getTrendingFilms } from "@/lib/catalogue";
import PosterArt from "./PosterArt";
import SearchBar from "./SearchBar";

// Centre poster is the top featured film; the side posters come from trending.
const [lead] = getFeaturedFilms();
const [left, right] = getTrendingFilms().filter((film) => film.id !== lead.id);
const heroPosters = [left, lead, right];

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden="true" className="texture-adire absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-terracotta/15 blur-3xl"
      />
      <div aria-hidden="true" className="absolute bottom-[-20%] left-[-10%] h-96 w-96 rounded-full bg-palm-deep/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:px-8 lg:pt-24 lg:pb-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-2/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-palm" />
            The home of Nollywood discovery
          </p>
          <h1
            id="hero-title"
            className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-cream sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Find the stories <span className="text-gold italic">Nigeria</span> is telling.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream-muted">
            Explore Nollywood by mood, genre and the people who make it, then see exactly where to watch each film
            legitimately.
          </p>
          <div className="mt-8">
            <SearchBar />
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto hidden h-[30rem] w-full max-w-md sm:block lg:h-[34rem]">
          <div className="absolute top-14 left-0 w-[44%] -rotate-6 opacity-80">
            <PosterArt art={heroPosters[0].artwork} title={heroPosters[0].title} className="shadow-2xl shadow-black/50" />
          </div>
          <div className="absolute top-20 right-0 w-[44%] rotate-6 opacity-80">
            <PosterArt art={heroPosters[2].artwork} title={heroPosters[2].title} className="shadow-2xl shadow-black/50" />
          </div>
          <div className="absolute top-0 left-1/2 w-[56%] -translate-x-1/2">
            <PosterArt
              art={heroPosters[1].artwork}
              title={heroPosters[1].title}
              year={heroPosters[1].releaseYear}
              size="lg"
              className="shadow-2xl shadow-black/60 ring-1 ring-gold/30"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
