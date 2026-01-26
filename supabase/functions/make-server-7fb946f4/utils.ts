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

// ============================================
// Bible Data & Clustering Logic
// ============================================

export type BibleVerseCounts = {
  book: string;
  chapters: number[];
};

export const BIBLE_VERSE_COUNTS: BibleVerseCounts[] = [
  { "book": "창세기", "chapters": [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26] },
  { "book": "출애굽기", "chapters": [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38] },
  { "book": "레위기", "chapters": [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34] },
  { "book": "민수기", "chapters": [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13] },
  { "book": "신명기", "chapters": [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12] },
  { "book": "여호수아", "chapters": [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33] },
  { "book": "사사기", "chapters": [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25] },
  { "book": "룻기", "chapters": [22, 23, 18, 22] },
  { "book": "사무엘상", "chapters": [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 28, 22, 44, 25, 12, 25, 11, 31, 13] },
  { "book": "사무엘하", "chapters": [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25] },
  { "book": "열왕기상", "chapters": [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53] },
  { "book": "열왕기하", "chapters": [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30] },
  { "book": "역대상", "chapters": [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30] },
  { "book": "역대하", "chapters": [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23] },
  { "book": "에스라", "chapters": [11, 70, 13, 24, 17, 22, 28, 36, 15, 44] },
  { "book": "느헤미야", "chapters": [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31] },
  { "book": "에스더", "chapters": [22, 23, 15, 17, 14, 14, 10, 17, 32, 3] },
  { "book": "욥기", "chapters": [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17] },
  { "book": "시편", "chapters": [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6] },
  { "book": "잠언", "chapters": [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31] },
  { "book": "전도서", "chapters": [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14] },
  { "book": "아가", "chapters": [17, 17, 11, 16, 16, 13, 13, 14] },
  { "book": "이사야", "chapters": [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24] },
  { "book": "예레미야", "chapters": [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34] },
  { "book": "예레미야 애가", "chapters": [22, 22, 66, 22, 22] },
  { "book": "에스겔", "chapters": [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35] },
  { "book": "다니엘", "chapters": [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13] },
  { "book": "호세아", "chapters": [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9] },
  { "book": "요엘", "chapters": [20, 32, 21] },
  { "book": "아모스", "chapters": [15, 16, 15, 13, 27, 14, 17, 14, 15] },
  { "book": "오바댜", "chapters": [21] },
  { "book": "요나", "chapters": [17, 10, 10, 11] },
  { "book": "미가", "chapters": [16, 13, 12, 13, 15, 16, 20] },
  { "book": "나훔", "chapters": [15, 13, 19] },
  { "book": "하박국", "chapters": [17, 20, 19] },
  { "book": "스바냐", "chapters": [18, 15, 20] },
  { "book": "학개", "chapters": [15, 23] },
  { "book": "스가랴", "chapters": [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21] },
  { "book": "말라기", "chapters": [14, 17, 18, 6] },
  { "book": "마태복음", "chapters": [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20] },
  { "book": "마가복음", "chapters": [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20] },
  { "book": "누가복음", "chapters": [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53] },
  { "book": "요한복음", "chapters": [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25] },
  { "book": "사도행전", "chapters": [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31] },
  { "book": "로마서", "chapters": [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
  { "book": "고린도전서", "chapters": [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24] },
  { "book": "고린도후서", "chapters": [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 13] },
  { "book": "갈라디아서", "chapters": [24, 21, 29, 31, 26, 18] },
  { "book": "에베소서", "chapters": [23, 22, 21, 32, 33, 24] },
  { "book": "빌립보서", "chapters": [30, 30, 21, 23] },
  { "book": "골로새서", "chapters": [29, 23, 25, 18] },
  { "book": "데살로니가전서", "chapters": [10, 20, 13, 18, 28] },
  { "book": "데살로니가후서", "chapters": [12, 17, 18] },
  { "book": "디모데전서", "chapters": [20, 15, 16, 16, 25, 21] },
  { "book": "디모데후서", "chapters": [18, 26, 17, 22] },
  { "book": "디도서", "chapters": [16, 15, 15] },
  { "book": "빌레몬서", "chapters": [25] },
  { "book": "히브리서", "chapters": [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25] },
  { "book": "야고보서", "chapters": [27, 26, 18, 17, 20] },
  { "book": "베드로전서", "chapters": [25, 25, 22, 19, 14] },
  { "book": "베드로후서", "chapters": [21, 22, 18] },
  { "book": "요한1서", "chapters": [10, 29, 24, 21, 21] },
  { "book": "요한2서", "chapters": [13] },
  { "book": "요한3서", "chapters": [14] },
  { "book": "유다서", "chapters": [25] },
  { "book": "요한계시록", "chapters": [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21] }
];

export function getVerseCounts(bookName: string): number[] | null {
  const found = BIBLE_VERSE_COUNTS.find((b) => b.book === bookName);
  return found ? found.chapters : null;
}

export interface ChapterRange {
  ch: number;
  startVerse: number;
  endVerse: number;
}

export interface ReadingRef {
  day: number;
  index: number;
  weight: number;
}

export interface ChapterInstance {
  book: string;
  ch: number;
  readings: ReadingRef[];
  isFullChapter: boolean;
}

export function parseChapterRanges(raw: string, bookName: string): ChapterRange[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];

  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  const result: ChapterRange[] = [];
  const verseCounts = getVerseCounts(bookName);

  for (const part of parts) {
    const colonMatch = part.match(/^(\d+):(\d+)-(\d+)(?:장|절)?$/);
    if (colonMatch) {
      result.push({ ch: parseInt(colonMatch[1]), startVerse: parseInt(colonMatch[2]), endVerse: parseInt(colonMatch[3]) });
      continue;
    }
    const colonSingleMatch = part.match(/^(\d+):(\d+)(?:장|절)?$/);
    if (colonSingleMatch) {
      const v = parseInt(colonSingleMatch[2]);
      result.push({ ch: parseInt(colonSingleMatch[1]), startVerse: v, endVerse: v });
      continue;
    }
    const krRangeMatch = part.match(/^(\d+)장\s*(\d+)-(\d+)(?:절)?$/);
    if (krRangeMatch) {
      result.push({ ch: parseInt(krRangeMatch[1]), startVerse: parseInt(krRangeMatch[2]), endVerse: parseInt(krRangeMatch[3]) });
      continue;
    }
    const krSingleMatch = part.match(/^(\d+)장\s*(\d+)(?:절)?$/);
    if (krSingleMatch) {
       const v = parseInt(krSingleMatch[2]);
       result.push({ ch: parseInt(krSingleMatch[1]), startVerse: v, endVerse: v });
       continue;
    }

    const cleaned = part.replace(/장/g, "").replace(/절/g, "").trim(); 
    const dashMatch = cleaned.match(/^(\d+)-(\d+)$/);
    if (dashMatch) {
      const start = parseInt(dashMatch[1]);
      const end = parseInt(dashMatch[2]);
      for (let c = start; c <= end; c++) {
        const limit = verseCounts ? (verseCounts[c - 1] ?? 999) : 999;
        result.push({ ch: c, startVerse: 1, endVerse: limit });
      }
      continue;
    }

    const singleNum = parseInt(cleaned);
    if (!isNaN(singleNum)) {
      const limit = verseCounts ? (verseCounts[singleNum - 1] ?? 999) : 999;
      result.push({ ch: singleNum, startVerse: 1, endVerse: limit });
      continue;
    }
  }
  return result;
}

export function clusterReadings(
  bookName: string, 
  readings: Array<{ day: number; index: number; rawChapters: string }>
): ChapterInstance[] {
  const verseCounts = getVerseCounts(bookName);
  
  type ReadingItem = { day: number; index: number; range: ChapterRange };
  const itemsByChapter = new Map<number, ReadingItem[]>();

  for (const r of readings) {
    const ranges = parseChapterRanges(r.rawChapters, bookName);
    for (const rng of ranges) {
      if (!itemsByChapter.has(rng.ch)) {
        itemsByChapter.set(rng.ch, []);
      }
      itemsByChapter.get(rng.ch)!.push({ day: r.day, index: r.index, range: rng });
    }
  }

  const instances: ChapterInstance[] = [];

  for (const [ch, items] of itemsByChapter.entries()) {
    let currentCluster: ReadingItem[] = [];
    let currentCoverage = new Set<number>();

    const finalizeCluster = () => {
      if (currentCluster.length === 0) return;
      const totalVerses = verseCounts ? (verseCounts[ch - 1] ?? 100) : 100;
      const refs: ReadingRef[] = currentCluster.map(item => {
        const len = item.range.endVerse - item.range.startVerse + 1;
        let w = 0;
        if (verseCounts) {
           w = len / totalVerses;
        } else {
           w = 1;
        }
        return { day: item.day, index: item.index, weight: w };
      });
      if (!verseCounts) {
        const count = refs.length;
        refs.forEach(r => r.weight = 1 / count);
      }
      instances.push({ book: bookName, ch, readings: refs, isFullChapter: true });
    };

    for (const item of items) {
      let overlap = false;
      for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
        if (currentCoverage.has(v)) {
          overlap = true;
          break;
        }
      }

      if (overlap) {
        finalizeCluster();
        currentCluster = [item];
        currentCoverage = new Set();
        for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
          currentCoverage.add(v);
        }
      } else {
        currentCluster.push(item);
        for (let v = item.range.startVerse; v <= item.range.endVerse; v++) {
          currentCoverage.add(v);
        }
      }
    }
    finalizeCluster();
  }
  return instances;
}

export function countChapters(raw: string): number {
  return 1; 
}

export function computeChaptersTotals({
  schedule,
  progress,
  upToDay,
}: {
  schedule: any[];
  progress: any;
  upToDay?: number;
}): { totalChapters: number; completedChapters: number } {
  const completedDaysSet = new Set(progress.completedDays || []);
  const completedReadingsByDay = progress.completedReadingsByDay || {};
  const completedChaptersByDay = progress.completedChaptersByDay || {};

  const readingsByBook = new Map<string, Array<{ day: number; index: number; rawChapters: string }>>();
  
  for (const entry of schedule) {
    if (!entry || !entry.readings) continue;
    const day = Number(entry.day);
    if (!Number.isFinite(day)) continue;
    const readings = entry.readings;
    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      if (!r.book) continue;
      if (!readingsByBook.has(r.book)) {
        readingsByBook.set(r.book, []);
      }
      readingsByBook.get(r.book)!.push({ day, index: i, rawChapters: r.chapters });
    }
  }

  let totalChapters = 0;
  let completedChapters = 0;

  for (const [book, items] of readingsByBook.entries()) {
    items.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.index - b.index;
    });

    const instances = clusterReadings(book, items);

    for (const inst of instances) {
      const scheduledRefs = typeof upToDay === "number" 
        ? inst.readings.filter(r => r.day <= upToDay)
        : inst.readings;

      if (scheduledRefs.length === 0) continue;

      let instProgress = 0;
      let instScheduledWeight = 0;
      let allScheduledDone = true;

      for (const ref of scheduledRefs) {
        instScheduledWeight += ref.weight;

        let isDone = false;
        if (completedDaysSet.has(ref.day)) {
          isDone = true;
        } else {
          const dayStr = String(ref.day);
          const doneIndices = completedReadingsByDay[dayStr];
          if (doneIndices && doneIndices.includes(ref.index)) {
            isDone = true;
          } else {
            const doneChapters = completedChaptersByDay[dayStr]?.[ref.index];
            if (doneChapters && doneChapters.includes(String(inst.ch))) {
              isDone = true;
            }
          }
        }

        if (isDone) {
          instProgress += ref.weight;
        } else {
          allScheduledDone = false;
        }
      }

      totalChapters += instScheduledWeight;

      if (allScheduledDone) {
        completedChapters += instScheduledWeight;
      } else {
        completedChapters += instProgress;
      }
    }
  }

  if (typeof upToDay === "undefined") {
      totalChapters = Math.round(totalChapters);
      completedChapters = Math.round(completedChapters * 100) / 100;
  } else {
      totalChapters = Math.round(totalChapters * 100) / 100;
      completedChapters = Math.round(completedChapters * 100) / 100;
  }

  if (completedChapters > totalChapters) completedChapters = totalChapters;

  return { totalChapters, completedChapters };
}

/**
 * 계획의 일정을 가져와서 Day별로 그룹화하여 반환
 */
export async function fetchGroupedSchedule(
  supabase: SupabaseClient,
  plan: { id: string; is_custom: boolean; preset_id: string }
): Promise<any[]> {
  let scheduleRows: any[] = [];
  if (plan.is_custom) {
    const { data } = await supabase
      .from("plan_schedules")
      .select("day, book, chapters")
      .eq("plan_id", plan.id)
      .order("day", { ascending: true });
    scheduleRows = data || [];
  } else {
    const { data } = await supabase
      .from("preset_schedules")
      .select("day, book, chapters")
      .eq("preset_id", plan.preset_id)
      .order("day", { ascending: true });
    scheduleRows = data || [];
  }

  const groupedSchedule: any[] = [];
  const dayMap = new Map<number, any>();
  scheduleRows.forEach((row: any) => {
    const d = Number(row.day);
    if (!dayMap.has(d)) {
      const entry = { day: d, readings: [] };
      dayMap.set(d, entry);
      groupedSchedule.push(entry);
    }
    dayMap.get(d).readings.push({ book: row.book, chapters: row.chapters });
  });

  return groupedSchedule;
}

/**
 * 계획의 현재 달성률(Achievement Rate) 계산
 * 달성률 = (전체 완료한 장 수) / (오늘까지 읽었어야 하는 총 장 수) * 100
 * 진도율 탭(ProgressTab)의 계산 방식과 일치시킵니다.
 */
export async function calculateAchievementRate(
  supabase: SupabaseClient,
  userId: string,
  plan: { id: string; start_date: string; total_days: number; is_custom: boolean; preset_id: string },
  progress: any,
  groupedSchedule?: any[]
): Promise<number> {
  const schedule = groupedSchedule || await fetchGroupedSchedule(supabase, plan);

  // Calculate Today in KST
  const now = new Date();
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstTime);
  const todayKST = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

  // Calculate elapsedDays
  const [sy, sm, sd] = plan.start_date.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const diffMs = todayKST.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const elapsedDays = Math.max(0, Math.min(plan.total_days, diffDays + 1));

  // Compute Totals
  const { completedChapters: totalCompleted } = computeChaptersTotals({ 
    schedule, 
    progress 
  });
  
  const { totalChapters: elapsedTarget } = computeChaptersTotals({
    schedule,
    progress,
    upToDay: elapsedDays,
  });

  if (elapsedTarget === 0) return 0;
  return (totalCompleted / elapsedTarget) * 100;
}

/**
 * 계획의 전체 진행률(Overall Progress Rate) 계산
 * 진행률 = (전체 완료한 장 수) / (계획 전체의 총 장 수) * 100
 */
export async function calculateProgressRate(
  supabase: SupabaseClient,
  userId: string,
  plan: { id: string; is_custom: boolean; preset_id: string },
  progress: any,
  groupedSchedule?: any[]
): Promise<number> {
  const schedule = groupedSchedule || await fetchGroupedSchedule(supabase, plan);

  // Compute Totals
  const { totalChapters, completedChapters } = computeChaptersTotals({ 
    schedule, 
    progress 
  });

  if (totalChapters === 0) return 0;
  return (completedChapters / totalChapters) * 100;
}
