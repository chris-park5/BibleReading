import type { Plan } from "../../../types/domain";

export function parseYYYYMMDDLocal(dateStr: string): Date {
  // Treat YYYY-MM-DD as local date (avoid UTC parsing issues)
  const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function computeTodayDay(plan: Plan, today: Date): number {
  const start = parseYYYYMMDDLocal(plan.startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}
