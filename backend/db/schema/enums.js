import { pgEnum } from 'drizzle-orm/pg-core';

// ─── User identity ────────────────────────────────────────────────────────────
export const iamEnum = pgEnum('iam_type', [
  'woman', 'man', 'nonbinary', 'other',
]);

export const twoFaMethodEnum = pgEnum('two_fa_method', [
  'sms', 'skipped',
]);

// ─── Relationship ─────────────────────────────────────────────────────────────
export const relationshipGoalEnum = pgEnum('relationship_goal', [
  'casual',           // Casual fun
  'dating',           // Dating, see what happens
  'serious',          // Long-term partner
  'non_monogamy',     // Ethical non-monogamy
  'friends',          // New friends first
  'figuring_out',     // Still figuring it out
]);

export const relStatusEnum = pgEnum('rel_status', [
  'single',
  'in_relationship',
  'married',
  'non_monogamous',   // Ethically non-monogamous
  'complicated',
  'prefer_not_say',
]);

// ─── Discovery ────────────────────────────────────────────────────────────────
export const discoverRelTypeEnum = pgEnum('discover_rel_type', [
  'serious', 'dating', 'casual', 'non_monogamy', 'friends', 'figuring_out', 'open',
]);

// ─── Matching / Liking ────────────────────────────────────────────────────────
export const likeTypeEnum = pgEnum('like_type', [
  'like', 'super_like', 'pass',
]);

// ─── Messaging ────────────────────────────────────────────────────────────────
export const callTypeEnum = pgEnum('call_type', ['voice', 'video']);

export const callStatusEnum = pgEnum('call_status', [
  'initiated', 'answered', 'declined', 'ended', 'missed',
]);

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const planEnum = pgEnum('plan_type', [
  'free', 'plus', 'platin', 'private',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active', 'expired', 'cancelled', 'pending', 'grace_period',
]);

export const platformEnum = pgEnum('platform_type', [
  'ios', 'android', 'web',
]);

export const purchaseTypeEnum = pgEnum('purchase_type', [
  'super_likes', 'boosts',
]);

// ─── Safety ──────────────────────────────────────────────────────────────────
export const reportReasonEnum = pgEnum('report_reason', [
  'fake',           // Fake profile or impersonation
  'inappropriate',  // Inappropriate photos or content
  'harassment',     // Harassment or hateful behavior
  'minor',          // Underage user
  'spam',           // Spam, ads, or off-platform
  'safety',         // Safety concern (in-person)
  'other',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'pending', 'reviewed', 'actioned', 'dismissed',
]);

// ─── App disguise ─────────────────────────────────────────────────────────────
export const disguiseEnum = pgEnum('disguise_type', [
  'ohrny', 'calc', 'files', 'voice', 'compass', 'weather',
]);

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminRoleEnum = pgEnum('admin_role', [
  'super_admin', 'moderator', 'support',
]);
