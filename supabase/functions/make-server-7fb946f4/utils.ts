/**
 * Database Utilities
 * 
 * Supabase 클라이언트 및 데이터베이스 공통 함수
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Note: Supabase/PostgREST enforces a default max rows limit (commonly 1000).
// Large schedules (e.g., preset plans with multiple readings per day) can exceed it.
// This helper fetches all rows via pagination using `.range()`.
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

// Supabase 클라이언트 싱글톤
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!url || !key) {
      throw new Error("Missing Supabase credentials (SUPABASE_URL and SERVICE_ROLE_KEY)");
    }
    
    supabaseInstance = createClient(url, key);
  }
  
  return supabaseInstance;
}

/**
 * 사용자 인증 토큰 검증
 */
export async function verifyAccessToken(token: string, supabaseOrigin?: string) {
  try {
    const apiKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const origin = (supabaseOrigin ?? Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/g, "");

    if (!origin || !apiKey) {
      return { success: false, user: null, error: "Missing server credentials" };
    }

    // Verify access token via GoTrue. This avoids potential header override issues
    // when using a Supabase client initialized with service role key.
    const res = await fetch(`${origin}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let msg = `Token verification failed (status ${res.status})`;
      try {
        const body = await res.json();
        if (body?.msg) msg = body.msg;
        if (body?.message) msg = body.message;
        if (body?.error) msg = body.error;
      } catch {
        // ignore
      }
      return { success: false, user: null, error: msg };
    }

    const user = await res.json();
    if (!user?.id) {
      return { success: false, user: null, error: "Invalid user payload" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("Token verification failed:", error);
    return { success: false, user: null, error: "Token verification exception" };
  }
}

/**
 * 사용자 진도 조회 (공통)
 */
export async function fetchUserProgress(userId: string, planId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from("reading_progress")
    .select("day, reading_index, completed_chapters")
    .eq("user_id", userId)
    .eq("plan_id", planId);

  if (error) throw error;

  // 완료된 읽기를 day별로 그룹화
  const completedReadingsByDay: Record<string, number[]> = {};
  const completedChaptersByDay: Record<string, Record<number, string[]>> = {};
  const completedSetsByDay = new Map<number, Set<number>>();

  (data ?? []).forEach((item: any) => {
    const dayNum = Number(item.day);
    const idx = Number(item.reading_index);
    if (!Number.isFinite(dayNum) || !Number.isFinite(idx)) return;

    const dayStr = String(dayNum);
    
    // Reading Level Progress (Legacy & Full completion check)
    // If completed_chapters is NULL or empty, it might be a legacy full completion.
    // However, if we are moving to granular, presence of row implies something happened.
    // We treat it as "completed reading" ONLY if we don't have partial data OR logic elsewhere handles it.
    // For backward compatibility: if row exists, we put it in completedReadingsByDay initially?
    // No, strictly speaking:
    // If completed_chapters is NULL -> It is fully complete (Legacy).
    // If completed_chapters is present -> It is partial or full.
    // The frontend decides if it's fully complete based on comparison with total chapters.
    // But backend `completedDays` calculation relies on `completedSetsByDay`.
    // We should only add to `completedSetsByDay` if it is FULLY complete.
    // Problem: We don't know the full set of chapters here easily without querying the plan schedule again.
    // BUT, the existing logic assumes "Row Exists = Complete". 
    // If I start inserting partial rows, I BREAK `completedDays` logic.
    // FIX: Only add to `completedReadingsByDay` and `completedSetsByDay` if `completed_chapters` is NULL.
    // If it is NOT NULL, it is partial.
    // WAIT, what if I finish all chapters? I update `completed_chapters` to include all? 
    // Or do I set it to NULL?
    // Let's decide: **NULL = Fully Complete**. **Array = Partial**.
    
    let chapters = item.completed_chapters;

    // Handle potential string return from Postgres (e.g. "{1,2}")
    if (typeof chapters === 'string') {
      const clean = chapters.replace(/^\{|\}$/g, '').trim();
      if (clean.length === 0) {
        chapters = [];
      } else {
        // Handle quoted strings if necessary, but for simple chapter numbers split is usually enough
        chapters = clean.split(',').map((s: string) => s.replace(/^"|"$/g, '').trim());
      }
    }

    if (chapters === null) {
      // Legacy / Fully Complete
      if (!completedReadingsByDay[dayStr]) {
        completedReadingsByDay[dayStr] = [];
      }
      completedReadingsByDay[dayStr].push(idx);

      if (!completedSetsByDay.has(dayNum)) {
        completedSetsByDay.set(dayNum, new Set());
      }
      completedSetsByDay.get(dayNum)!.add(idx);
    } else {
      // Partial Progress
      if (!completedChaptersByDay[dayStr]) {
        completedChaptersByDay[dayStr] = {};
      }
      // Ensure it is an array
      completedChaptersByDay[dayStr][idx] = Array.isArray(chapters) ? chapters : [];
    }
  });

  // completedDays는 "해당 day의 모든 readingIndex가 완료"인 경우만 포함
  // (multi-reading day에서 하나만 체크했는데 전체가 완료로 표시되는 문제 방지)
  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .select("id, is_custom, preset_id")
    .eq("id", planId)
    .maybeSingle();

  if (planError) throw planError;
  if (!planRow) {
    return {
      userId,
      planId,
      completedDays: [],
      completedReadingsByDay,
      completedChaptersByDay,
      lastUpdated: new Date().toISOString(),
    };
  }

  const scheduleCountByDay = new Map<number, number>();

  if (planRow.is_custom) {
    const scheduleRows = await selectAllRows<any>(
      (from, to) =>
        supabase
          .from("plan_schedules")
          .select("day")
          .eq("plan_id", planId)
          .order("day", { ascending: true })
          .range(from, to),
      1000
    );

    (scheduleRows ?? []).forEach((r: any) => {
      const dayNum = Number(r.day);
      if (!Number.isFinite(dayNum)) return;
      scheduleCountByDay.set(dayNum, (scheduleCountByDay.get(dayNum) ?? 0) + 1);
    });
  } else {
    if (planRow.preset_id) {
      const scheduleRows = await selectAllRows<any>(
        (from, to) =>
          supabase
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
  }

  const completedDays: number[] = [];
  for (const [dayNum, completedSet] of completedSetsByDay.entries()) {
    const requiredCount = scheduleCountByDay.get(dayNum) ?? 0;
    if (requiredCount > 0 && completedSet.size >= requiredCount) {
      completedDays.push(dayNum);
    }
  }

  return {
    userId,
    planId,
    completedDays: completedDays.sort((a, b) => a - b),
    completedReadingsByDay,
    completedChaptersByDay,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 에러 핸들링 유틸리티
 */
export function handleError(error: unknown, message: string) {
  console.error(`${message}:`, error);

  // Surface a safe, actionable message to the client.
  // Supabase/PostgREST errors typically have: message, details, hint, code.
  const errObj = error as any;
  const causeMsg =
    typeof errObj?.message === "string" && errObj.message.trim().length > 0
      ? errObj.message.trim()
      : typeof errObj?.error_description === "string" && errObj.error_description.trim().length > 0
      ? errObj.error_description.trim()
      : null;
  const details = typeof errObj?.details === "string" ? errObj.details : null;
  const hint = typeof errObj?.hint === "string" ? errObj.hint : null;
  const code = typeof errObj?.code === "string" ? errObj.code : null;

  const parts: string[] = [message];
  if (causeMsg) parts.push(causeMsg);
  if (code) parts.push(`(code: ${code})`);

  const extra = [details, hint].filter((v) => typeof v === "string" && v.length > 0).join(" ");
  const full = extra ? `${parts.join(" - ")} ${extra}` : parts.join(" - ");

  return { error: full };
}
