import type { Plan, Progress } from "../../types/domain";
import { clusterReadings } from "./chapterClustering";

export function countChapters(raw: string): number {
  return 1; 
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

  const readingsByBook = new Map<string, Array<{ day: number; index: number; rawChapters: string }>>();
  
  for (const entry of schedule) {
    if (!entry || !entry.readings) continue;
    const day = entry.day;
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
      // Determine if this instance is "active" in the current view (upToDay)
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
        // If all scheduled parts for this view are done, count as full relative to the schedule
        // But for "Completed", we want the weight sum (which is instScheduledWeight)
        // Or do we want '1' if it's a full chapter globally?
        // If upToDay is defined (Elapsed), and we finished the partial part scheduled, 
        // we should count what we finished (e.g. 0.2).
        // If we finished "All parts of the chapter" (globally), we want 1.
        // My previous logic was: if allScheduledDone -> += 1.
        // If scheduledRefs is partial (0.2), allScheduledDone is true if we did that 0.2.
        // If we count it as 1, we get "Completed: 1 / Goal: 0.2". Wrong.
        // We should count it as instScheduledWeight (0.2).
        
        // However, if it IS a full chapter (weight sum ~ 0.999), we want 1.
        // So: completedChapters += instScheduledWeight;
        // And then round at the end?
        // Let's stick to summing weights. It is safest.
        
        completedChapters += instScheduledWeight;
      } else {
        completedChapters += instProgress;
      }
    }
  }

  // Final rounding
  if (typeof upToDay === "undefined") {
      // Global view: Expect integers
      totalChapters = Math.round(totalChapters);
      completedChapters = Math.round(completedChapters * 100) / 100; // Allow 35.5 completed in global? Yes.
  } else {
      // Elapsed view: Allow decimals for partial goals
      totalChapters = Math.round(totalChapters * 100) / 100;
      completedChapters = Math.round(completedChapters * 100) / 100;
  }

  if (completedChapters > totalChapters) completedChapters = totalChapters;

  return { totalChapters, completedChapters };
}