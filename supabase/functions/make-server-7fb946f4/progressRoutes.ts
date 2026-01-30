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
    const body = await c.req.json();
    const { planId, day, completed, readingIndex, readingCount, completedChapters, currentDate } = body as UpdateProgressRequest;
    
    console.log(`[updateProgress] planId=${planId}, day=${day}, idx=${readingIndex}, completed=${completed}, count=${readingCount}, chapters=${JSON.stringify(completedChapters)}, date=${currentDate}`);

    if (!planId || day === undefined || readingIndex === undefined) {
      return c.json({ error: "Plan ID, day, and reading index required" }, 400);
    }

    // Use provided currentDate (local) or fallback to server UTC date
    const statDate = currentDate ? currentDate : new Date().toISOString().split('T')[0];

    // Call Atomic RPC
    const { error } = await supabase.rpc("handle_reading_progress_update", {
      p_user_id: userId,
      p_plan_id: planId,
      p_day: day,
      p_reading_index: readingIndex,
      p_completed: completed,
      p_reading_count: readingCount ?? 0,
      p_completed_chapters: completedChapters ?? [],
      p_stats_date: statDate
    });

    if (error) {
      console.error("RPC Error:", error);
      throw error;
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

export async function getDailyStats(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    let query = supabase
      .from("daily_reading_stats")
      .select("date, count")
      .eq("user_id", userId);

    if (planId) {
      query = query.eq("plan_id", planId);
    }
    
    // Sort by date desc
    query = query.order("date", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return c.json({ success: true, stats: data });
  } catch (error) {
    return c.json(handleError(error, "Failed to get daily stats"), 500);
  }
}

