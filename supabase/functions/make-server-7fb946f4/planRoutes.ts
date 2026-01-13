/**
 * Plan Routes
 */

import { Context } from "npm:hono";
import { getSupabaseClient, handleError } from "./utils.ts";
import type { CreatePlanRequest, UpdatePlanOrderRequest } from "./types.ts";

const supabase = getSupabaseClient();

const MAX_PLAN_TOTAL_DAYS = 3650; // ~10 years
const MAX_SCHEDULE_ROWS = 20000; // total (day x readings) rows

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

function stripZeroWidth(s: unknown) {
  return String(s ?? "").replace(ZERO_WIDTH_RE, "");
}

function disambiguateDuplicateScheduleRows<T extends { day: number; book: string; chapters: string }>(
  rows: T[]
): T[] {
  // DB has a unique index on (plan_id/preset_id, day, book, chapters).
  // Some legitimate cases (e.g., 동일 책/범위가 같은 날에 2회 등장) can violate it.
  // We keep UI text identical by adding invisible suffix characters only when duplicates occur.
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const baseChapters = stripZeroWidth(r.chapters);
    const key = `${r.day}|${r.book}|${baseChapters}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 1) return { ...r, chapters: baseChapters };
    // Append n-1 zero-width spaces.
    return { ...r, chapters: `${baseChapters}${"\u200B".repeat(n - 1)}` };
  });
}

/**
 * Supabase/PostgREST has a default max rows limit (commonly 1000).
 * Large preset plans can exceed this (e.g., 365 days × multiple readings).
 *
 * This helper fetches *all* rows by paging with `.range()`.
 *
 * IMPORTANT: Always provide a deterministic ordering in the builderFactory
 * to avoid duplicates/holes across pages.
 */
async function selectAllRows<T>(
  builderFactory: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await builderFactory(from, to);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

// ============================================
// Preset Schedule Seed Route
// ============================================

export async function seedPresetSchedules(c: Context) {
  try {
    const { presetId, schedule } = (await c.req.json()) as {
      presetId?: string;
      schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
    };

    if (!presetId) {
      return c.json({ error: "presetId is required" }, 400);
    }

    const { count } = await supabase
      .from("preset_schedules")
      .select("id", { count: "exact", head: true })
      .eq("preset_id", presetId);

    if ((count ?? 0) > 0) {
      return c.json({ success: true, seeded: false });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return c.json({ error: "schedule is required to seed" }, 400);
    }

    const rows = schedule.flatMap((d) =>
      (d.readings || []).map((r) => ({
        preset_id: presetId,
        day: d.day,
        book: r.book,
        chapters: r.chapters,
      }))
    );

    if (rows.length > 10000) {
      return c.json({ error: "schedule too large" }, 400);
    }

    const { error } = await supabase.from("preset_schedules").upsert(rows, {
      onConflict: "preset_id,day,book,chapters",
      ignoreDuplicates: true,
    });

    if (error) throw error;

    return c.json({ success: true, seeded: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to seed preset schedules"), 500);
  }
}

// ============================================
// Plan Routes
// ============================================

export async function createPlan(c: Context) {
  try {
    const userId = c.get("userId");
    const body = (await c.req.json()) as CreatePlanRequest;

    const { name, startDate, endDate, totalDays, schedule, isCustom, presetId } = body;

    // Validation
    if (!name || !startDate || !totalDays) {
      return c.json({ error: "Name, start date, and total days are required" }, 400);
    }

    if (Number(totalDays) > MAX_PLAN_TOTAL_DAYS) {
      return c.json({ error: `Plan is too long. Max ${MAX_PLAN_TOTAL_DAYS} days.` }, 400);
    }

    if (Array.isArray(schedule) && schedule.length > 0) {
      let rows = 0;
      for (const d of schedule) {
        const readings = (d as any)?.readings;
        if (Array.isArray(readings)) rows += readings.length;
        if (rows > MAX_SCHEDULE_ROWS) break;
      }
      if (rows > MAX_SCHEDULE_ROWS) {
        return c.json({ error: `Plan schedule is too large. Max ${MAX_SCHEDULE_ROWS} rows.` }, 413);
      }
    }

    if (isCustom && !schedule) {
      return c.json({ error: "Schedule required for custom plans" }, 400);
    }

    if (!isCustom && !presetId) {
      return c.json({ error: "Preset ID required for preset plans" }, 400);
    }

    // Preset plan은 preset_plans(id)를 참조하므로, 새 DB/커스텀 프리셋에서 preset이 없으면 먼저 생성
    if (!isCustom && presetId) {
      const { data: existingPreset, error: presetLookupError } = await supabase
        .from("preset_plans")
        .select("id")
        .eq("id", presetId)
        .maybeSingle();

      if (presetLookupError) throw presetLookupError;

      if (!existingPreset) {
        const { error: presetInsertError } = await supabase.from("preset_plans").insert({
          id: presetId,
          name,
          description: null,
          total_days: totalDays,
        });

        if (presetInsertError) throw presetInsertError;
      }
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return c.json({ error: `Plan "${name}" already exists` }, 409);
    }

    // Display order 계산
    const { data: maxOrder } = await supabase
      .from("plans")
      .select("display_order")
      .eq("user_id", userId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.display_order ?? 0) + 1;

    // Plan 생성
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .insert({
        user_id: userId,
        preset_id: isCustom ? null : presetId,
        name,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        is_custom: isCustom,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (planError || !plan) {
      throw planError;
    }

    // Schedule 생성
    // - Custom plan: plan_schedules에 저장
    // - Preset plan: preset_schedules가 비어있으면(새 DB) 클라이언트가 보낸 schedule로 1회 시드
    if (!isCustom && presetId && schedule && schedule.length > 0) {
      const { count, error: presetCountError } = await supabase
        .from("preset_schedules")
        .select("id", { count: "exact", head: true })
        .eq("preset_id", presetId);

      if (presetCountError) throw presetCountError;

      const presetRowsRaw = schedule.flatMap((day) =>
        day.readings.map((reading) => ({
          preset_id: presetId,
          day: day.day,
          book: reading.book,
          chapters: reading.chapters,
        }))
      );

      const presetRows = disambiguateDuplicateScheduleRows(
        presetRowsRaw.map((r) => ({
          ...r,
          // Ensure comparison is stable even if client already contains zero-width characters.
          chapters: stripZeroWidth(r.chapters),
        })) as any
      ) as typeof presetRowsRaw;

      const expectedRows = presetRows.length;

      // IMPORTANT: never silently partially seed preset schedules.
      // If DB has fewer rows than expected (common after timeout/partial insert), repair by upserting missing rows.
      if (expectedRows > 0 && (count ?? 0) < expectedRows) {
        const chunks = chunkArray(presetRows, 500);
        for (const chunk of chunks) {
          const { error: presetSeedError } = await supabase.from("preset_schedules").upsert(chunk, {
            onConflict: "preset_id,day,book,chapters",
            ignoreDuplicates: true,
          });

          if (presetSeedError) {
            console.error("Failed to seed/repair preset_schedules:", presetSeedError);
            // Rollback created plan to avoid plans pointing at incomplete preset schedules.
            await supabase.from("plans").delete().eq("id", plan.id);
            throw presetSeedError;
          }
        }

        const { count: finalCount, error: finalCountError } = await supabase
          .from("preset_schedules")
          .select("id", { count: "exact", head: true })
          .eq("preset_id", presetId);

        if (finalCountError) {
          await supabase.from("plans").delete().eq("id", plan.id);
          throw finalCountError;
        }

        if ((finalCount ?? 0) < expectedRows) {
          await supabase.from("plans").delete().eq("id", plan.id);
          return c.json({ error: "Failed to seed preset schedule. Please retry." }, 500);
        }
      }
    }

    // Custom plan: plan_schedules
    if (isCustom && schedule && schedule.length > 0) {
      const scheduleRowsRaw = schedule.flatMap((day) =>
        day.readings.map((reading) => ({
          plan_id: plan.id,
          day: day.day,
          book: reading.book,
          chapters: reading.chapters,
        }))
      );

      const scheduleRows = disambiguateDuplicateScheduleRows(
        scheduleRowsRaw.map((r) => ({
          ...r,
          chapters: stripZeroWidth(r.chapters),
        })) as any
      ) as typeof scheduleRowsRaw;

      // Insert in chunks to avoid row/request limits.
      const chunks = chunkArray(scheduleRows, 500);
      for (const chunk of chunks) {
        const { error: scheduleError } = await supabase.from("plan_schedules").insert(chunk);

        if (scheduleError) {
          // Rollback
          await supabase.from("plans").delete().eq("id", plan.id);
          throw scheduleError;
        }
      }
    }

    return c.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        startDate: plan.start_date,
        endDate: plan.end_date,
        totalDays: plan.total_days,
        isCustom: plan.is_custom,
        schedule: schedule || [],
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to create plan"), 500);
  }
}

export async function getPlans(c: Context) {
  try {
    const userId = c.get("userId");

    const { data: plansData, error } = await supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
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
      const customRows = await selectAllRows<any>(
        (from, to) =>
          supabase
            .from("plan_schedules")
            .select("plan_id, day, book, chapters")
            .in("plan_id", customPlanIds)
            // Deterministic ordering for stable pagination
            .order("plan_id", { ascending: true })
            .order("day", { ascending: true })
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
      const presetRows = await selectAllRows<any>(
        (from, to) =>
          supabase
            .from("preset_schedules")
            .select("preset_id, day, book, chapters")
            .in("preset_id", presetIds)
            // Deterministic ordering for stable pagination
            .order("preset_id", { ascending: true })
            .order("day", { ascending: true })
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
        isCustom: p.is_custom,
        displayOrder: p.display_order,
        createdAt: p.created_at,
        schedule: buildSchedule(rows),
      };
    });

    return c.json({ success: true, plans });
  } catch (error) {
    return c.json(handleError(error, "Failed to get plans"), 500);
  }
}

export async function deletePlan(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.param("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const { error } = await supabase.from("plans").delete().eq("id", planId).eq("user_id", userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete plan"), 500);
  }
}

export async function updatePlanOrder(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, newOrder } = (await c.req.json()) as UpdatePlanOrderRequest;

    if (!planId || newOrder === undefined) {
      return c.json({ error: "Plan ID and new order are required" }, 400);
    }

    // Plan 확인
    const { data: plan } = await supabase
      .from("plans")
      .select("display_order")
      .eq("id", planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!plan) {
      return c.json({ error: "Plan not found" }, 404);
    }

    const oldOrder = plan.display_order;

    // Order 변경
    if (oldOrder !== newOrder) {
      if (newOrder < oldOrder) {
        // 위로 이동: newOrder ~ oldOrder-1 사이 증가
        await supabase.rpc("increment_display_order", {
          p_user_id: userId,
          p_min_order: newOrder,
          p_max_order: oldOrder - 1,
        });
      } else {
        // 아래로 이동: oldOrder+1 ~ newOrder 사이 감소
        await supabase.rpc("decrement_display_order", {
          p_user_id: userId,
          p_min_order: oldOrder + 1,
          p_max_order: newOrder,
        });
      }

      // 대상 Plan 업데이트
      const { error } = await supabase
        .from("plans")
        .update({ display_order: newOrder })
        .eq("id", planId)
        .eq("user_id", userId);

      if (error) throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to update plan order"), 500);
  }
}

