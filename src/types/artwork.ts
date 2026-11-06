// Artwork references. Stage 2 uses original, code-generated treatments only.
// A later stage can add an `{ kind: "image"; src; alt }` variant for licensed
// artwork stored in Supabase Storage.

export type PosterMotif = "sun" | "arch" | "stripes" | "rings" | "horizon" | "diamond";

/** Original CSS/SVG poster treatment rendered by `PosterArt`. */
export interface PosterArtwork {
  kind: "generated-poster";
  motif: PosterMotif;
  /** Background, mid-tone and accent colours, in that order. */
  palette: [string, string, string];
  /** Short visual description used in the poster's alt text. */
  description: string;
}

/** Accent swatch used on genre cards. */
export interface GenreArtwork {
  kind: "accent";
  accent: string;
}

/** Generated monogram portrait used instead of a photograph. */
export interface ProfileArtwork {
  kind: "monogram";
  /** Two colours for the portrait ring. */
  palette: [string, string];
}
