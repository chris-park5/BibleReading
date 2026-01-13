/**
 * API Routes
 * 
 * 간결하고 명확한 라우트 핸들러
 */

import { Context } from "npm:hono";
import { getSupabaseClient, verifyAccessToken, fetchUserProgress, handleError } from "./utils.ts";
import * as auth from "./auth.ts";
import webpush from "npm:web-push@3";
import type {
  CreatePlanRequest,
  UpdatePlanOrderRequest,
  UpdateProgressRequest,
  AddFriendRequest,
  CancelFriendRequest,
  RespondFriendRequest,
  SetSharePlanRequest,
  NotificationRequest,
} from "./types.ts";

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

function timeHHMM(value: string) {
  // Accept 'HH:MM' or 'HH:MM:SS'
  const parts = String(value || "").split(":");
  if (parts.length < 2) return null;
  const hh = parts[0].padStart(2, "0");
  const mm = parts[1].padStart(2, "0");
  return `${hh}:${mm}`;
}

function nowInSeoul() {
  // Supabase Edge runs in UTC. We normalize to Asia/Seoul for scheduling.
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const yyyy = get("year") ?? "";
  const mm = get("month") ?? "";
  const dd = get("day") ?? "";
  const hour = get("hour") ?? "00";
  const minute = get("minute") ?? "00";
  return {
    date: `${yyyy}-${mm}-${dd}`,
    hhmm: `${hour}:${minute}`,
  };
}

function requireCronSecret(c: Context) {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return { ok: false as const, reason: "Missing CRON_SECRET env" };
  const got = c.req.header("x-cron-secret");
  if (!got || got !== expected) return { ok: false as const, reason: "Invalid cron secret" };
  return { ok: true as const };
}

function initWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function sendPushToUser(userId: string, payloadJson: unknown) {
  const payload = JSON.stringify(payloadJson);

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,expiration_time")
    .eq("user_id", userId);

  if (subsError) throw subsError;
  if (!subs?.length) return { delivered: 0, removed: 0 };

  let delivered = 0;
  let removed = 0;

  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      expirationTime: s.expiration_time ?? null,
      keys: {
        p256dh: s.p256dh,
        auth: s.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription as any, payload);
      delivered++;
    } catch (e: any) {
      const statusCode = e?.statusCode ?? e?.status;
      if (statusCode === 404 || statusCode === 410) {
        const { error: delErr } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", s.id);
        if (!delErr) removed++;
      }
    }
  }

  return { delivered, removed };
}

// ============================================
// Middleware
// ============================================

export async function requireAuth(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  
  if (!token) {
    return c.json({ error: "Invalid authorization header" }, 401);
  }

  const origin = new URL(c.req.url).origin;
  const result = await verifyAccessToken(token, origin);

  if (!result.success || !result.user) {
    const msg = (result as any).error ?? "Unauthorized";
    return c.json({ error: msg }, 401);
  }

  c.set("userId", result.user.id);
  c.set("userEmail", result.user.email);
  await next();
}

// ============================================
// Auth Routes
// ============================================

export async function signup(c: Context) {
  try {
    const { email, password, name, username } = await c.req.json();

    if (!email || !password || !name || !username) {
      return c.json({ error: "All fields are required" }, 400);
    }

    // Username 중복 확인
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return c.json({ error: "Username already exists" }, 409);
    }

    // 사용자 생성
    const result = await auth.createUser(email, password, name, username);

    if (!result.success || !result.user) {
      return c.json({ error: result.error }, 400);
    }

    // auth.users -> public.users 동기화는 DB 트리거(handle_new_auth_user)가 담당
    // (트리거가 적용되지 않았으면 이후 기능이 꼬이므로 여기서 빠르게 감지)
    const { data: profile, error: profileSelectError } = await supabase
      .from("users")
      .select("id")
      .eq("id", result.user.id)
      .maybeSingle();

    if (profileSelectError) {
      console.error("User profile check failed:", profileSelectError);
      return c.json({ error: "Failed to verify user profile" }, 500);
    }

    if (!profile) {
      return c.json(
        {
          error:
            "User profile was not created. Ensure DB migration (trigger on auth.users) is applied.",
        },
        500
      );
    }

    return c.json({ success: true, user: result.user });
  } catch (error) {
    return c.json(handleError(error, "Signup failed"), 500);
  }
}

export async function getUsernameEmail(c: Context) {
  try {
    const { username } = await c.req.json();

    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }

    const result = await auth.findUserByUsername(username);

    if (!result.success && (result as any).error) {
      return c.json({ error: (result as any).error }, 500);
    }

    if (!result.success || !result.user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ success: true, email: result.user.email });
  } catch (error) {
    return c.json(handleError(error, "Failed to find user"), 500);
  }
}

// ============================================
// Preset Schedule Seed Route
// ============================================

export async function seedPresetSchedules(c: Context) {
  try {
    const { presetId, schedule } = await c.req.json() as {
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

    const { error } = await supabase
      .from("preset_schedules")
      .upsert(rows, {
        onConflict: "preset_id,day,book,chapters",
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return c.json({ success: true, seeded: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to seed preset schedules"), 500);
  }
}

export async function deleteAccount(c: Context) {
  try {
    const userId = c.get("userId");
    const result = await auth.deleteUser(userId);

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete account"), 500);
  }
}

// ============================================
// Plan Routes
// ============================================

export async function createPlan(c: Context) {
  try {
    const userId = c.get("userId");
    const body = await c.req.json() as CreatePlanRequest;
    
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
        const { error: presetInsertError } = await supabase
          .from("preset_plans")
          .insert({
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
          const { error: presetSeedError } = await supabase
            .from("preset_schedules")
            .upsert(chunk, {
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
        const { error: scheduleError } = await supabase
          .from("plan_schedules")
          .insert(chunk);

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

    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete plan"), 500);
  }
}

export async function updatePlanOrder(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, newOrder } = await c.req.json() as UpdatePlanOrderRequest;

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

// ============================================
// Progress Routes
// ============================================

export async function updateProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, day, completed, readingIndex } = await c.req.json() as UpdateProgressRequest;

    if (!planId || day === undefined || readingIndex === undefined) {
      return c.json({ error: "Plan ID, day, and reading index required" }, 400);
    }

    if (completed) {
      // 완료 표시
      const { error } = await supabase
        .from("reading_progress")
        .upsert(
          {
            user_id: userId,
            plan_id: planId,
            day,
            reading_index: readingIndex,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id, plan_id, day, reading_index" }
        );

      if (error) throw error;
    } else {
      // 완료 취소
      const { error } = await supabase
        .from("reading_progress")
        .delete()
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("day", day)
        .eq("reading_index", readingIndex);

      if (error) throw error;
    }

    // 업데이트된 진도 반환
    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to update progress"), 500);
  }
}

export async function getProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to get progress"), 500);
  }
}

// ============================================
// Friend Routes
// ============================================

export async function addFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const { friendIdentifier } = await c.req.json() as AddFriendRequest;

    if (!friendIdentifier) {
      return c.json({ error: "Friend identifier is required" }, 400);
    }

    // Email 또는 Username 조회
    const isEmail = friendIdentifier.includes("@");
    const { data: friend, error: findError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .eq(isEmail ? "email" : "username", friendIdentifier)
      .maybeSingle();

    if (findError || !friend) {
      return c.json({ error: "User not found" }, 404);
    }

    // 자기 자신 추가 방지
    if (friend.id === userId) {
      return c.json({ error: "Cannot add yourself" }, 400);
    }

    // 기존 관계(정규화 때문에 양방향 모두 확인)
    const { data: existing, error: existingError } = await supabase
      .from("friendships")
      .select("id, status, requested_by, user_id, friend_id")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      if (existing.status === "accepted") {
        return c.json({ error: "Already friends" }, 409);
      }

      if (existing.requested_by === userId) {
        return c.json({ error: "Friend request already sent" }, 409);
      }

      return c.json({ error: "Friend request already received" }, 409);
    }

    // 친구 요청 생성 (pending)
    // friendships 테이블은 requested_by NOT NULL이며, 정규화 트리거가 쌍을 정리하므로 requested_by를 명시해야 함
    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id: userId,
        friend_id: friend.id,
        requested_by: userId,
        status: "pending",
      });

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to add friend"), 500);
  }
}

export async function getFriends(c: Context) {
  try {
    const userId = c.get("userId");

    // 1) 수락된 친구 목록
    const { data: acceptedRows, error: acceptedError } = await supabase
      .from("friendships")
      .select(`id, user_id, friend_id, created_at, status`)
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (acceptedError) throw acceptedError;

    const acceptedFriendIds = (acceptedRows ?? []).map((r: any) =>
      r.user_id === userId ? r.friend_id : r.user_id
    );

    const { data: acceptedUsers, error: acceptedUsersError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .in("id", acceptedFriendIds.length ? acceptedFriendIds : ["00000000-0000-0000-0000-000000000000"]);

    if (acceptedUsersError) throw acceptedUsersError;

    const acceptedUserMap = new Map<string, any>();
    (acceptedUsers ?? []).forEach((u: any) => acceptedUserMap.set(u.id, u));

    const friends = (acceptedRows ?? [])
      .map((r: any) => {
        const friendId = r.user_id === userId ? r.friend_id : r.user_id;
        const u = acceptedUserMap.get(friendId);
        if (!u) return null;
        return {
          userId: u.id,
          email: u.email,
          name: u.name,
          username: u.username,
          addedAt: r.created_at,
        };
      })
      .filter(Boolean);

    // 2) 받은 친구 요청(내가 requested_by가 아닌 pending)
    const { data: incomingRows, error: incomingError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, created_at, status")
      .eq("status", "pending")
      .neq("requested_by", userId)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (incomingError) throw incomingError;

    const incomingRequesterIds = (incomingRows ?? []).map((r: any) => r.requested_by);
    const { data: requesterUsers, error: requesterError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .in(
        "id",
        incomingRequesterIds.length ? incomingRequesterIds : ["00000000-0000-0000-0000-000000000000"]
      );

    if (requesterError) throw requesterError;

    const requesterMap = new Map<string, any>();
    (requesterUsers ?? []).forEach((u: any) => requesterMap.set(u.id, u));

    const incomingRequests = (incomingRows ?? [])
      .map((r: any) => {
        const requester = requesterMap.get(r.requested_by);
        if (!requester) return null;
        return {
          requestId: r.id,
          fromUser: {
            id: requester.id,
            email: requester.email,
            name: requester.name,
            username: requester.username,
          },
          createdAt: r.created_at,
        };
      })
      .filter(Boolean);

    // 3) 내가 보낸 친구 요청(대기중)
    const { data: outgoingRows, error: outgoingError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, created_at, status")
      .eq("status", "pending")
      .eq("requested_by", userId)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (outgoingError) throw outgoingError;

    const outgoingTargetIds = (outgoingRows ?? []).map((r: any) =>
      r.user_id === userId ? r.friend_id : r.user_id
    );

    const { data: outgoingTargets, error: outgoingTargetsError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .in(
        "id",
        outgoingTargetIds.length ? outgoingTargetIds : ["00000000-0000-0000-0000-000000000000"]
      );

    if (outgoingTargetsError) throw outgoingTargetsError;

    const outgoingTargetMap = new Map<string, any>();
    (outgoingTargets ?? []).forEach((u: any) => outgoingTargetMap.set(u.id, u));

    const outgoingRequests = (outgoingRows ?? [])
      .map((r: any) => {
        const toUserId = r.user_id === userId ? r.friend_id : r.user_id;
        const toUser = outgoingTargetMap.get(toUserId);
        if (!toUser) return null;
        return {
          requestId: r.id,
          toUser: {
            id: toUser.id,
            email: toUser.email,
            name: toUser.name,
            username: toUser.username,
          },
          createdAt: r.created_at,
        };
      })
      .filter(Boolean);

    return c.json({ success: true, friends, incomingRequests, outgoingRequests });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friends"), 500);
  }
}

export async function cancelFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const { requestId } = await c.req.json() as CancelFriendRequest;

    if (!requestId) {
      return c.json({ error: "requestId is required" }, 400);
    }

    const { data: row, error: rowError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404);

    const isParticipant = row.user_id === userId || row.friend_id === userId;
    if (!isParticipant) return c.json({ error: "Forbidden" }, 403);
    if (row.requested_by !== userId) return c.json({ error: "Only requester can cancel" }, 403);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to cancel friend request"), 500);
  }
}

// ============================================
// Share Plan Routes
// ============================================

export async function getSharePlan(c: Context) {
  try {
    const userId = c.get("userId");

    const { data: userRow, error } = await supabase
      .from("users")
      .select("shared_plan_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return c.json({ success: true, sharedPlanId: userRow?.shared_plan_id ?? null });
  } catch (error) {
    return c.json(handleError(error, "Failed to get shared plan"), 500);
  }
}

export async function setSharePlan(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId } = await c.req.json() as SetSharePlanRequest;

    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id")
        .eq("id", planId)
        .eq("user_id", userId)
        .maybeSingle();

      if (planError) throw planError;
      if (!plan) return c.json({ error: "Plan not found" }, 404);
    }

    const { error } = await supabase
      .from("users")
      .update({ shared_plan_id: planId ?? null })
      .eq("id", userId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to set shared plan"), 500);
  }
}

export async function respondFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const { requestId, action } = await c.req.json() as RespondFriendRequest;

    if (!requestId || (action !== "accept" && action !== "decline")) {
      return c.json({ error: "requestId and valid action are required" }, 400);
    }

    // 대상 요청 확인 (내가 참여자이고, 내가 요청자가 아닌 pending만 처리 가능)
    const { data: row, error: rowError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404);

    const isParticipant = row.user_id === userId || row.friend_id === userId;
    if (!isParticipant) return c.json({ error: "Forbidden" }, 403);
    if (row.requested_by === userId) return c.json({ error: "Cannot respond to own request" }, 400);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    if (action === "accept") {
      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (updateError) throw updateError;
      return c.json({ success: true });
    }

    // decline: delete request row
    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to respond to friend request"), 500);
  }
}

export async function getFriendStatus(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.query("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    // 수락된 친구 관계 확인
    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;
    if (!friendship) return c.json({ error: "Not friends" }, 403);

    const { data: friendUser, error: friendUserError } = await supabase
      .from("users")
      .select("id, email, name, username, shared_plan_id")
      .eq("id", friendUserId)
      .maybeSingle();

    if (friendUserError) throw friendUserError;
    if (!friendUser) return c.json({ error: "User not found" }, 404);

    // 공유할 계획은 친구가 '선택한' 계획만 보여줌
    const selectedPlanId = friendUser.shared_plan_id ?? null;

    if (!selectedPlanId) {
      return c.json({
        success: true,
        friendStatus: {
          user: friendUser,
          plan: null,
          achievementRate: 0,
          completedDays: 0,
          totalDays: 0,
        },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, total_days, start_date")
      .eq("id", selectedPlanId)
      .maybeSingle();

    if (planError) throw planError;

    if (!plan) {
      return c.json({
        success: true,
        friendStatus: {
          user: friendUser,
          plan: null,
          achievementRate: 0,
          completedDays: 0,
          totalDays: 0,
        },
      });
    }

    const progress = await fetchUserProgress(friendUserId, plan.id);
    const completedDays = progress.completedDays.length;
    const totalDays = Number(plan.total_days) || 0;
    const achievementRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return c.json({
      success: true,
      friendStatus: {
        user: friendUser,
        plan: {
          id: plan.id,
          name: plan.name,
          totalDays,
          startDate: plan.start_date,
        },
        achievementRate,
        completedDays,
        totalDays,
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friend status"), 500);
  }
}

export async function getFriendProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.query("friendUserId");
    const planId = c.req.query("planId");

    if (!friendUserId || !planId) {
      return c.json({ error: "Friend user ID and plan ID required" }, 400);
    }

    // 친구 관계 확인
    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;

    if (!friendship) {
      return c.json({ error: "Not friends" }, 403);
    }

    // 친구의 진도 조회
    const progress = await fetchUserProgress(friendUserId, planId);
    return c.json({ success: true, friendProgress: progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friend progress"), 500);
  }
}

export async function deleteFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.param("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    if (friendUserId === userId) {
      return c.json({ error: "Cannot delete yourself" }, 400);
    }

    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;
    if (!friendship) return c.json({ error: "Not friends" }, 403);

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendship.id);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete friend"), 500);
  }
}

// ============================================
// Notification Routes (Stub)
// ============================================

export async function saveNotification(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, time, enabled } = (await c.req.json()) as NotificationRequest;

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!planId || typeof planId !== "string") {
      return c.json({ error: "planId is required" }, 400);
    }

    if (!time || typeof time !== "string") {
      return c.json({ error: "time is required" }, 400);
    }

    if (typeof enabled !== "boolean") {
      return c.json({ error: "enabled must be boolean" }, 400);
    }

    // Ensure the plan belongs to the user.
    const { data: planRow, error: planError } = await supabase
      .from("plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (planError) throw planError;
    if (!planRow) {
      return c.json({ error: "Plan not found" }, 404);
    }

    const { data, error } = await supabase
      .from("notification_settings")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          time,
          enabled,
        },
        { onConflict: "user_id,plan_id" }
      )
      .select("plan_id,time,enabled")
      .maybeSingle();

    if (error) throw error;

    return c.json({
      success: true,
      notification: {
        planId: data?.plan_id ?? planId,
        time: data?.time ?? time,
        enabled: typeof data?.enabled === "boolean" ? data.enabled : enabled,
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to save notification"), 500);
  }
}

export async function getNotifications(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("notification_settings")
      .select("plan_id,time,enabled")
      .eq("user_id", userId);

    if (error) throw error;

    const notifications = (data ?? []).map((row: any) => ({
      planId: row.plan_id,
      time: row.time,
      enabled: Boolean(row.enabled),
    }));

    return c.json({ success: true, notifications });
  } catch (error) {
    return c.json(handleError(error, "Failed to get notifications"), 500);
  }
}

// ============================================
// Web Push
// ============================================

export async function savePushSubscription(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const authKey = body?.keys?.auth;
    const expirationTime = body?.expirationTime ?? null;
    const userAgent = body?.userAgent ?? null;

    if (!endpoint || !p256dh || !authKey) {
      return c.json({ error: "Invalid subscription" }, 400);
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth: authKey,
          expiration_time: typeof expirationTime === "number" ? expirationTime : null,
          user_agent: typeof userAgent === "string" ? userAgent : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to save push subscription"), 500);
  }
}

export async function sendScheduledNotifications(c: Context) {
  try {
    const authz = requireCronSecret(c);
    if (!authz.ok) return c.json({ error: authz.reason }, 401);

    initWebPush();

    const { date, hhmm } = nowInSeoul();

    const { data: due, error: dueError } = await supabase
      .from("notification_settings")
      .select("id,user_id,plan_id,time,enabled,last_sent_at")
      .eq("enabled", true);

    if (dueError) throw dueError;

    const dueFiltered = (due ?? []).filter((row: any) => {
      const t = timeHHMM(row.time);
      if (!t || t !== hhmm) return false;

      const last = row.last_sent_at ? new Date(row.last_sent_at) : null;
      if (!last) return true;

      const lastDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(last);

      return lastDate !== date;
    });

    let sent = 0;
    let removed = 0;

    for (const row of dueFiltered) {
      const userId = row.user_id;

      const payload = {
        title: "성경 읽기 알림",
        body: "오늘 말씀을 읽을 시간이에요. 앱을 열어 오늘의 읽기를 확인하세요.",
        url: "/",
      };

      const result = await sendPushToUser(userId, payload);
      removed += result.removed;

      if (result.delivered > 0) {
        sent++;
        await supabase
          .from("notification_settings")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    return c.json({ success: true, hhmm, date, due: dueFiltered.length, sent, removed });
  } catch (error) {
    return c.json(handleError(error, "Failed to send scheduled notifications"), 500);
  }
}

export async function sendTestPush(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    initWebPush();

    const payload = {
      title: "테스트 알림",
      body: "오늘 말씀을 읽을 시간이에요. 알림이 정상적으로 작동합니다!",
      url: "/",
    };

    const result = await sendPushToUser(userId, payload);
    return c.json({ success: true, delivered: result.delivered, removed: result.removed });
  } catch (error) {
    return c.json(handleError(error, "Failed to send test push"), 500);
  }
}

export async function getVapidPublicKey(c: Context) {
  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!publicKey) {
      return c.json({ error: "Missing VAPID_PUBLIC_KEY env" }, 500);
    }
    return c.json({ success: true, publicKey });
  } catch (error) {
    return c.json(handleError(error, "Failed to get VAPID public key"), 500);
  }
}
