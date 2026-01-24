import { useEffect, useMemo, useState } from "react";
import { usePlans, usePlan } from "../../../../hooks/usePlans";
import { useProgress } from "../../../../hooks/useProgress";
import { ReadingHistory } from "../../../components/ReadingHistory";
import { computeTodayDay, startOfTodayLocal } from "../dateUtils";
import { bookMatchesQuery } from "../../../utils/bookSearch";
import { expandChapters } from "../../../utils/expandChapters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { BookOpen, Check } from "lucide-react";
import { cn } from "../../../components/ui/utils";

export function ReadingHistorySection() {
  const { plans } = usePlans();
  
  // Local state for the plan selected in this section
  const [historyPlanId, setHistoryPlanId] = useState<string | null>(null);

  // Default to the first plan if none selected
  useEffect(() => {
    if (!historyPlanId && plans.length > 0) {
      setHistoryPlanId(plans[0].id);
    }
  }, [plans, historyPlanId]);

  const plan = usePlan(historyPlanId);
  const { progress, toggleReading } = useProgress(historyPlanId);

  const today = useMemo(() => startOfTodayLocal(), []);
  const rawTodayDay = plan ? computeTodayDay(plan, today) : 1;
  const todayDay = plan ? Math.max(1, Math.min(plan.totalDays, rawTodayDay)) : 1;

  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number>(todayDay);

  useEffect(() => {
    // When plan changes, reset selection.
    // We don't necessarily want to reset to todayDay if we're in search mode, 
    // but without calendar, todayDay is just a default index.
    setSelectedHistoryDay(todayDay);
  }, [historyPlanId, todayDay]);

  // Compute completed/partial days
  const { completedDays, partialDays } = useMemo(() => {
    if (!plan || !progress) return { completedDays: new Set<number>(), partialDays: new Set<number>() };

    const completed = new Set<number>();
    const partial = new Set<number>();
    const completedReadingsByDay = progress.completedReadingsByDay || {};
    const completedChaptersByDay = progress.completedChaptersByDay || {};
    const completedDaysSet = new Set(progress.completedDays || []);

    for (let day = 1; day <= plan.totalDays; day++) {
      if (completedDaysSet.has(day)) {
        completed.add(day);
        continue;
      }

      const reading = plan.schedule.find((s) => s.day === day);
      if (!reading) continue;

      const totalReadings = reading.readings.length;
      if (totalReadings <= 0) continue;

      const completedIndices = completedReadingsByDay[String(day)] || [];
      const completedCount = completedIndices.length;

      if (completedCount === totalReadings) {
        completed.add(day);
      } else if (completedCount > 0) {
        partial.add(day);
      } else {
        // Check if any chapters are completed
        const dayChaptersMap = completedChaptersByDay[String(day)];
        if (dayChaptersMap) {
          const hasAnyChapter = Object.values(dayChaptersMap).some(
            (chapters) => Array.isArray(chapters) && chapters.length > 0
          );
          if (hasAnyChapter) {
            partial.add(day);
          }
        }
      }
    }

    return { completedDays: completed, partialDays: partial };
  }, [plan, progress]);

  if (!plans.length) return null;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">성경별 읽기</h2>
        </div>
        {plans.length > 0 && (
          <div className="w-40">
            <Select
              value={historyPlanId ?? undefined}
              onValueChange={setHistoryPlanId}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="계획 선택" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!plan || !progress ? (
        <div className="p-4 bg-muted/20 rounded-xl text-center text-sm text-muted-foreground">
          계획을 선택해주세요.
        </div>
      ) : (
        <>
            <ReadingHistory
              completedDays={completedDays}
              partialDays={partialDays}
              currentDay={todayDay}
              selectedDay={selectedHistoryDay}
              onDayClick={(day) => {
                setSelectedHistoryDay(day);
              }}
              renderDayDetails={(day, query) => {
                const entry = plan.schedule.find((s) => s.day === day);
                const allReadings = entry?.readings ?? [];
                const readingCount = allReadings.length;

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

                                    toggleReading({
                                      day,
                                      readingIndex: originalIndex,
                                      completed: isNowFullyComplete,
                                      readingCount,
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
              schedule={plan.schedule}
              hideSearch={false}
              hideCalendar={true}
              hideHeader={true}
            />
        </>
      )}
    </div>
  );
}
