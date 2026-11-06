import EditorialSection from "@/components/EditorialSection";
import FeaturedFilm from "@/components/FeaturedFilm";
import FilmSection from "@/components/FilmSection";
import GenreSection from "@/components/GenreSection";
import HeroSection from "@/components/HeroSection";
import HomeRecommendations, { HomeRecommendationsSkeleton } from "@/components/recommendations/HomeRecommendations";
import PromotedSpotlight from "@/components/industry/PromotedSpotlight";
import PersonalitySection from "@/components/PersonalitySection";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getFeaturedFilms, getTrendingFilms } from "@/lib/catalogue";

// Only the homepage declares itself canonical at "/"; other pages set their own.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  const [spotlight] = getFeaturedFilms();

  return (
    <main id="main">
      <HeroSection />
      <Suspense fallback={<HomeRecommendationsSkeleton />}>
        <HomeRecommendations />
      </Suspense>
      <Suspense fallback={null}>
        <PromotedSpotlight />
      </Suspense>
      <FeaturedFilm film={spotlight} />
      <GenreSection />
      <FilmSection
        id="trending"
        eyebrow="Trending"
        title="What Nigeria is watching"
        description="This week's most-discovered films, curated from the sample catalogue."
        films={getTrendingFilms()}
        showRank
      />
      <PersonalitySection />
      <EditorialSection />
    </main>
  );
}
