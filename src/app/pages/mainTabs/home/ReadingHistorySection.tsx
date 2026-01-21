import { useEffect, useMemo, useRef, useState } from "react";
import { usePlans, usePlan } from "../../../../hooks/usePlans";
import { useProgress } from "../../../../hooks/useProgress";
import { ReadingHistory } from "../../../components/ReadingHistory";
import { TodayReading } from "../../../components/TodayReading";
import { computeTodayDay, startOfTodayLocal } from "../dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { BookOpen } from "lucide-react";

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
  const [isPinnedHistoryDay, setIsPinnedHistoryDay] = useState(false);
  const historyDetailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // When plan changes, reset selection.
    // We don't necessarily want to reset to todayDay if we're in search mode, 
    // but without calendar, todayDay is just a default index.
    setSelectedHistoryDay(todayDay);
    setIsPinnedHistoryDay(false);
  }, [historyPlanId, todayDay]);

  // Compute completed/partial days
  const { completedDays, partialDays } = useMemo(() => {
    if (!plan || !progress) return { completedDays: new Set<number>(), partialDays: new Set<number>() };

    const completed = new Set<number>();
    const partial = new Set<number>();
    const completedReadingsByDay = progress.completedReadingsByDay || {};
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
                setIsPinnedHistoryDay(true);
              }}
              startDate={plan.startDate}
              totalDays={plan.totalDays}
              schedule={plan.schedule}
              hideSearch={false}
              hideCalendar={true}
              hideHeader={true}
            />

          {/* Details for Selected Day */}
          <div className="mt-2" ref={historyDetailRef}>
            {(() => {
              const day = selectedHistoryDay;
              
              if (!isPinnedHistoryDay) return null;

              const entry = plan.schedule.find((s) => s.day === day);
              const readings = entry?.readings ?? [];
              const readingCount = readings.length;

              const isDayCompleted = progress.completedDays.includes(day);
              const completedIndices = progress.completedReadingsByDay?.[String(day)] ?? [];
              const completedSet = new Set(completedIndices);
              const dayChaptersMap = progress.completedChaptersByDay?.[String(day)] ?? {};

              const completedByIndex = readings.map((_, i) => isDayCompleted || completedSet.has(i));
              const completedChaptersByIndex = readings.map((_, i) => dayChaptersMap[i] ?? []);

              if (readings.length === 0) {
                return (
                  <div className="bg-card text-card-foreground border border-border rounded-xl p-4 text-sm text-muted-foreground text-center">
                    선택한 날짜({day}일차)에 읽기 항목이 없습니다.
                  </div>
                );
              }

              return (
                <TodayReading
                  day={day}
                  readings={readings}
                  completedByIndex={completedByIndex}
                  completedChaptersByIndex={completedChaptersByIndex}
                  subtitle={`${day}일차 상세 보기`}
                  onToggleReading={(readingIndex, completed, completedChapters) =>
                    toggleReading({
                      day,
                      readingIndex,
                      completed,
                      readingCount,
                      completedChapters,
                    })
                  }
                />
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
