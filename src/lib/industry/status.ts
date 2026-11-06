/**
 * Who may move a record from one status to another. The database enforces
 * the same rules in its guard triggers and moderation functions; these copies
 * drive the UI and are tested against the same cases.
 */
import type { PromotionStatus, ReviewStatus, SubmissionStatus } from "./constants.ts";

/** Statuses in which the owner may still edit. */
export const OWNER_EDITABLE = new Set<string>(["draft", "changes_requested"]);

export function ownerCanEdit(status: string): boolean {
  return OWNER_EDITABLE.has(status);
}

/** What an applicant may do: save a draft or submit, and only while editable. */
export function ownerCanMoveApplication(from: ReviewStatus, to: ReviewStatus): boolean {
  return ownerCanEdit(from) && (to === "draft" || to === "pending_review");
}

export function ownerCanMoveSubmission(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return ownerCanEdit(from) && (to === "draft" || to === "pending_review");
}

const MODERATOR_SUBMISSION: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: [],
  pending_review: ["under_review", "approved", "rejected", "changes_requested"],
  under_review: ["approved", "rejected", "changes_requested"],
  changes_requested: [],
  approved: [],
  rejected: [],
};

/** Moderator decisions available for a submission in this status. */
export function moderatorSubmissionDecisions(status: SubmissionStatus): SubmissionStatus[] {
  return MODERATOR_SUBMISSION[status];
}

export function moderatorReviewDecisions(status: ReviewStatus): ReviewStatus[] {
  return status === "pending_review" ? ["approved", "rejected", "changes_requested"] : [];
}

export function moderatorPromotionDecisions(status: PromotionStatus): PromotionStatus[] {
  if (status === "pending") return ["approved", "rejected"];
  if (status === "approved") return ["expired"];
  return [];
}

/** A decision other than approval must explain itself to the person affected. */
export function decisionNeedsReason(decision: string): boolean {
  return decision === "rejected" || decision === "changes_requested";
}

/** An approved promotion counts as live only between its dates. */
export function promotionIsLive(status: PromotionStatus, startsOn: string, endsOn: string, today: string): boolean {
  return status === "approved" && startsOn <= today && today <= endsOn;
}

/** The status to show: approved placements past their end date read as expired. */
export function effectivePromotionStatus(status: PromotionStatus, endsOn: string, today: string): PromotionStatus {
  return status === "approved" && endsOn < today ? "expired" : status;
}
