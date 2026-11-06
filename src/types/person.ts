import type { ProfileArtwork } from "./artwork";

export type Profession = "actor" | "director" | "actor-director";

export interface Person {
  /** Stable identifier, e.g. "person-ifeoma-adebanjo-eze". */
  id: string;
  name: string;
  biography: string;
  profession: Profession;
  profileImage: ProfileArtwork;
  nationality: string;
  /** Marks every record as invented sample content. */
  isFictional: true;
}
