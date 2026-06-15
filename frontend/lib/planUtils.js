// Plan is sourced from user.plan returned by /auth/session (DB source of truth).
// Quota (uploads_today) is also sourced from /auth/session — no localStorage.

export const PLAN_LIMITS = {
  free: 2,
  pro: 10,
};

export function getDailyLimit(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function usePlan(user) {
  return user?.plan === "pro" ? "pro" : "free";
}

export function useQuota(user) {
  return user?.uploads_today ?? 0;
}