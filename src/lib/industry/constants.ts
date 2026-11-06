/** Values shared by the industry portal, matching the Stage 7 check constraints. */

export const PROFESSIONAL_ROLES = [
  "actor",
  "director",
  "producer",
  "screenwriter",
  "cinematographer",
  "editor",
  "production_designer",
  "composer",
  "other",
] as const;
export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number];

export const ROLE_LABELS: Record<ProfessionalRole, string> = {
  actor: "Actor",
  director: "Director",
  producer: "Producer",
  screenwriter: "Screenwriter",
  cinematographer: "Cinematographer",
  editor: "Editor",
  production_designer: "Production designer",
  composer: "Composer",
  other: "Other film professional",
};

export const ACCOUNT_TYPES = ["filmmaker", "company"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const REVIEW_STATUSES = ["draft", "pending_review", "approved", "rejected", "changes_requested"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SUBMISSION_STATUSES = ["draft", "pending_review", "under_review", "changes_requested", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type ProfileVerification = (typeof VERIFICATION_STATUSES)[number];

export const PLACEMENTS = ["featured_film", "homepage_editorial", "new_release_spotlight", "genre_spotlight", "upcoming_release"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
  featured_film: "Featured film",
  homepage_editorial: "Homepage editorial feature",
  new_release_spotlight: "New release spotlight",
  genre_spotlight: "Genre spotlight",
  upcoming_release: "Upcoming release feature",
};

export const PROMOTION_STATUSES = ["pending", "approved", "rejected", "expired", "cancelled"] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  expired: "Expired",
  cancelled: "Cancelled",
  unverified: "Not verified",
  verified: "Verified",
};

/** Longest promotion a request may cover (also a database constraint). */
export const MAX_PROMOTION_DAYS = 90;
