import type { Plan } from "../../../types/domain";
import { fetchAPI, fetchAll, supabase } from "./_internal";
import { disambiguateScheduleForDb, stripZeroWidth } from "../scheduleUniq";

// ============================================================================
// Plan APIs
// ============================================================================

export async function createPlan(planData: {
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  totalChapters: number;
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("로그인이 필요합니다.");

  const { data: plansData, error } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true });

  if (error) throw error;

  // Avoid N+1: fetch all schedules in bulk.
  const customPlanIds = (plansData ?? [])
    .filter((p: any) => Boolean(p?.is_custom))
    .map((p: any) => p.id)
    .filter(Boolean);

  const presetIds = Array.from(
    new Set(
      (plansData ?? [])
        .filter((p: any) => !p?.is_custom && Boolean(p?.preset_id))
        .map((p: any) => p.preset_id)
    )
  );

  const customScheduleByPlanId = new Map<string, Array<{ day: number; book: string; chapters: string }>>();
  const presetScheduleByPresetId = new Map<string, Array<{ day: number; book: string; chapters: string }>>();

  if (customPlanIds.length > 0) {
    const customRows = await fetchAll<any>(
      async (from, to) =>
        await supabase
          .from("plan_schedules")
          .select("plan_id, day, book, chapters")
          .in("plan_id", customPlanIds)
          // Deterministic ordering for stable pagination
          .order("plan_id", { ascending: true })
          .order("day", { ascending: true })
          .order("order_index", { ascending: true })
          .order("book", { ascending: true })
          .order("chapters", { ascending: true })
          .range(from, to),
      1000
    );

    (customRows ?? []).forEach((r: any) => {
      const pid = String(r.plan_id);
      if (!customScheduleByPlanId.has(pid)) customScheduleByPlanId.set(pid, []);
      customScheduleByPlanId.get(pid)!.push({ day: r.day, book: r.book, chapters: r.chapters });
    });
  }

  if (presetIds.length > 0) {
    const presetRows = await fetchAll<any>(
      async (from, to) =>
        await supabase
          .from("preset_schedules")
          .select("preset_id, day, book, chapters")
          .in("preset_id", presetIds)
          // Deterministic ordering for stable pagination
          .order("preset_id", { ascending: true })
          .order("day", { ascending: true })
          .order("order_index", { ascending: true })
          .order("book", { ascending: true })
          .order("chapters", { ascending: true })
          .range(from, to),
      1000
    );

    (presetRows ?? []).forEach((r: any) => {
      const pid = String(r.preset_id);
      if (!presetScheduleByPresetId.has(pid)) presetScheduleByPresetId.set(pid, []);
      presetScheduleByPresetId.get(pid)!.push({ day: r.day, book: r.book, chapters: r.chapters });
    });
  }

  const buildSchedule = (rows: Array<{ day: number; book: string; chapters: string }>) => {
    const scheduleMap = new Map<number, Array<{ book: string; chapters: string }>>();
    (rows ?? []).forEach((s: any) => {
      const dayNum = Number(s.day);
      if (!Number.isFinite(dayNum)) return;
      if (!scheduleMap.has(dayNum)) scheduleMap.set(dayNum, []);
      scheduleMap.get(dayNum)!.push({ book: s.book, chapters: stripZeroWidth(s.chapters) });
    });
    return Array.from(scheduleMap.entries())
      .map(([day, readings]) => ({ day, readings }))
      .sort((a, b) => a.day - b.day);
  };

  const plans = (plansData ?? []).map((p: any) => {
    const rows = p.is_custom
      ? customScheduleByPlanId.get(String(p.id)) ?? []
      : presetScheduleByPresetId.get(String(p.preset_id)) ?? [];

    return {
      id: p.id,
      userId: p.user_id,
      presetId: p.preset_id,
      name: p.name,
      startDate: p.start_date,
      endDate: p.end_date,
      totalDays: p.total_days,
      totalChapters: p.total_chapters,
      isCustom: p.is_custom,
      displayOrder: p.display_order,
      createdAt: p.created_at,
      schedule: buildSchedule(rows),
    };
  });

  return { success: true, plans };
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
