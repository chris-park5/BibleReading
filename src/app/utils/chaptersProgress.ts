import type { Plan, Progress } from "../../types/domain";

export function countChapters(raw: string): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;

  // Accept patterns like "1", "1-3", "1,2,4-6"; ignore non-numeric decorations.
  const cleaned = s
    .replace(/장/g, "")
    .replace(/[^0-9,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return 0;
  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let total = 0;
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) {
      // Fallback: if we cannot parse, treat as 1 reading unit.
      total += 1;
      continue;
    }
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      total += 1;
      continue;
    }
    total += Math.abs(b - a) + 1;
  }
  return total;
}

export function computeChaptersTotals({
  schedule,
  progress,
  upToDay,
}: {
  schedule: Plan["schedule"];
  progress: Progress;
  upToDay?: number;
}): { totalChapters: number; completedChapters: number } {
  const completedDaysSet = new Set(progress.completedDays || []);
  const completedReadingsByDay = progress.completedReadingsByDay || {};

  let totalChapters = 0;
  let completedChapters = 0;

  for (const entry of schedule) {
    if (!entry) continue;
    const day = entry.day;
    if (typeof day !== "number" || !Number.isFinite(day)) continue;
    if (typeof upToDay === "number" && day > upToDay) continue;

    const readings = Array.isArray(entry.readings) ? entry.readings : [];
    const forcedComplete = completedDaysSet.has(day);
    const completedIndices = completedReadingsByDay[String(day)] || [];
    const completedSet = forcedComplete ? new Set(readings.map((_, i) => i)) : new Set(completedIndices);

    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      const chapters = countChapters(r?.chapters ?? "");
      totalChapters += chapters;
      if (completedSet.has(i)) completedChapters += chapters;
    }
  }

  if (completedChapters > totalChapters) completedChapters = totalChapters;
  return { totalChapters, completedChapters };
}
