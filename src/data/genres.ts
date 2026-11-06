/**
 * Genre taxonomy. Genre names are generic; descriptions are original copy.
 */
import type { Genre } from "@/types";

export const genres: Genre[] = [
  {
    id: "genre-drama",
    name: "Drama",
    slug: "drama",
    description: "Family, faith and the weight of choices.",
    artwork: { kind: "accent", accent: "#C2562F" },
  },
  {
    id: "genre-romance",
    name: "Romance",
    slug: "romance",
    description: "Love stories from Calabar to Kaduna.",
    artwork: { kind: "accent", accent: "#D9714A" },
  },
  {
    id: "genre-comedy",
    name: "Comedy",
    slug: "comedy",
    description: "Owambe energy and Lagos wit.",
    artwork: { kind: "accent", accent: "#E8B95A" },
  },
  {
    id: "genre-thriller",
    name: "Thriller",
    slug: "thriller",
    description: "Tension on the bridge and in the boardroom.",
    artwork: { kind: "accent", accent: "#6FAF8A" },
  },
  {
    id: "genre-action",
    name: "Action",
    slug: "action",
    description: "Chases, heists and hard-won showdowns.",
    artwork: { kind: "accent", accent: "#E07B5A" },
  },
  {
    id: "genre-family",
    name: "Family",
    slug: "family",
    description: "Stories for every generation at the table.",
    artwork: { kind: "accent", accent: "#F0C987" },
  },
  {
    id: "genre-historical",
    name: "Historical",
    slug: "historical",
    description: "Kingdoms, courts and the eras that shaped the nation.",
    artwork: { kind: "accent", accent: "#D9A441" },
  },
  {
    id: "genre-crime",
    name: "Crime",
    slug: "crime",
    description: "Hustlers, detectives and grey areas.",
    artwork: { kind: "accent", accent: "#9FD0B8" },
  },
];
