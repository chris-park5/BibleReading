import { useMemo, useState } from "react";
import { usePlans, usePlan } from "../../../hooks/usePlans";
import { useProgress } from "../../../hooks/useProgress";
import { usePlanStore } from "../../../stores/plan.store";
import { ProgressChart } from "../../components/ProgressChart";
import { ReadingHistory } from "../../components/ReadingHistory";
import { BIBLE_BOOKS } from "../../data/bibleBooks";
import { computeTodayDay, parseYYYYMMDDLocal, startOfTodayLocal } from "./dateUtils";
import { setHashTab } from "./tabHash";
import { computeChaptersTotals, countChapters } from "../../utils/chaptersProgress";
import { Search } from "lucide-react";

export function ProgressTab() {
  const { plans } = usePlans();
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { selectPlan, currentDay, setViewDate } = usePlanStore();

  // 계획이 있으면 자동으로 첫 번째 계획 선택 (selectedPlanId가 없을 때)
  const activePlanId = selectedPlanId || (plans.length > 0 ? plans[0].id : null);
  const plan = usePlan(activePlanId);
  const { progress } = useProgress(activePlanId);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "book">("day");
  const [bookQuery, setBookQuery] = useState("");

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
    return bookProgressRows.filter((row) => row.book.toLowerCase().includes(normalizedBookQuery));
  }, [bookProgressRows, normalizedBookQuery]);

  if (!activePlanId || !plan || !progress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">진도율을 보려면 계획을 선택해주세요.</p>
          <p className="text-gray-500 text-sm mt-1">계획 추가 탭에서 계획을 추가할 수 있습니다.</p>
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
              className={`shrink-0 px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                p.id === activePlanId
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span className="block max-w-[10rem] text-center text-xs leading-snug whitespace-normal break-words line-clamp-2">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-600">진도율</p>
        <p className="text-lg">{plan.name}</p>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-600">달성률</p>
        <p className="text-2xl font-semibold">{completionRateElapsed}%</p>
        <p className="text-sm text-gray-500 mt-1">
          오늘까지 {elapsedChapters}장 중 {completedChaptersUpToToday}장 완료
        </p>
        <p className="text-gray-600 mt-1">{completionMessage}</p>
      </div>

      <ProgressChart totalChapters={totalChapters} completedChapters={completedChapters} />

      <div className="bg-white border-2 border-gray-200 rounded-xl p-3 flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode("day")}
          className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
            viewMode === "day" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white"
          }`}
        >
          일자별
        </button>
        <button
          type="button"
          onClick={() => setViewMode("book")}
          className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
            viewMode === "book" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white"
          }`}
        >
          성경별
        </button>
      </div>

      {viewMode === "day" ? (
        <>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showHistory ? "읽기 기록 접기" : "읽기 기록"}
          </button>

          {showHistory && (
            <ReadingHistory
              schedule={plan.schedule}
              completedDays={(() => {
                // 모든 reading이 완료된 날만 포함
                const completed = new Set<number>();
                const completedReadingsByDay = progress.completedReadingsByDay || {};

                for (let day = 1; day <= plan.totalDays; day++) {
                  const reading = plan.schedule.find((s) => s.day === day);
                  if (!reading) continue;

                  const totalReadings = reading.readings.length;
                  const completedIndices = completedReadingsByDay[String(day)] || [];
                  const completedCount = completedIndices.length;

                  if (completedCount === totalReadings && totalReadings > 0) {
                    completed.add(day);
                  }
                }

                return completed;
              })()}
              partialDays={(() => {
                // 일부만 완료된 날 포함
                const partial = new Set<number>();
                const completedReadingsByDay = progress.completedReadingsByDay || {};

                for (let day = 1; day <= plan.totalDays; day++) {
                  const reading = plan.schedule.find((s) => s.day === day);
                  if (!reading) continue;

                  const totalReadings = reading.readings.length;
                  const completedIndices = completedReadingsByDay[String(day)] || [];
                  const completedCount = completedIndices.length;

                  if (completedCount > 0 && completedCount < totalReadings) {
                    partial.add(day);
                  }
                }

                return partial;
              })()}
              currentDay={currentDay}
              onDayClick={(day) => {
                const startDate = parseYYYYMMDDLocal(plan.startDate);
                const targetDate = new Date(startDate);
                targetDate.setDate(targetDate.getDate() + (day - 1));

                setViewDate(targetDate);
                setHashTab("home");
              }}
              totalDays={plan.totalDays}
            />
          )}
        </>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-3">책별 진행</div>

          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="책 이름 검색 (예: 히브리서)"
                className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            {normalizedBookQuery && (
              <div className="text-xs text-gray-500 whitespace-nowrap">{filteredBookRows.length}권</div>
            )}
          </div>

          {bookProgressRows.length === 0 ? (
            <div className="text-sm text-gray-500">표시할 데이터가 없습니다.</div>
          ) : filteredBookRows.length === 0 ? (
            <div className="text-sm text-gray-500">검색 결과가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {filteredBookRows.map((row) => (
                <div key={row.book} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900 truncate">{row.book}</div>
                      <div className="text-xs text-gray-600">{row.completed}/{row.total}장</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 shrink-0">{row.percent}%</div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${row.percent}%` }} />
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
