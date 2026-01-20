import type { Progress } from "../../../types/domain";
import { fetchAPI, fetchAll, supabase } from "./_internal";

// ============================================================================
// Progress APIs
// ============================================================================

export async function updateReadingProgress(
  planId: string,
  day: number,
  readingIndex: number,
  completed: boolean,
  readingCount: number,
  completedChapters?: string[]
): Promise<{ success: boolean; progress: Progress }> {
  if (!planId) throw new Error("Plan ID is required");
  if (!Number.isFinite(day)) throw new Error("day is required");
  if (!Number.isFinite(readingIndex)) throw new Error("readingIndex is required");

  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, readingIndex, completed, readingCount, completedChapters }),
  });
}

export async function updateProgress(
  planId: string,
  day: number,
  completed: boolean
): Promise<{ success: boolean; progress: Progress }> {
  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, completed }),
  });
}

export async function getProgress(planId: string): Promise<{ success: boolean; progress: Progress }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("로그인이 필요합니다.");

  // 1. Fetch user progress
  const { data, error } = await supabase
    .from("reading_progress")
    .select("day, reading_index, completed_chapters")
    .eq("user_id", user.id)
    .eq("plan_id", planId);

  if (error) throw error;

  // 2. Group completed readings by day
  const completedReadingsByDay: Record<string, number[]> = {};
  const completedChaptersByDay: Record<string, Record<number, string[]>> = {};
  const completedSetsByDay = new Map<number, Set<number>>();

  (data ?? []).forEach((item: any) => {
    const dayNum = Number(item.day);
    const idx = Number(item.reading_index);
    if (!Number.isFinite(dayNum) || !Number.isFinite(idx)) return;

    const dayStr = String(dayNum);
    const chapters = item.completed_chapters as string[] | null;

    if (chapters === null) {
      if (!completedReadingsByDay[dayStr]) {
        completedReadingsByDay[dayStr] = [];
      }
      completedReadingsByDay[dayStr].push(idx);

      if (!completedSetsByDay.has(dayNum)) {
        completedSetsByDay.set(dayNum, new Set());
      }
      completedSetsByDay.get(dayNum)!.add(idx);
    } else {
      if (!completedChaptersByDay[dayStr]) {
        completedChaptersByDay[dayStr] = {};
      }
      completedChaptersByDay[dayStr][idx] = chapters;
    }
  });

  // 3. Fetch Plan info (to know schedule)
  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .select("id, is_custom, preset_id")
    .eq("id", planId)
    .maybeSingle();

  if (planError) throw planError;
  
  const completedDays: number[] = [];
  
  if (planRow) {
    const scheduleCountByDay = new Map<number, number>();

    if (planRow.is_custom) {
      const scheduleRows = await fetchAll<any>(
        async (from, to) =>
          await supabase
            .from("plan_schedules")
            .select("day")
            .eq("plan_id", planRow.id)
            .order("day", { ascending: true })
            .range(from, to),
        1000
      );

      (scheduleRows ?? []).forEach((r: any) => {
        const dayNum = Number(r.day);
        if (!Number.isFinite(dayNum)) return;
        scheduleCountByDay.set(dayNum, (scheduleCountByDay.get(dayNum) ?? 0) + 1);
      });
    } else if (planRow.preset_id) {
      const scheduleRows = await fetchAll<any>(
        async (from, to) =>
          await supabase
            .from("preset_schedules")
            .select("day")
            .eq("preset_id", planRow.preset_id)
            .order("day", { ascending: true })
            .range(from, to),
        1000
      );

      (scheduleRows ?? []).forEach((r: any) => {
        const dayNum = Number(r.day);
        if (!Number.isFinite(dayNum)) return;
        scheduleCountByDay.set(dayNum, (scheduleCountByDay.get(dayNum) ?? 0) + 1);
      });
    }

    // 4. Calculate completed days
    for (const [dayNum, completedSet] of completedSetsByDay.entries()) {
      const requiredCount = scheduleCountByDay.get(dayNum) ?? 0;
      if (requiredCount > 0 && completedSet.size >= requiredCount) {
        completedDays.push(dayNum);
      }
    }
  }

  return {
    success: true,
    progress: {
      userId: user.id,
      planId,
      completedDays: completedDays.sort((a, b) => a - b),
      completedReadingsByDay,
      completedChaptersByDay,
      lastUpdated: new Date().toISOString(),
    },
  };
}
