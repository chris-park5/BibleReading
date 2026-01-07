import { useMemo, useState } from "react";
import { usePlans, usePlan } from "../../../hooks/usePlans";
import { useProgress } from "../../../hooks/useProgress";
import { usePlanStore } from "../../../stores/plan.store";
import { ProgressChart } from "../../components/ProgressChart";
import { ReadingHistory } from "../../components/ReadingHistory";
import { computeTodayDay, parseYYYYMMDDLocal, startOfTodayLocal } from "./dateUtils";
import { setHashTab } from "./tabHash";

export function ProgressTab() {
  const { plans } = usePlans();
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { selectPlan, currentDay, setViewDate } = usePlanStore();

  // 계획이 있으면 자동으로 첫 번째 계획 선택 (selectedPlanId가 없을 때)
  const activePlanId = selectedPlanId || (plans.length > 0 ? plans[0].id : null);
  const plan = usePlan(activePlanId);
  const { progress } = useProgress(activePlanId);
  const [showHistory, setShowHistory] = useState(false);

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

  const chartData = useMemo(() => {
    const data: Array<{ day: number; completed: number }> = [];
    const sortedDays = [...progress.completedDays].sort((a, b) => a - b);
    for (let i = 0; i < sortedDays.length; i++) {
      data.push({ day: sortedDays[i], completed: i + 1 });
    }
    return data;
  }, [progress.completedDays]);

  const today = startOfTodayLocal();
  const rawTodayDay = computeTodayDay(plan, today);
  const elapsedDays = Math.max(0, Math.min(plan.totalDays, rawTodayDay));
  const completedUpToToday = progress.completedDays.filter((d) => d >= 1 && d <= elapsedDays).length;
  const completionRateElapsed = elapsedDays === 0 ? 0 : Math.round((completedUpToToday / elapsedDays) * 100);

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
          오늘까지 {elapsedDays}일 중 {completedUpToToday}일 완료
        </p>
        <p className="text-gray-600 mt-1">{completionMessage}</p>
      </div>

      <ProgressChart totalDays={plan.totalDays} completedDays={progress.completedDays.length} chartData={chartData} />

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {showHistory ? "읽기 기록 접기" : "읽기 기록"}
      </button>

      {showHistory && (
        <ReadingHistory
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

              // 모든 reading이 완료된 경우
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

              // 일부만 완료된 경우 (0 < completedCount < totalReadings)
              if (completedCount > 0 && completedCount < totalReadings) {
                partial.add(day);
              }
            }

            return partial;
          })()}
          currentDay={currentDay}
          onDayClick={(day) => {
            // 계획 시작일로부터 day일 후의 날짜 계산
            const startDate = parseYYYYMMDDLocal(plan.startDate);
            const targetDate = new Date(startDate);
            targetDate.setDate(targetDate.getDate() + (day - 1));

            // 전역 viewDate 설정 및 홈 탭으로 이동
            setViewDate(targetDate);
            setHashTab("home");
          }}
          totalDays={plan.totalDays}
        />
      )}
    </div>
  );
}
