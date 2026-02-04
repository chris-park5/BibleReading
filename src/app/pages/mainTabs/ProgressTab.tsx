import { useEffect, useMemo, useRef, useState } from "react";
import { usePlans, usePlan } from "../../../hooks/usePlans";
import { useProgress } from "../../../hooks/useProgress";
import { usePlanStore } from "../../../stores/plan.store";
import { ProgressChart } from "../../components/ProgressChart";
import { ReadingHistory } from "../../components/ReadingHistory";
import { TodayReading } from "../../components/TodayReading";
import { BibleProgressModal } from "../../components/BibleProgressModal";
import { BIBLE_BOOKS } from "../../data/bibleBooks";
import { computeTodayDay, startOfTodayLocal } from "./dateUtils";
import { computeChaptersTotals } from "../../utils/chaptersProgress";
import { clusterReadings } from "../../utils/chapterClustering";
import { Check } from "lucide-react";
import { bookMatchesQuery } from "../../utils/bookSearch";
import { expandChapters } from "../../utils/expandChapters";
import { AchievementReportModal } from "../../components/AchievementReportModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../components/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { getDailyStats } from "../../utils/api";

function formatChapterCount(val: number) {
  return parseFloat(val.toFixed(1));
}

export function ProgressTab() {
  const { plans } = usePlans();
  const activePlans = useMemo(
    () => plans.filter((p: any) => (p?.status ?? "active") === "active"),
    [plans]
  );
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { selectPlan } = usePlanStore();

  // 계획이 있으면 자동으로 첫 번째 계획 선택 (selectedPlanId가 없을 때)
  const activePlanId =
    (selectedPlanId && activePlans.some((p) => p.id === selectedPlanId) ? selectedPlanId : null) ||
    (activePlans.length > 0 ? activePlans[0].id : null);
  const plan = usePlan(activePlanId);
  const { progress, toggleReading } = useProgress(activePlanId);

  const { data: dailyStats } = useQuery({
    queryKey: ["dailyStats", activePlanId],
    queryFn: () => getDailyStats(activePlanId!).then(r => r.stats),
    enabled: !!activePlanId,
  });

  // NOTE:
  // - `todayDay` is computed from real calendar date + plan.startDate.
  // - `selectedHistoryDay` is what user is currently inspecting in this tab.
  // These two must be separated; otherwise "오늘" gets stuck on day 1 when store currentDay is reset.
  const today = startOfTodayLocal();
  const rawTodayDay = plan ? computeTodayDay(plan, today) : 1;
  const todayDay = plan ? Math.max(1, Math.min(plan.totalDays, rawTodayDay)) : 1;

  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number>(todayDay);
  const [isPinnedHistoryDay, setIsPinnedHistoryDay] = useState(false);
  const historyDetailRef = useRef<HTMLDivElement | null>(null);
  const [historyViewMode, setHistoryViewMode] = useState<"calendar" | "list">("calendar");
  const [showAchievementModal, setShowAchievementModal] = useState(false);

  useEffect(() => {
    // When plan changes, reset selection to currentDay.
    setSelectedHistoryDay(todayDay);
    setIsPinnedHistoryDay(false);
  }, [activePlanId, todayDay]);

  useEffect(() => {
    // If user hasn't clicked a day in this tab, keep selection synced.
    if (!isPinnedHistoryDay) setSelectedHistoryDay(todayDay);
  }, [todayDay, isPinnedHistoryDay]);

  // NOTE: Hooks must be called unconditionally.
  // Large plans can make plan/progress arrive a render later; keep hook order stable.
  const bookProgressRows = useMemo(() => {
    if (!plan || !progress) return [] as Array<{ book: string; completed: number; total: number; percent: number }>;

    const completedReadingsByDay = progress.completedReadingsByDay || {};
    const completedChaptersByDay = progress.completedChaptersByDay || {};
    const completedDaysSet = new Set(progress.completedDays || []);

    // 1. Gather readings by book
    const readingsByBook = new Map<string, Array<{ day: number; index: number; rawChapters: string }>>();
    for (const entry of plan.schedule) {
      const day = entry.day;
      const readings = entry.readings || [];
      for (let i = 0; i < readings.length; i++) {
        const r = readings[i];
        if (!r.book) continue;
        if (!readingsByBook.has(r.book)) {
          readingsByBook.set(r.book, []);
        }
        readingsByBook.get(r.book)!.push({ day, index: i, rawChapters: r.chapters });
      }
    }

    const rows: Array<{ book: string; completed: number; total: number; percent: number }> = [];

    // 2. Cluster and calculate stats per book
    for (const [book, items] of readingsByBook.entries()) {
      // Sort for clustering
      items.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.index - b.index;
      });

      const instances = clusterReadings(book, items);
      const bookTotal = instances.length;
      let bookCompleted = 0;

      for (const inst of instances) {
        let instProgress = 0;
        let allPartsDone = true;

        for (const ref of inst.readings) {
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
             allPartsDone = false;
           }
        }

        if (allPartsDone) {
          bookCompleted += 1;
        } else {
          bookCompleted += instProgress;
        }
      }

      // Round to avoid float errors
      bookCompleted = Math.round(bookCompleted * 100) / 100;

      const percent = bookTotal <= 0 ? 0 : Math.round((bookCompleted / bookTotal) * 100);
      rows.push({ book, completed: bookCompleted, total: bookTotal, percent });
    }

    const canonicalOrder = new Map<string, number>();
    BIBLE_BOOKS.forEach((b, idx) => canonicalOrder.set(b.name, idx));

    return rows.sort((a, b) => (canonicalOrder.get(a.book) ?? 999) - (canonicalOrder.get(b.book) ?? 999));
  }, [plan, progress]);

  if (!activePlanId || !plan || !progress) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <h2 className="text-xl font-bold">내 계획</h2>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6 text-center">
          <p>내 계획을 보려면 계획을 선택해주세요.</p>
          <p className="text-muted-foreground text-sm mt-1">계획 추가 탭에서 계획을 추가할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const elapsedDays = Math.max(0, Math.min(plan.totalDays, rawTodayDay));
  const { totalChapters, completedChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
  const { totalChapters: elapsedChapters } = computeChaptersTotals({
    schedule: plan.schedule,
    progress,
    upToDay: elapsedDays,
  });
  const completionRateElapsed = elapsedChapters === 0 ? 0 : Math.round((completedChapters / elapsedChapters) * 100);

  const completionMessage =
    completionRateElapsed >= 100
      ? "완료했습니다. 정말 잘하셨어요!"
      : completionRateElapsed >= 75
        ? "거의 다 왔어요. 꾸준함이 승리합니다."
        : completionRateElapsed >= 50
          ? "좋은 흐름이에요. 계속 이어가요."
          : completionRateElapsed >= 25
            ? "시작이 반이에요. 오늘도 한 걸음!"
            : "지금부터 시작해도 괜찮아요. 오늘 한 항목부터!";

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header with Plan Selection */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold whitespace-nowrap">진행률</h2>
          {activePlans.length > 0 && (
            <div className="flex-1 max-w-[200px]">
              <Select
                value={activePlanId ?? undefined}
                onValueChange={selectPlan}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="계획 선택" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 space-y-8">
          <button 
            type="button"
            onClick={() => setShowAchievementModal(true)}
            className="w-full text-left bg-card text-card-foreground border border-border/50 shadow-sm rounded-[32px] px-7 py-6 transition-all active:scale-[0.99] hover:bg-accent/40"
          >
            <p className="text-sm text-muted-foreground">달성률</p>
            <p className="text-2xl font-semibold">{completionRateElapsed}%</p>
            <p className="text-sm text-muted-foreground mt-1">
              오늘까지 {formatChapterCount(elapsedChapters)}장 중 {formatChapterCount(completedChapters)}장 완료
            </p>
            <p className="text-muted-foreground mt-1">{completionMessage}</p>
          </button>

        {showAchievementModal && (
          <AchievementReportModal 
            plan={plan} 
            progress={progress} 
            dailyStats={dailyStats ?? []}
            open={showAchievementModal}
            onClose={() => setShowAchievementModal(false)} 
          />
        )}

        <BibleProgressModal bookProgressRows={bookProgressRows}>
          <button type="button" className="w-full text-left">
            <ProgressChart 
              totalChapters={totalChapters} 
              completedChapters={completedChapters} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
            />
          </button>
        </BibleProgressModal>

        {/* Reading History Section Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">읽기 기록</h2>
        </div>

        <div className="bg-card text-card-foreground border-none shadow-sm rounded-xl p-4 space-y-4">
          <ReadingHistory
            schedule={plan.schedule}
            completedDays={(() => {
              const completed = new Set<number>();
              const completedReadingsByDay = progress.completedReadingsByDay || {};
              const completedDaysSet = new Set(progress.completedDays || []);

              for (let day = 1; day <= plan.totalDays; day++) {
                const reading = plan.schedule.find((s) => s.day === day);
                if (!reading) continue;

                const totalReadings = reading.readings.length;
                if (totalReadings <= 0) continue;

                if (completedDaysSet.has(day)) {
                  completed.add(day);
                  continue;
                }

                const completedIndices = completedReadingsByDay[String(day)] || [];
                const completedCount = completedIndices.length;
                if (completedCount === totalReadings) completed.add(day);
              }

              return completed;
            })()}
            partialDays={(() => {
              const partial = new Set<number>();
              const completedReadingsByDay = progress.completedReadingsByDay || {};
              const completedChaptersByDay = progress.completedChaptersByDay || {};
              const completedDaysSet = new Set(progress.completedDays || []);

              // Iterate directly over schedule to find days with readings
              for (const entry of plan.schedule) {
                const day = entry.day;
                // If the day is already marked as fully complete, skip
                if (completedDaysSet.has(day)) continue;

                const readings = entry.readings || [];
                const totalReadings = readings.length;
                if (totalReadings === 0) continue;

                // 1. Check if any FULL readings are done
                const completedIndices = completedReadingsByDay[String(day)] || [];
                const completedCount = completedIndices.length;
                
                // If any reading is fully done (even if not all), it's partial
                if (completedCount > 0) {
                  partial.add(day);
                  continue;
                }

                // 2. Check if any CHAPTERS are done (when no readings are fully done)
                const dayKey = String(day);
                const dayChaptersMap = completedChaptersByDay[dayKey];
                // Defensive check for numeric keys
                const dayChaptersMapAlt = (completedChaptersByDay as any)[day];
                const mapToCheck = dayChaptersMap || dayChaptersMapAlt;

                if (mapToCheck) {
                  const hasAnyChapter = Object.values(mapToCheck).some(
                    (chapters) => Array.isArray(chapters) && chapters.length > 0
                  );
                  if (hasAnyChapter) {
                    partial.add(day);
                  }
                }
              }

              return partial;
            })()}
            // "오늘" 표시(하이라이트)는 실제 오늘 날짜 기준 day를 사용합니다.
            currentDay={todayDay}
            selectedDay={selectedHistoryDay}
            onViewChange={setHistoryViewMode}
            onDayClick={(day) => {
              setSelectedHistoryDay(day);
              setIsPinnedHistoryDay(true);
              // Scroll to the details
              setTimeout(() => {
                historyDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
            renderDayDetails={(day, query) => {
              const entry = plan.schedule.find((s) => s.day === day);
              const allReadings = entry?.readings ?? [];
              
              const isDayCompleted = progress.completedDays.includes(day);
              const completedIndices = progress.completedReadingsByDay?.[String(day)] ?? [];
              const completedSet = new Set(completedIndices);
              const dayChaptersMap = progress.completedChaptersByDay?.[String(day)] ?? {};

              // Map readings to include original index
              const allReadingsWithIndex = allReadings.map((r, i) => ({ ...r, originalIndex: i }));
              
              // Filter if query is present
              const filteredReadingsWithIndex = query 
                ? allReadingsWithIndex.filter(r => bookMatchesQuery(String(r.book), query)) 
                : allReadingsWithIndex;

              if (filteredReadingsWithIndex.length === 0) {
                return (
                  <div className="bg-card text-card-foreground border border-border rounded-xl p-4 text-sm text-muted-foreground text-center">
                    선택한 날짜({day}일차)에 해당하는 읽기 항목이 없습니다.
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-4 py-2">
                  {filteredReadingsWithIndex.map((reading) => {
                    const expandedChapters = expandChapters(reading.chapters);
                    const originalIndex = reading.originalIndex;
                    const chaptersCount = expandedChapters.length;
                    
                    // Determine current status
                    const isReadingCompleted = isDayCompleted || completedSet.has(originalIndex);
                    const currentCompletedChapters = isReadingCompleted 
                      ? expandedChapters 
                      : (dayChaptersMap[originalIndex] || []);
                    
                    const completedChaptersSet = new Set(currentCompletedChapters);

                    return (
                      <div key={`${day}-${originalIndex}`} className="space-y-2">
                        {filteredReadingsWithIndex.length > 1 && (
                          <div className="text-sm font-medium text-muted-foreground">
                            {reading.book} {reading.chapters}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {expandedChapters.map((chapter) => {
                            const isChecked = completedChaptersSet.has(chapter);
                            
                            return (
                              <button
                                key={chapter}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextSet = new Set<string>(completedChaptersSet);
                                  if (nextSet.has(chapter)) {
                                    nextSet.delete(chapter);
                                  } else {
                                    nextSet.add(chapter);
                                  }
                                  
                                  const nextChapters = Array.from(nextSet);
                                  const isNowFullyComplete = expandedChapters.length > 0 && expandedChapters.every(c => nextSet.has(c));
                                  const dayTotalReadings = allReadings.length;

                                  toggleReading({
                                    day,
                                    readingIndex: originalIndex,
                                    completed: isNowFullyComplete,
                                    chapterCount: chaptersCount,
                                    dayTotalReadings,
                                    completedChapters: nextChapters
                                  });
                                }}
                                className={cn(
                                  "flex items-center justify-center w-10 h-10 rounded-md text-sm font-medium border transition-all",
                                  isChecked 
                                    ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400" 
                                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                {isChecked && <Check className="w-3 h-3 mr-0.5 stroke-[3]" />}
                                {chapter}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
            startDate={plan.startDate}
            totalDays={plan.totalDays}
            // Remove border and shadow from inner component
            className="border-none shadow-none p-0 bg-transparent"
            hideHeader={true}
          />
        </div>

          {/* Bottom Details Section for Calendar View */}
          {historyViewMode === "calendar" && (
            <div ref={historyDetailRef} className="mt-4">
              {(() => {
                const day = selectedHistoryDay;
                const entry = plan.schedule.find((s) => s.day === day);
                const readings = entry?.readings ?? [];

                const isDayCompleted = progress.completedDays.includes(day);
                const completedIndices = progress.completedReadingsByDay?.[String(day)] ?? [];
                const completedSet = new Set(completedIndices);
                const dayChaptersMap = progress.completedChaptersByDay?.[String(day)] ?? {};

                const completedByIndex = readings.map((_, i) => isDayCompleted || completedSet.has(i));
                const completedChaptersByIndex = readings.map((_, i) => dayChaptersMap[i] ?? []);

                if (readings.length === 0) return null;

                return (
                  <TodayReading
                    day={day}
                    readings={readings}
                    completedByIndex={completedByIndex}
                    completedChaptersByIndex={completedChaptersByIndex}
                    subtitle={`${day}일차 전체 보기`}
                                        onToggleReading={(readingIndex, completed, completedChapters) => {
                                          const reading = readings[readingIndex];
                                          const expanded = expandChapters(reading.chapters);
                                          const chaptersCount = expanded.length;
                                          const dayTotalReadings = readings.length;
                                          
                                          toggleReading({
                                            day,
                                            readingIndex,
                                            completed,
                                            chapterCount: chaptersCount,
                                            dayTotalReadings,
                                            completedChapters,
                                          });
                                        }}
                  />
                );
              })()}
            </div>
          )}
      </div>
    </div>
  );
}