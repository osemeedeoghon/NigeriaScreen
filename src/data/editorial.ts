/**
 * FICTIONAL SAMPLE CONTENT.
 * Editorial headlines, excerpts and bylines are invented placeholders.
 */
import type { EditorialStory } from "@/types";

export const editorialStories: EditorialStory[] = [
  {
    id: "beyond-lagos",
    kicker: "Essay",
    title: "Beyond Lagos: the new wave of regional Nollywood",
    excerpt:
      "From Kano to Calabar, filmmakers are shooting in their own languages and their own cities, and audiences are following them home.",
    readMinutes: 8,
    author: "NaijaScreen Editors",
    isFictional: true,
  },
  {
    id: "where-to-start",
    kicker: "Starter guide",
    title: "New to Nollywood? Start with these five moods",
    excerpt: "A gentle route in, whether you want laughter, heartbreak or a proper chill down your spine.",
    readMinutes: 5,
    author: "Sample Contributor",
    isFictional: true,
  },
  {
    id: "sound-of-the-city",
    kicker: "Craft",
    title: "The sound of the city: scoring a Lagos thriller",
    excerpt: "How traffic, generators and church choirs become a film's soundtrack.",
    readMinutes: 6,
    author: "Sample Contributor",
    isFictional: true,
  },
];
