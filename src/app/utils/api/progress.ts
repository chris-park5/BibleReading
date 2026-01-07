import type { Progress } from "../../../types/domain";
import { fetchAPI } from "./_internal";

// ============================================================================
// Progress APIs
// ============================================================================

export async function updateReadingProgress(
  planId: string,
  day: number,
  readingIndex: number,
  completed: boolean,
  readingCount: number
): Promise<{ success: boolean; progress: Progress }> {
  if (!planId) throw new Error("Plan ID is required");
  if (!Number.isFinite(day)) throw new Error("day is required");
  if (!Number.isFinite(readingIndex)) throw new Error("readingIndex is required");

  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, readingIndex, completed, readingCount }),
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
  return fetchAPI(`/progress?planId=${planId}`);
}
