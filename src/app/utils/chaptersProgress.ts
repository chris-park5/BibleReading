import type { Plan, Progress } from "../../types/domain";
import { expandChapters } from "./expandChapters";

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
  const completedChaptersByDay = progress.completedChaptersByDay || {};

  // Structure: Map<ChapterKey, Set<ReadingID>>
  // ChapterKey = `${Book}:${Chapter}`
  // ReadingID = `${Day}-${ReadingIndex}`
  // NOTE: This logic assumes 'schedule' readings are sorted (by order_index) so that the array index 'i'
  // corresponds to the persistent 'reading_index' used in the database.
  const chapterRequirements = new Map<string, Set<string>>();

  for (const entry of schedule) {
    if (!entry) continue;
    const day = entry.day;
    if (typeof day !== "number" || !Number.isFinite(day)) continue;
    if (typeof upToDay === "number" && day > upToDay) continue;

    const readings = Array.isArray(entry.readings) ? entry.readings : [];

    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      if (!r.book) continue;

      // Use expandChapters to identify distinct chapters (e.g. "22:1-8" -> "22")
      const chapters = expandChapters(r.chapters);
      
      for (const ch of chapters) {
        const key = `${r.book}:${ch}`;
        if (!chapterRequirements.has(key)) {
          chapterRequirements.set(key, new Set());
        }
        chapterRequirements.get(key)!.add(`${day}-${i}`);
      }
    }
  }

  const totalChapters = chapterRequirements.size;
  let completedChapters = 0;

  for (const [key, reqSet] of chapterRequirements) {
    // Extract strictly the chapter number part for partial checks
    // key format: "BookName:ChapterNum"
    const [_, chNum] = key.split(":"); 

    let isFullyComplete = true;

    for (const req of reqSet) {
      const [dStr, iStr] = req.split("-");
      const d = Number(dStr);
      const idx = Number(iStr);

      const isDayDone = completedDaysSet.has(d);
      const isReadingDone = completedReadingsByDay[String(d)]?.includes(idx);
      const isChapterDone = completedChaptersByDay[String(d)]?.[idx]?.includes(chNum);

      if (!isDayDone && !isReadingDone && !isChapterDone) {
        isFullyComplete = false;
        break;
      }
    }

    if (isFullyComplete) {
      completedChapters++;
    }
  }

  return { totalChapters, completedChapters };
}