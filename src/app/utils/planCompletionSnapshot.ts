import type { Plan, Progress } from "../../types/domain";
import { computeChaptersTotals } from "./chaptersProgress";
import { BIBLE_BOOKS } from "../data/bibleBooks";

export function computeCompletionBadgesFromSchedule(schedule: Plan["schedule"]): string[] {
  const booksInPlan = new Set<string>();
  for (const day of schedule || []) {
    for (const r of day.readings || []) {
      if (r?.book) booksInPlan.add(r.book);
    }
  }

  const allBooks = BIBLE_BOOKS.map((b) => b.name);
  const otBooks = allBooks.slice(0, 39);
  const ntBooks = allBooks.slice(39);

  const coversAll = (names: string[]) => names.every((n) => booksInPlan.has(n));

  const badges: string[] = [];
  if (coversAll(allBooks)) badges.push("성경 완독 성공!");
  else {
    if (coversAll(ntBooks)) badges.push("신약 완독 성공!");
    if (coversAll(otBooks)) badges.push("구약 완독 성공!");
  }

  badges.push("계획 완주");
  return Array.from(new Set(badges));
}

export function buildCompletionSnapshot(plan: Plan, progress: Progress): NonNullable<Plan["completionSnapshot"]> {
  const { totalChapters, completedChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
  return {
    totalDays: plan.totalDays,
    totalChapters,
    completedChapters,
    badges: computeCompletionBadgesFromSchedule(plan.schedule),
  };
}
