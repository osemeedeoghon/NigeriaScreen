/**
 * Trailer URLs from approved video platforms only. A pasted URL is reduced to
 * a provider and a video id, and the embed URL is rebuilt from those, so no
 * user-supplied URL ever becomes an iframe src.
 */
import type { TrailerProvider } from "../../types/viewing.ts";

export interface ParsedTrailer {
  provider: TrailerProvider;
  videoId: string;
  /** Normalised public watch URL, used for the "watch on…" link. */
  canonicalUrl: string;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;

/** Hosts an iframe may point at. Anything else is never embedded. */
export const EMBED_HOSTS = new Set(["www.youtube-nocookie.com", "player.vimeo.com"]);

export function parseTrailerUrl(value: string): ParsedTrailer | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return { provider: "youtube", videoId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = host === "player.vimeo.com" ? (parts[0] === "video" ? parts[1] : null) : parts[0];
    if (!id || !VIMEO_ID.test(id)) return null;
    return { provider: "vimeo", videoId: id, canonicalUrl: `https://vimeo.com/${id}` };
  }

  return null;
}

/** Privacy-enhanced embed URL built only from a validated provider and id. */
export function trailerEmbedUrl(provider: TrailerProvider, videoId: string): string | null {
  if (provider === "youtube" && YOUTUBE_ID.test(videoId)) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
  }
  if (provider === "vimeo" && VIMEO_ID.test(videoId)) {
    return `https://player.vimeo.com/video/${videoId}?dnt=1&title=0&byline=0`;
  }
  return null;
}

/** Final guard: an iframe src must be https on an approved embed host. */
export function isApprovedEmbedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && EMBED_HOSTS.has(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const TRAILER_PROVIDER_NAMES: Record<TrailerProvider, string> = { youtube: "YouTube", vimeo: "Vimeo" };
