import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isIndustryRole, isAdminRole } from "../auth/roles.ts";
import {
  decisionNeedsReason,
  effectivePromotionStatus,
  moderatorPromotionDecisions,
  moderatorReviewDecisions,
  moderatorSubmissionDecisions,
  ownerCanEdit,
  ownerCanMoveApplication,
  ownerCanMoveSubmission,
  promotionIsLive,
} from "./status.ts";

describe("owner status changes", () => {
  test("owners edit and submit only drafts and returned records", () => {
    assert.ok(ownerCanMoveSubmission("draft", "pending_review"));
    assert.ok(ownerCanMoveSubmission("changes_requested", "pending_review"));
    assert.ok(ownerCanMoveSubmission("draft", "draft"));
    for (const from of ["pending_review", "under_review", "approved", "rejected"] as const) {
      assert.equal(ownerCanEdit(from), false, from);
      assert.equal(ownerCanMoveSubmission(from, "pending_review"), false, from);
    }
  });

  test("owners can never approve, reject or put under review", () => {
    for (const to of ["approved", "rejected", "under_review", "changes_requested"] as const) {
      assert.equal(ownerCanMoveSubmission("draft", to), false, to);
    }
    assert.equal(ownerCanMoveApplication("draft", "approved"), false);
    assert.equal(ownerCanMoveApplication("changes_requested", "pending_review"), true);
  });
});

describe("moderator decisions", () => {
  test("submissions move pending → under review → decision", () => {
    assert.deepEqual(moderatorSubmissionDecisions("pending_review"), ["under_review", "approved", "rejected", "changes_requested"]);
    assert.deepEqual(moderatorSubmissionDecisions("under_review"), ["approved", "rejected", "changes_requested"]);
    for (const s of ["draft", "changes_requested", "approved", "rejected"] as const) assert.deepEqual(moderatorSubmissionDecisions(s), [], s);
  });

  test("applications and companies are decided only while pending", () => {
    assert.deepEqual(moderatorReviewDecisions("pending_review"), ["approved", "rejected", "changes_requested"]);
    assert.deepEqual(moderatorReviewDecisions("approved"), []);
    assert.deepEqual(moderatorReviewDecisions("draft"), []);
  });

  test("promotions: pending can be decided, approved can be ended", () => {
    assert.deepEqual(moderatorPromotionDecisions("pending"), ["approved", "rejected"]);
    assert.deepEqual(moderatorPromotionDecisions("approved"), ["expired"]);
    assert.deepEqual(moderatorPromotionDecisions("cancelled"), []);
  });

  test("rejections and change requests need a reason", () => {
    assert.ok(decisionNeedsReason("rejected"));
    assert.ok(decisionNeedsReason("changes_requested"));
    assert.equal(decisionNeedsReason("approved"), false);
  });
});

describe("promotion dates", () => {
  test("an approved placement is live only between its dates and reads as expired after", () => {
    assert.ok(promotionIsLive("approved", "2026-11-01", "2026-11-30", "2026-11-05"));
    assert.equal(promotionIsLive("approved", "2026-11-10", "2026-11-30", "2026-11-05"), false);
    assert.equal(promotionIsLive("pending", "2026-11-01", "2026-11-30", "2026-11-05"), false);
    assert.equal(effectivePromotionStatus("approved", "2026-11-01", "2026-11-05"), "expired");
    assert.equal(effectivePromotionStatus("pending", "2026-11-01", "2026-11-05"), "pending");
  });
});

describe("roles", () => {
  test("filmmaker, company and admin roles open the portal; viewers don't", () => {
    for (const role of ["filmmaker", "company", "admin"]) assert.ok(isIndustryRole(role), role);
    for (const role of ["viewer", "Filmmaker", "", null, undefined]) assert.equal(isIndustryRole(role), false, String(role));
    assert.equal(isAdminRole("filmmaker"), false);
  });
});
