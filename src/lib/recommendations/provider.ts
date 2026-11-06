/**
 * The recommendation provider in use. The current one is a transparent,
 * rule-based, content-based scorer: no trained model, no external AI service.
 * A future provider (embeddings, collaborative filtering or an LLM re-ranker)
 * can implement RecommendationProvider and be returned from here instead.
 */
import { buildGuestSections, buildPersonalSections } from "./sections.ts";
import type { RecommendationProvider, RecommendationRequest } from "./types.ts";

export const contentBasedProvider: RecommendationProvider = {
  id: "content-based-v1",
  description: "Rule-based scoring of genre, language, cast, director and watchlist overlap with the user's own activity.",
  async recommend(request: RecommendationRequest) {
    if (!request.activity) return buildGuestSections(request.catalogue, request.popular);
    return buildPersonalSections(request.activity, request.catalogue, request.popular, request.now).sections;
  },
};

export function getRecommendationProvider(): RecommendationProvider {
  return contentBasedProvider;
}
