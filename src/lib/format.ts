// Small display helpers shared by components.
import type { Profession } from "@/types";

const professionLabels: Record<Profession, string> = {
  actor: "Actor",
  director: "Director",
  "actor-director": "Actor & Director",
};

export const professionLabel = (profession: Profession): string => professionLabels[profession];

/** 118 → "1h 58m" */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}m` : rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export const filmHref = (slug: string): string => `/films/${slug}`;
