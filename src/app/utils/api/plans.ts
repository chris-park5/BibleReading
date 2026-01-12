import type { Plan } from "../../../types/domain";
import { fetchAPI } from "./_internal";
import { disambiguateScheduleForDb } from "../scheduleUniq";

// ============================================================================
// Plan APIs
// ============================================================================

export async function createPlan(planData: {
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>;
  isCustom: boolean;
  presetId?: string;
}): Promise<{ success: boolean; plan: Plan }> {
  const fixed = Array.isArray(planData.schedule)
    ? disambiguateScheduleForDb(planData.schedule)
    : { schedule: planData.schedule as any, duplicatesFixed: 0 };

  return fetchAPI(
    "/plans",
    {
      method: "POST",
      body: JSON.stringify({ ...planData, schedule: fixed.schedule }),
    },
    true,
    60_000
  );
}

export async function getPlans(): Promise<{ success: boolean; plans: Plan[] }> {
  return fetchAPI("/plans", {}, true, 60_000);
}

export async function seedPresetSchedules(
  presetId: string,
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>
): Promise<{ success: boolean; seeded: boolean }> {
  return fetchAPI("/preset-schedules/seed", {
    method: "POST",
    body: JSON.stringify({ presetId, schedule }),
  });
}

export async function deletePlan(planId: string): Promise<{ success: boolean }> {
  if (!planId) throw new Error("Plan ID is required");

  return fetchAPI(`/plans/${planId}`, { method: "DELETE" }, true, 60_000);
}

export async function updatePlanOrder(planId: string, newOrder: number): Promise<{ success: boolean }> {
  if (!planId) throw new Error("Plan ID is required");

  return fetchAPI("/plans/order", {
    method: "PATCH",
    body: JSON.stringify({ planId, newOrder }),
  });
}
