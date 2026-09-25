import { SubscriptionPlanTier } from '../subscriptions/entities/subscription-plan.entity';

export interface ApiPlanLimit {
  label: string;
  /** Requests per clinic per day (Asia/Jakarta calendar day). */
  perDay: number;
  /** Requests per key per minute. */
  perMinute: number;
}

/** API limits per subscription tier. Trial clinics get the Starter limits. */
export const API_PLAN_LIMITS: Record<SubscriptionPlanTier, ApiPlanLimit> = {
  [SubscriptionPlanTier.TRIAL]: { label: 'Starter', perDay: 1_000, perMinute: 60 },
  [SubscriptionPlanTier.BASIC]: { label: 'Starter', perDay: 1_000, perMinute: 60 },
  [SubscriptionPlanTier.PRO]: { label: 'Pro', perDay: 10_000, perMinute: 300 },
  [SubscriptionPlanTier.MULTI_KLINIK]: { label: 'Multi Klinik', perDay: 1_000_000, perMinute: 2_000 },
};

/** Plans created before tiers existed have no tier: treat them as Starter. */
export function limitsForTier(tier: SubscriptionPlanTier | null | undefined): ApiPlanLimit {
  return API_PLAN_LIMITS[tier ?? SubscriptionPlanTier.BASIC] ?? API_PLAN_LIMITS[SubscriptionPlanTier.BASIC];
}

/** Keys a clinic may have active at once. */
export const MAX_ACTIVE_KEYS_PER_CLINIC = 10;
