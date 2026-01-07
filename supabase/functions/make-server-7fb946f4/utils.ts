/**
 * Database Utilities
 * 
 * Supabase 클라이언트 및 데이터베이스 공통 함수
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

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
    .select("day, reading_index")
    .eq("user_id", userId)
    .eq("plan_id", planId);

  if (error) throw error;

  // 완료된 읽기를 day별로 그룹화
  const completedReadingsByDay: Record<string, number[]> = {};
  const completedSetsByDay = new Map<number, Set<number>>();

  (data ?? []).forEach((item: any) => {
    const dayNum = Number(item.day);
    const idx = Number(item.reading_index);
    if (!Number.isFinite(dayNum) || !Number.isFinite(idx)) return;

    const dayStr = String(dayNum);
    if (!completedReadingsByDay[dayStr]) {
      completedReadingsByDay[dayStr] = [];
    }
    completedReadingsByDay[dayStr].push(idx);

    if (!completedSetsByDay.has(dayNum)) {
      completedSetsByDay.set(dayNum, new Set());
    }
    completedSetsByDay.get(dayNum)!.add(idx);
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
      lastUpdated: new Date().toISOString(),
    };
  }

  const scheduleCountByDay = new Map<number, number>();

  if (planRow.is_custom) {
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("plan_schedules")
      .select("day")
      .eq("plan_id", planId);

    if (scheduleError) throw scheduleError;
    (scheduleRows ?? []).forEach((r: any) => {
      const dayNum = Number(r.day);
      if (!Number.isFinite(dayNum)) return;
      scheduleCountByDay.set(dayNum, (scheduleCountByDay.get(dayNum) ?? 0) + 1);
    });
  } else {
    if (planRow.preset_id) {
      const { data: scheduleRows, error: scheduleError } = await supabase
        .from("preset_schedules")
        .select("day")
        .eq("preset_id", planRow.preset_id);

      if (scheduleError) throw scheduleError;
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
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 에러 핸들링 유틸리티
 */
export function handleError(error: unknown, message: string) {
  console.error(`${message}:`, error);
  return { error: message };
}
