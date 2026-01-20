/**
 * Progress Routes
 */

import { Context } from "npm:hono";
import { getSupabaseClient, fetchUserProgress, handleError } from "./utils.ts";
import type { UpdateProgressRequest } from "./types.ts";

const supabase = getSupabaseClient();

export async function updateProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, day, completed, readingIndex, completedChapters } = (await c.req.json()) as UpdateProgressRequest;

    if (!planId || day === undefined || readingIndex === undefined) {
      return c.json({ error: "Plan ID, day, and reading index required" }, 400);
    }

    if (completed) {
      // 완료 표시 (전체 완료는 completed_chapters = null)
      const { error } = await supabase.from("reading_progress").upsert(
        {
          user_id: userId,
          plan_id: planId,
          day,
          reading_index: readingIndex,
          completed_at: new Date().toISOString(),
          completed_chapters: null,
        },
        { onConflict: "user_id, plan_id, day, reading_index" }
      );

      if (error) throw error;
    } else if (completedChapters && completedChapters.length > 0) {
       // 부분 완료 (세분화된 체크)
       const { error } = await supabase.from("reading_progress").upsert(
        {
          user_id: userId,
          plan_id: planId,
          day,
          reading_index: readingIndex,
          completed_at: new Date().toISOString(),
          completed_chapters: completedChapters,
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

