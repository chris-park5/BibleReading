import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Search } from "lucide-react";

import type { Plan, Progress } from "../../../../types/domain";
import { BIBLE_BOOKS, getBookChapters, getBookIndex, matchesBookSearch } from "../../../data/bibleBooks";
import { expandChapters } from "../../../utils/expandChapters";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Checkbox } from "../../../components/ui/checkbox";
import { cn } from "../../../components/ui/utils";

type UpdateVars = {
  planId: string;
  day: number;
  readingIndex: number;
  completed: boolean;
  readingCount: number;
  totalReadingsCount: number;
  completedChapters?: string[];
};

type Props = {
  plans: Plan[];
  progressByPlanId: Map<string, Progress | null>;
  applyUpdates: (updates: UpdateVars[]) => void;
};

type Testament = "old" | "new";
function getTestament(bookName: string): Testament {
  const idx = getBookIndex(bookName);
  if (idx >= 39) return "new";
  return "old";
}

function uniqueStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.map(String)));
}

function sortChaptersNumeric(chapters: string[]): string[] {
  return [...chapters].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export function BibleReadingByBook({ plans, progressByPlanId, applyUpdates }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<Testament>("old");
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  const PLAN_FILTER_ALL = "__all__";
  const [planFilterId, setPlanFilterId] = useState<string>(() => {
    if (typeof window === "undefined") return PLAN_FILTER_ALL;
    return window.localStorage.getItem("bible-plan-filter") ?? PLAN_FILTER_ALL;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("bible-plan-filter", planFilterId);
  }, [planFilterId]);

  const availablePlans = useMemo(() => {
    return plans.filter((p) => p && !p.id.startsWith("optimistic-"));
  }, [plans]);

  useEffect(() => {
    if (planFilterId === PLAN_FILTER_ALL) return;
    const exists = availablePlans.some((p) => p.id === planFilterId);
    if (!exists) setPlanFilterId(PLAN_FILTER_ALL);
  }, [availablePlans, planFilterId]);

  const plansInScope = useMemo(() => {
    if (planFilterId === PLAN_FILTER_ALL) return availablePlans;
    return availablePlans.filter((p) => p.id === planFilterId);
  }, [availablePlans, planFilterId]);

  // Simple cooldown to avoid firing multiple network mutations from accidental rapid taps.
  // Keeps UI responsive because optimistic updates still happen immediately.
  const lastChapterTapAtRef = useRef(new Map<string, number>());

  const isProgressLoading = useMemo(() => {
    // Note: progress can be null either because it hasn't loaded yet, or because
    // the plan has no progress row. In practice, we treat null as "not ready".
    return plansInScope.some((p) => progressByPlanId.get(p.id) == null);
  }, [plansInScope, progressByPlanId]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = BIBLE_BOOKS.filter((b) => (tab === "old" ? getTestament(b.name) === "old" : getTestament(b.name) === "new"));
    if (!q) return base;
    return base.filter((b) => matchesBookSearch(b.name, q));
  }, [searchQuery, tab]);

  useEffect(() => {
    if (!expandedBook) return;
    const stillVisible = filteredBooks.some((b) => b.name === expandedBook);
    if (!stillVisible) setExpandedBook(null);
  }, [expandedBook, filteredBooks]);

  const selectedBook = expandedBook ?? "";

  const selectedBookChapters = useMemo(() => {
    const total = getBookChapters(selectedBook);
    return Array.from({ length: total }, (_, i) => String(i + 1));
  }, [selectedBook]);

  const selectedBookOccurrences = useMemo(() => {
    type Occurrence = {
      planId: string;
      planName: string;
      day: number;
      readingIndex: number;
      allChapters: string[];
      readingCount: number;
      totalReadingsCount: number;
      effectiveSet: Set<string>;
    };

    const byChapter = new Map<string, Occurrence[]>();
    const byItemKey = new Map<string, Occurrence>();
    const planNames = new Set<string>();

    for (const plan of plansInScope) {
      if (!plan?.schedule) continue;

      const progress = progressByPlanId.get(plan.id) ?? null;

      for (const entry of plan.schedule) {
        const day = entry.day;
        const dayKey = String(day);
        const totalReadingsCount = entry.readings?.length ?? 0;
        if (!entry.readings || totalReadingsCount === 0) continue;

        const isDayCompleted = progress?.completedDays?.includes(day) ?? false;
        const completedReadings = progress?.completedReadingsByDay?.[dayKey] ?? [];
        const completedChaptersByDay = progress?.completedChaptersByDay?.[dayKey] ?? {};

        for (let readingIndex = 0; readingIndex < entry.readings.length; readingIndex++) {
          const r: any = entry.readings[readingIndex];
          if (!r || r.book !== selectedBook) continue;

          planNames.add(plan.name);

          const allChapters = uniqueStrings(expandChapters(r.chapters));
          const raw = r?.chapter_count;
          const parsed = raw === null || raw === undefined ? NaN : Number(raw);
          const readingCount = Number.isFinite(parsed) ? parsed : allChapters.length;

          const isReadingCompleted = isDayCompleted || completedReadings.includes(readingIndex);
          const storedCompleted = completedChaptersByDay[readingIndex] ?? [];
          const effective = isReadingCompleted ? allChapters : storedCompleted;
          const effectiveSet = new Set<string>(effective.map(String));

          const itemKey = `${plan.id}:${day}:${readingIndex}`;
          const baseOcc: Occurrence = {
            planId: plan.id,
            planName: plan.name,
            day,
            readingIndex,
            allChapters,
            readingCount,
            totalReadingsCount,
            effectiveSet,
          };

          byItemKey.set(itemKey, baseOcc);

          for (const ch of allChapters) {
            const key = String(ch);
            const arr = byChapter.get(key) ?? [];
            arr.push(baseOcc);
            byChapter.set(key, arr);
          }
        }
      }
    }

    return {
      byChapter,
      items: Array.from(byItemKey.values()),
      planNames: Array.from(planNames),
    };
  }, [plansInScope, progressByPlanId, selectedBook]);

  const chapterStats = useMemo(() => {
    const totalByChapter = new Map<string, number>();
    const completedByChapter = new Map<string, number>();

    for (const ch of selectedBookChapters) {
      const occs = selectedBookOccurrences.byChapter.get(ch) ?? [];
      totalByChapter.set(ch, occs.length);
      completedByChapter.set(
        ch,
        occs.reduce((acc, occ) => (occ.effectiveSet.has(ch) ? acc + 1 : acc), 0),
      );
    }

    return {
      totalByChapter,
      completedByChapter,
    };
  }, [selectedBookChapters, selectedBookOccurrences]);

  function sortOccurrences<T extends { planId: string; day: number; readingIndex: number }>(occs: T[]): T[] {
    return [...occs].sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      if (a.day !== b.day) return a.day - b.day;
      return a.readingIndex - b.readingIndex;
    });
  }

  const handleToggleChapter = (chapter: string) => {
    // Cooldown per-book+chapter
    const now = Date.now();
    const tapKey = `${selectedBook}:${chapter}`;
    const prev = lastChapterTapAtRef.current.get(tapKey) ?? 0;
    if (now - prev < 250) return;
    lastChapterTapAtRef.current.set(tapKey, now);

    const total = chapterStats.totalByChapter.get(chapter) ?? 0;
    if (total <= 0) return;

    const done = chapterStats.completedByChapter.get(chapter) ?? 0;
    const isFullyDone = done >= total;
    const shouldMarkOneMore = !isFullyDone;

    const occsRaw = selectedBookOccurrences.byChapter.get(chapter) ?? [];
    const occs = sortOccurrences(occsRaw);

    // IMPORTANT: completion in this view means "required times for this chapter".
    // - While not fully done, we increment ONE occurrence per tap.
    // - Once fully done, the next tap cycles back to 0 by clearing this chapter from ALL occurrences.

    if (shouldMarkOneMore) {
      const target = occs.find((occ) => !occ.effectiveSet.has(chapter));
      if (!target) return;

      const currentSet = new Set<string>(target.effectiveSet);
      currentSet.add(chapter);

      const isNowFullyComplete = target.allChapters.length > 0 && target.allChapters.every((c) => currentSet.has(c));
      const nextCompletedChapters = sortChaptersNumeric(Array.from(currentSet));

      applyUpdates([
        {
          planId: target.planId,
          day: target.day,
          readingIndex: target.readingIndex,
          completed: isNowFullyComplete,
          readingCount: target.readingCount,
          totalReadingsCount: target.totalReadingsCount,
          completedChapters: isNowFullyComplete ? target.allChapters : nextCompletedChapters,
        },
      ]);
      return;
    }

    const updates: UpdateVars[] = [];
    for (const occ of occs) {
      if (!occ.effectiveSet.has(chapter)) continue;

      const currentSet = new Set<string>(occ.effectiveSet);
      currentSet.delete(chapter);

      const isNowFullyComplete = occ.allChapters.length > 0 && occ.allChapters.every((c) => currentSet.has(c));
      const nextCompletedChapters = sortChaptersNumeric(Array.from(currentSet));

      updates.push({
        planId: occ.planId,
        day: occ.day,
        readingIndex: occ.readingIndex,
        completed: isNowFullyComplete,
        readingCount: occ.readingCount,
        totalReadingsCount: occ.totalReadingsCount,
        completedChapters: isNowFullyComplete ? occ.allChapters : nextCompletedChapters,
      });
    }

    if (updates.length === 0) return;
    updates.sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      if (a.day !== b.day) return a.day - b.day;
      return a.readingIndex - b.readingIndex;
    });
    applyUpdates(updates);
  };

  const handleMarkAllInBook = () => {
    if (!selectedBook) return;
    if (isProgressLoading) return;

    const updates: UpdateVars[] = [];
    for (const occ of selectedBookOccurrences.items) {
      // If not fully completed, mark the entire reading item as completed.
      const isFully = occ.allChapters.length > 0 && occ.allChapters.every((c) => occ.effectiveSet.has(c));
      if (isFully) continue;

      updates.push({
        planId: occ.planId,
        day: occ.day,
        readingIndex: occ.readingIndex,
        completed: true,
        readingCount: occ.readingCount,
        totalReadingsCount: occ.totalReadingsCount,
        completedChapters: occ.allChapters,
      });
    }

    if (updates.length === 0) return;

    updates.sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      if (a.day !== b.day) return a.day - b.day;
      return a.readingIndex - b.readingIndex;
    });

    applyUpdates(updates);
  };

  const handleClearAllInBook = () => {
    if (!selectedBook) return;
    if (isProgressLoading) return;

    const updates: UpdateVars[] = [];
    for (const occ of selectedBookOccurrences.items) {
      // Clear any completion state for this reading item.
      const hasAny = occ.effectiveSet.size > 0;
      if (!hasAny) continue;

      updates.push({
        planId: occ.planId,
        day: occ.day,
        readingIndex: occ.readingIndex,
        completed: false,
        readingCount: occ.readingCount,
        totalReadingsCount: occ.totalReadingsCount,
        completedChapters: [],
      });
    }

    if (updates.length === 0) return;

    updates.sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      if (a.day !== b.day) return a.day - b.day;
      return a.readingIndex - b.readingIndex;
    });

    applyUpdates(updates);
  };

  const selectedSummary = useMemo(() => {
    const totalSched = selectedBookChapters.reduce((acc, ch) => acc + ((chapterStats.totalByChapter.get(ch) ?? 0) > 0 ? 1 : 0), 0);
    const totalDone = selectedBookChapters.reduce((acc, ch) => {
      const total = chapterStats.totalByChapter.get(ch) ?? 0;
      const done = chapterStats.completedByChapter.get(ch) ?? 0;
      return acc + (total > 0 && done >= total ? 1 : 0);
    }, 0);
    return { totalSched, totalDone };
  }, [selectedBookChapters, chapterStats]);

  const bookToggleState = useMemo(() => {
    const hasAnySchedule = selectedBookOccurrences.items.length > 0;
    const allDone = hasAnySchedule && selectedSummary.totalSched > 0 && selectedSummary.totalDone >= selectedSummary.totalSched;
    const anyDone = hasAnySchedule && selectedSummary.totalDone > 0;
    return {
      hasAnySchedule,
      allDone,
      anyDone,
      checked: allDone ? true : anyDone ? ("indeterminate" as const) : false,
    };
  }, [selectedBookOccurrences.items.length, selectedSummary.totalDone, selectedSummary.totalSched]);

  return (
    <div className="bg-card text-card-foreground rounded-[28px] border-none shadow-sm p-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-primary/10 rounded-[18px]">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">성경별 읽기</h2>
          </div>
        </div>

        {availablePlans.length > 0 ? (
          <div className="w-full sm:w-44 sm:shrink-0">
            <Select value={planFilterId} onValueChange={setPlanFilterId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="계획 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PLAN_FILTER_ALL}>전체</SelectItem>
                {availablePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="성경 검색 (예: 히브리서, 히)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Testament)} className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="old">구약</TabsTrigger>
          <TabsTrigger value="new">신약</TabsTrigger>
        </TabsList>

        <TabsContent value="old" className="mt-0">
          <div className="space-y-2">
            {filteredBooks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                검색 결과가 없습니다.
              </div>
            ) : (
              filteredBooks.map((b) => {
                const isExpanded = expandedBook === b.name;
                return (
                  <div key={b.name} className="rounded-[26px] border border-border/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBook((prev) => (prev === b.name ? null : b.name));
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
                        isExpanded ? "bg-muted/30" : "bg-card hover:bg-muted/20",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-base font-normal truncate">{b.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="px-5 pb-5 pt-3 bg-background">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-base font-normal">{b.name}</div>
                          {!isProgressLoading ? (
                            <div className="text-sm text-muted-foreground font-medium">
                              {`${selectedSummary.totalDone}/${selectedSummary.totalSched}`}
                            </div>
                          ) : null}
                        </div>

                        <div className="mb-4 flex items-center justify-between gap-3">
                          <label className={cn(
                            "flex items-center gap-2 select-none",
                            (isProgressLoading || !bookToggleState.hasAnySchedule) && "opacity-40 cursor-not-allowed",
                          )}>
                            <Checkbox
                              checked={bookToggleState.checked}
                              disabled={isProgressLoading || !bookToggleState.hasAnySchedule}
                              onCheckedChange={(v) => {
                                if (isProgressLoading || !bookToggleState.hasAnySchedule) return;
                                if (v === true) handleMarkAllInBook();
                                else handleClearAllInBook();
                              }}
                              aria-label="전체 읽기 체크박스"
                            />
                            <span className="text-sm font-semibold text-muted-foreground">전체</span>
                          </label>
                          <div className="text-sm text-muted-foreground font-medium">{`${selectedSummary.totalDone}/${selectedSummary.totalSched}`}</div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          {selectedBookChapters.map((ch) => {
                            const total = chapterStats.totalByChapter.get(ch) ?? 0;
                            const done = chapterStats.completedByChapter.get(ch) ?? 0;
                            const isScheduled = total > 0;
                            const isDone = isScheduled && done >= total;
                            const isPartial = isScheduled && !isDone && done > 0;

                            const dotTotal = total;
                            const dotDone = Math.min(done, total);

                            return (
                              <div key={ch} className="flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!isScheduled}
                                  onClick={() => handleToggleChapter(ch)}
                                  className={cn(
                                    "relative h-14 w-full rounded-[16px] border text-sm font-semibold transition-colors flex items-center justify-center leading-none",
                                    !isScheduled && "opacity-40 cursor-not-allowed border-dashed",
                                    isScheduled && !isDone && !isPartial && "bg-muted/30 hover:bg-muted/60 border-border text-muted-foreground",
                                    isPartial && "bg-yellow-50 border-yellow-200 text-yellow-800",
                                    isDone && "bg-emerald-50 border-emerald-200 text-emerald-800",
                                  )}
                                  title={!isScheduled ? "현재 계획에 없음" : `${b.name} ${ch}장 (${done}/${total})`}
                                >
                                  <span>{ch}</span>
                                </button>

                                {isScheduled && dotTotal > 1 ? (
                                  <span className="flex items-center justify-center gap-0.5" aria-label={`읽은 횟수 ${dotDone}/${dotTotal}`}>
                                    {Array.from({ length: dotTotal }, (_, i) => {
                                      const filled = i < dotDone;
                                      return (
                                        <span
                                          key={i}
                                          className={cn(
                                            "h-1 w-1 rounded-full",
                                            filled && isDone && "bg-emerald-500/60",
                                            filled && isPartial && "bg-yellow-500/60",
                                            filled && !isDone && !isPartial && "bg-muted-foreground/60",
                                            !filled && "bg-muted-foreground/20",
                                          )}
                                        />
                                      );
                                    })}
                                  </span>
                                ) : (
                                  <span className="h-1" aria-hidden="true" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="new" className="mt-0">
          <div className="space-y-2">
            {filteredBooks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                검색 결과가 없습니다.
              </div>
            ) : (
              filteredBooks.map((b) => {
                const isExpanded = expandedBook === b.name;
                return (
                  <div key={b.name} className="rounded-[26px] border border-border/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBook((prev) => (prev === b.name ? null : b.name));
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
                        isExpanded ? "bg-muted/30" : "bg-card hover:bg-muted/20",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-base font-normal truncate">{b.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="px-5 pb-5 pt-3 bg-background">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-base font-normal">{b.name}</div>
                          {!isProgressLoading ? (
                            <div className="text-sm text-muted-foreground font-medium">
                              {`${selectedSummary.totalDone}/${selectedSummary.totalSched}`}
                            </div>
                          ) : null}
                        </div>

                        <div className="mb-4 flex items-center justify-between gap-3">
                          <label className={cn(
                            "flex items-center gap-2 select-none",
                            (isProgressLoading || !bookToggleState.hasAnySchedule) && "opacity-40 cursor-not-allowed",
                          )}>
                            <Checkbox
                              checked={bookToggleState.checked}
                              disabled={isProgressLoading || !bookToggleState.hasAnySchedule}
                              onCheckedChange={(v) => {
                                if (isProgressLoading || !bookToggleState.hasAnySchedule) return;
                                if (v === true) handleMarkAllInBook();
                                else handleClearAllInBook();
                              }}
                              aria-label="전체 읽기 체크박스"
                            />
                            <span className="text-sm font-semibold text-muted-foreground">전체</span>
                          </label>
                          <div className="text-sm text-muted-foreground font-medium">{`${selectedSummary.totalDone}/${selectedSummary.totalSched}`}</div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          {selectedBookChapters.map((ch) => {
                            const total = chapterStats.totalByChapter.get(ch) ?? 0;
                            const done = chapterStats.completedByChapter.get(ch) ?? 0;
                            const isScheduled = total > 0;
                            const isDone = isScheduled && done >= total;
                            const isPartial = isScheduled && !isDone && done > 0;

                            const dotTotal = total;
                            const dotDone = Math.min(done, total);

                            return (
                              <div key={ch} className="flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!isScheduled}
                                  onClick={() => handleToggleChapter(ch)}
                                  className={cn(
                                    "relative h-14 w-full rounded-[16px] border text-sm font-semibold transition-colors flex items-center justify-center leading-none",
                                    !isScheduled && "opacity-40 cursor-not-allowed border-dashed",
                                    isScheduled && !isDone && !isPartial && "bg-muted/30 hover:bg-muted/60 border-border text-muted-foreground",
                                    isPartial && "bg-yellow-50 border-yellow-200 text-yellow-800",
                                    isDone && "bg-emerald-50 border-emerald-200 text-emerald-800",
                                  )}
                                  title={!isScheduled ? "현재 계획에 없음" : `${b.name} ${ch}장 (${done}/${total})`}
                                >
                                  <span>{ch}</span>
                                </button>

                                {isScheduled && dotTotal > 1 ? (
                                  <span className="flex items-center justify-center gap-0.5" aria-label={`읽은 횟수 ${dotDone}/${dotTotal}`}>
                                    {Array.from({ length: dotTotal }, (_, i) => {
                                      const filled = i < dotDone;
                                      return (
                                        <span
                                          key={i}
                                          className={cn(
                                            "h-1 w-1 rounded-full",
                                            filled && isDone && "bg-emerald-500/60",
                                            filled && isPartial && "bg-yellow-500/60",
                                            filled && !isDone && !isPartial && "bg-muted-foreground/60",
                                            !filled && "bg-muted-foreground/20",
                                          )}
                                        />
                                      );
                                    })}
                                  </span>
                                ) : (
                                  <span className="h-1" aria-hidden="true" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {isProgressLoading ? (
        <div className="mt-4 text-xs text-muted-foreground">
          일부 계획의 진도를 불러오는 중입니다. (성경별 표시가 잠시 부정확할 수 있어요)
        </div>
      ) : null}
    </div>
  );
}
