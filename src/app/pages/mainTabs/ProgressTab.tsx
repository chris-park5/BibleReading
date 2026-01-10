import { useEffect, useMemo, useRef, useState } from "react";
import { usePlans, usePlan } from "../../../hooks/usePlans";
import { useProgress } from "../../../hooks/useProgress";
import { usePlanStore } from "../../../stores/plan.store";
import { ProgressChart } from "../../components/ProgressChart";
import { ReadingHistory } from "../../components/ReadingHistory";
import { TodayReading } from "../../components/TodayReading";
import { BIBLE_BOOKS } from "../../data/bibleBooks";
import { computeTodayDay, startOfTodayLocal } from "./dateUtils";
import { computeChaptersTotals, countChapters } from "../../utils/chaptersProgress";
import { Search } from "lucide-react";
import { bookMatchesQuery } from "../../utils/bookSearch";

export function ProgressTab() {
  const { plans } = usePlans();
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { selectPlan, currentDay } = usePlanStore();

  // 계획이 있으면 자동으로 첫 번째 계획 선택 (selectedPlanId가 없을 때)
  const activePlanId = selectedPlanId || (plans.length > 0 ? plans[0].id : null);
  const plan = usePlan(activePlanId);
  const { progress, toggleReading } = useProgress(activePlanId);
  const [viewMode, setViewMode] = useState<"day" | "book">("day");
  const [bookQuery, setBookQuery] = useState("");
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number>(currentDay);
  const [isPinnedHistoryDay, setIsPinnedHistoryDay] = useState(false);
  const historyDetailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // When plan changes, reset selection to currentDay.
    setSelectedHistoryDay(currentDay);
    setIsPinnedHistoryDay(false);
  }, [activePlanId]);

  useEffect(() => {
    // If user hasn't clicked a day in this tab, keep selection synced.
    if (!isPinnedHistoryDay) setSelectedHistoryDay(currentDay);
  }, [currentDay, isPinnedHistoryDay]);

  // NOTE: Hooks must be called unconditionally.
  // Large plans can make plan/progress arrive a render later; keep hook order stable.
  const bookProgressRows = useMemo(() => {
    if (!plan || !progress) return [] as Array<{ book: string; completed: number; total: number; percent: number }>;

    const totalByBook = new Map<string, number>();
    const doneByBook = new Map<string, number>();
    const completedReadingsByDay = progress.completedReadingsByDay || {};
    const completedDaysSet = new Set(progress.completedDays || []);

    for (const entry of plan.schedule) {
      const day = entry.day;
      const readings = entry.readings || [];
      const forcedComplete = completedDaysSet.has(day);
      const completedIndices = completedReadingsByDay[String(day)] || [];
      const completedSet = forcedComplete ? new Set(readings.map((_, i) => i)) : new Set(completedIndices);

      for (let i = 0; i < readings.length; i++) {
        const r = readings[i];
        const book = r.book;
        const chapters = countChapters(r.chapters);
        if (!book) continue;

        totalByBook.set(book, (totalByBook.get(book) ?? 0) + chapters);
        if (completedSet.has(i)) {
          doneByBook.set(book, (doneByBook.get(book) ?? 0) + chapters);
        }
      }
    }

    const canonicalOrder = new Map<string, number>();
    BIBLE_BOOKS.forEach((b, idx) => canonicalOrder.set(b.name, idx));

    const rows = Array.from(totalByBook.entries())
      .map(([book, total]) => {
        const completed = Math.min(total, doneByBook.get(book) ?? 0);
        const percent = total <= 0 ? 0 : Math.round((completed / total) * 100);
        return { book, completed, total, percent };
      })
      .sort((a, b) => (canonicalOrder.get(a.book) ?? 999) - (canonicalOrder.get(b.book) ?? 999));

    return rows;
  }, [plan, progress]);

  const normalizedBookQuery = bookQuery.trim().toLowerCase();
  const filteredBookRows = useMemo(() => {
    if (!normalizedBookQuery) return bookProgressRows;
    return bookProgressRows.filter((row) => bookMatchesQuery(row.book, normalizedBookQuery));
  }, [bookProgressRows, normalizedBookQuery]);

  if (!activePlanId || !plan || !progress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6 text-center">
          <p>진도율을 보려면 계획을 선택해주세요.</p>
          <p className="text-muted-foreground text-sm mt-1">계획 추가 탭에서 계획을 추가할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const today = startOfTodayLocal();
  const rawTodayDay = computeTodayDay(plan, today);
  const elapsedDays = Math.max(0, Math.min(plan.totalDays, rawTodayDay));
  const { totalChapters, completedChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
  const { totalChapters: elapsedChapters, completedChapters: completedChaptersUpToToday } = computeChaptersTotals({
    schedule: plan.schedule,
    progress,
    upToDay: elapsedDays,
  });
  const completionRateElapsed = elapsedChapters === 0 ? 0 : Math.round((completedChaptersUpToToday / elapsedChapters) * 100);

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
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {plans.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPlan(p.id)}
              className={`shrink-0 px-3 py-2 rounded-lg border text-sm transition-colors ${
                p.id === activePlanId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="block max-w-[10rem] text-center text-xs leading-snug whitespace-normal break-words line-clamp-2">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-card text-card-foreground border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">진도율</p>
        <p className="text-lg">{plan.name}</p>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">달성률</p>
        <p className="text-2xl font-semibold">{completionRateElapsed}%</p>
        <p className="text-sm text-muted-foreground mt-1">
          오늘까지 {elapsedChapters}장 중 {completedChaptersUpToToday}장 완료
        </p>
        <p className="text-muted-foreground mt-1">{completionMessage}</p>
      </div>

      <ProgressChart totalChapters={totalChapters} completedChapters={completedChapters} />

      <div className="bg-card text-card-foreground border border-border rounded-xl p-2 flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode("day")}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
            viewMode === "day" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"
          }`}
        >
          일자별
        </button>
        <button
          type="button"
          onClick={() => setViewMode("book")}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
            viewMode === "book" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"
          }`}
        >
          성경별
        </button>
      </div>

      {viewMode === "day" ? (
        <>
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
              const completedDaysSet = new Set(progress.completedDays || []);

              for (let day = 1; day <= plan.totalDays; day++) {
                if (completedDaysSet.has(day)) continue;

                const reading = plan.schedule.find((s) => s.day === day);
                if (!reading) continue;

                const totalReadings = reading.readings.length;
                if (totalReadings <= 0) continue;

                const completedIndices = completedReadingsByDay[String(day)] || [];
                const completedCount = completedIndices.length;
                if (completedCount > 0 && completedCount < totalReadings) partial.add(day);
              }

              return partial;
            })()}
            currentDay={currentDay}
            selectedDay={selectedHistoryDay}
            onDayClick={(day) => {
              setSelectedHistoryDay(day);
              setIsPinnedHistoryDay(true);

              // Scroll to the checkbox list (TodayReading) below.
              if (typeof window !== "undefined") {
                window.requestAnimationFrame(() => {
                  historyDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }
            }}
            startDate={plan.startDate}
            totalDays={plan.totalDays}
          />

          {(() => {
            const day = selectedHistoryDay;
            const entry = plan.schedule.find((s) => s.day === day);
            const readings = entry?.readings ?? [];
            const readingCount = readings.length;

            const isDayCompleted = progress.completedDays.includes(day);
            const completedIndices = progress.completedReadingsByDay?.[String(day)] ?? [];
            const completedSet = new Set(completedIndices);

            const completedByIndex = readings.map((_, i) => isDayCompleted || completedSet.has(i));

            return (
              <div ref={historyDetailRef} className="pt-2">
                {readings.length === 0 ? (
                  <div className="bg-card text-card-foreground border border-border rounded-xl p-4 text-sm text-muted-foreground">
                    선택한 날짜에 읽기 항목이 없습니다.
                  </div>
                ) : (
                  <TodayReading
                    day={day}
                    readings={readings}
                    completedByIndex={completedByIndex}
                    subtitle={null}
                    onToggleReading={(readingIndex, completed) =>
                      toggleReading({
                        day,
                        readingIndex,
                        completed,
                        readingCount,
                      })
                    }
                  />
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-3">책별 진행</div>

          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="책 이름 검색 (예: 히브리서)"
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-input-background text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {normalizedBookQuery && (
              <div className="text-xs text-muted-foreground whitespace-nowrap">{filteredBookRows.length}권</div>
            )}
          </div>

          {bookProgressRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">표시할 데이터가 없습니다.</div>
          ) : filteredBookRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">검색 결과가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {filteredBookRows.map((row) => (
                <div key={row.book} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{row.book}</div>
                      <div className="text-xs text-muted-foreground">{row.completed}/{row.total}장</div>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground shrink-0">{row.percent}%</div>
                  </div>
                  <div className="mt-2 w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${row.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
