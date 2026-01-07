import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Home, PlusSquare, Settings, UsersRound } from "lucide-react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { usePlanStore } from "../../stores/plan.store";
import { usePlan, usePlans } from "../../hooks/usePlans";
import { useProgress } from "../../hooks/useProgress";
import { PlanSelectorPage } from "./PlanSelectorPage";
import { FriendsTabPage } from "./FriendsTabPage";
import { SettingsTabPage } from "./SettingsTabPage";
import { TodayReading } from "../components/TodayReading";
import { ProgressChart } from "../components/ProgressChart";
import { ReadingHistory } from "../components/ReadingHistory";
import type { Plan } from "../../types/domain";
import * as progressService from "../../services/progressService";
import { useAuthStore } from "../../stores/auth.store";
import * as friendService from "../../services/friendService";
import { enqueueReadingToggle, isOfflineLikeError, OfflineError } from "../utils/offlineProgressQueue";

type TabKey = "home" | "progress" | "add" | "friends" | "settings";

function parseTabFromHash(hash: string): TabKey | null {
  // expected: #/home, #/progress, #/add, #/friends, #/settings
  const trimmed = (hash || "").trim();
  if (!trimmed.startsWith("#/")) return null;
  const key = trimmed.slice(2);
  if (
    key === "home" ||
    key === "progress" ||
    key === "add" ||
    key === "friends" ||
    key === "settings"
  ) {
    return key;
  }
  return null;
}

function setHashTab(tab: TabKey) {
  window.location.hash = `#/${tab}`;
}

function parseYYYYMMDDLocal(dateStr: string): Date {
  // Treat YYYY-MM-DD as local date (avoid UTC parsing issues)
  const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function computeTodayDay(plan: Plan, today: Date): number {
  const start = parseYYYYMMDDLocal(plan.startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}

type CombinedReading = {
  planId: string;
  planName: string;
  day: number;
  readingIndex: number;
  readingCount: number;
  book: string;
  chapters: string;
  completed: boolean;
};

export function MainTabsPage() {
  const defaultTab: TabKey = "home";
  const [tab, setTab] = useState<TabKey>(() => parseTabFromHash(window.location.hash) ?? defaultTab);

  useEffect(() => {
    // 요구사항: 앱이 열릴 때 기본 탭은 항상 홈
    if (window.location.hash !== "#/home") {
      setHashTab("home");
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseTabFromHash(window.location.hash);
      if (next) setTab(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    // 잘못된 hash인 경우 기본 탭으로 정리
    const parsed = parseTabFromHash(window.location.hash);
    if (!parsed) {
      setHashTab(defaultTab);
    }
  }, [tab, defaultTab]);

  const tabs = useMemo(
    () =>
      [
        { key: "home" as const, label: "홈", icon: Home },
        { key: "progress" as const, label: "진도율", icon: BarChart3 },
        { key: "add" as const, label: "계획 추가", icon: PlusSquare },
        { key: "friends" as const, label: "친구", icon: UsersRound },
        { key: "settings" as const, label: "설정", icon: Settings },
      ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <main className="pb-20">
        {tab === "home" && <HomeTab />}
        {tab === "progress" && <ProgressTab />}
        {tab === "add" && <PlanSelectorPage embedded />}
        {tab === "friends" && <FriendsTabPage />}
        {tab === "settings" && <SettingsTabPage />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t-2 border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setHashTab(t.key)}
                className={`py-3 flex flex-col items-center gap-1 text-sm transition-colors ${
                  active ? "text-blue-600" : "text-gray-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeTab() {
  const { plans } = usePlans();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data: friendsData } = useQuery({
    queryKey: ["friends", userId],
    queryFn: friendService.getFriends,
    enabled: !!userId,
  });
  const incomingRequestsCount = friendsData?.incomingRequests?.length ?? 0;
  const today = useMemo(() => startOfTodayLocal(), []);
  const globalViewDate = usePlanStore((s) => s.viewDate);
  const setGlobalViewDate = usePlanStore((s) => s.setViewDate);
  const [viewDate, setViewDateLocal] = useState<Date>(() => startOfTodayLocal());
  
  // 전역 viewDate가 설정되면 로컬 상태 업데이트
  useEffect(() => {
    if (globalViewDate) {
      setViewDateLocal(globalViewDate);
      setGlobalViewDate(null); // 사용 후 초기화
    }
  }, [globalViewDate, setGlobalViewDate]);
  
  const setViewDate = (date: Date) => {
    setViewDateLocal(date);
  };
  
  const viewDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(viewDate);
  }, [viewDate]);

  const isToday = useMemo(() => {
    return viewDate.getTime() === today.getTime();
  }, [viewDate, today]);

  const queryClient = useQueryClient();
  const progressMutationSeqByPlanRef = useRef(new Map<string, number>());

  const viewPlans = useMemo(() => {
    return plans
      .map((p) => ({ plan: p, day: computeTodayDay(p, viewDate) }))
      .filter(({ plan, day }) => day >= 1 && day <= plan.totalDays);
  }, [plans, viewDate]);

  const progressQueries = useQueries({
    queries: viewPlans.map(({ plan }) => ({
      queryKey: ["progress", userId, plan.id],
      queryFn: () => progressService.getProgress(plan.id),
      enabled: !!userId,
    })),
  });

  const progressByPlanId = useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < viewPlans.length; i++) {
      map.set(viewPlans[i].plan.id, progressQueries[i].data?.progress ?? null);
    }
    return map;
  }, [progressQueries, viewPlans]);

  const updateReadingMutation = useMutation({
    mutationFn: (vars: {
      planId: string;
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number;
    }) => {
      if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
        throw new OfflineError();
      }
      return progressService.updateReadingProgress(
        vars.planId,
        vars.day,
        vars.readingIndex,
        vars.completed,
        vars.readingCount
      );
    },
    onMutate: (vars) => {
      const key = ["progress", userId, vars.planId] as const;

      const prevSeq = progressMutationSeqByPlanRef.current.get(vars.planId) ?? 0;
      const seq = prevSeq + 1;
      progressMutationSeqByPlanRef.current.set(vars.planId, seq);

      // Do not await here; we want the UI to update immediately.
      void queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<any>(key);

      queryClient.setQueryData<any>(key, (current) => {
        if (!current?.progress) return current;

        const prevProgress = current.progress;
        const dayKey = String(vars.day);
        const prevMap = prevProgress.completedReadingsByDay ?? {};
        const prevList = Array.isArray(prevMap[dayKey]) ? prevMap[dayKey] : [];

        const nextSet = new Set<number>(prevList);
        if (vars.completed) nextSet.add(vars.readingIndex);
        else nextSet.delete(vars.readingIndex);

        const nextList = Array.from(nextSet).sort((a, b) => a - b);
        const nextCompletedReadingsByDay = {
          ...prevMap,
          [dayKey]: nextList,
        };

        const nextCompletedDays = new Set<number>(prevProgress.completedDays ?? []);
        const isDayCompleted = vars.readingCount > 0 && nextList.length >= vars.readingCount;
        if (isDayCompleted) nextCompletedDays.add(vars.day);
        else nextCompletedDays.delete(vars.day);

        return {
          ...current,
          progress: {
            ...prevProgress,
            completedReadingsByDay: nextCompletedReadingsByDay,
            completedDays: Array.from(nextCompletedDays),
            lastUpdated: new Date().toISOString(),
          },
        };
      });

      return { key, previous, planId: vars.planId, seq };
    },
    onError: (err, vars, ctx) => {
      if (!ctx) return;
      const latest = progressMutationSeqByPlanRef.current.get(ctx.planId) ?? 0;
      if (ctx.seq !== latest) return;

      // 오프라인/네트워크 문제면 롤백하지 않고 큐에 저장 (온라인 복구 시 자동 동기화)
      if (isOfflineLikeError(err)) {
        void enqueueReadingToggle({
          planId: vars.planId,
          day: vars.day,
          readingIndex: vars.readingIndex,
          completed: vars.completed,
          readingCount: vars.readingCount,
        });
        return;
      }

      if (ctx.previous) {
        queryClient.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      if (!ctx?.key) return;
      const latest = progressMutationSeqByPlanRef.current.get(ctx.planId) ?? 0;
      if (ctx.seq !== latest) return;

      // 서버 응답으로 캐시를 확정 (invalidate 없이도 UI 안정)
      queryClient.setQueryData(ctx.key, data);
    },
  });

  const combined: CombinedReading[] = useMemo(() => {
    const rows: CombinedReading[] = [];

    for (const { plan, day } of viewPlans) {
      const reading = plan.schedule.find((s) => s.day === day);
      if (!reading) continue;

      const progress = progressByPlanId.get(plan.id);
      const isDayCompleted = progress?.completedDays?.includes(day) ?? false;
      const completedIndices = progress?.completedReadingsByDay?.[String(day)] ?? [];
      const completedSet = new Set<number>(completedIndices);
      const readingCount = reading.readings.length;

      for (let readingIndex = 0; readingIndex < reading.readings.length; readingIndex++) {
        const r = reading.readings[readingIndex];
        rows.push({
          planId: plan.id,
          planName: plan.name,
          day,
          readingIndex,
          readingCount,
          book: r.book,
          chapters: r.chapters,
          completed: isDayCompleted || completedSet.has(readingIndex),
        });
      }
    }

    return rows;
  }, [progressByPlanId, viewPlans]);

  const readings = useMemo(
    () => combined.map((c) => ({ planName: c.planName, book: c.book, chapters: c.chapters })),
    [combined]
  );
  const completedByIndex = useMemo(() => combined.map((c) => c.completed), [combined]);

  if (!plans.length) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {incomingRequestsCount > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
            <div>
              <p>새 친구 요청이 있습니다</p>
              <p className="text-sm text-gray-600">{incomingRequestsCount}개</p>
            </div>
            <button
              type="button"
              onClick={() => setHashTab("friends")}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              확인하기
            </button>
          </div>
        )}

        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">현재 진행 중인 계획이 없습니다.</p>
          <p className="text-gray-500 text-sm mt-1">계획을 추가하면 홈에서 오늘 읽을 분량을 볼 수 있습니다.</p>
          <button
            type="button"
            onClick={() => setHashTab("add")}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            계획 추가로 이동
          </button>
        </div>
      </div>
    );
  }

  const handlePrevDay = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() - 1);
    setViewDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + 1);
    setViewDate(newDate);
  };

  const handleToday = () => {
    setViewDate(startOfTodayLocal());
  };

  if (!viewPlans.length) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {incomingRequestsCount > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p>새 친구 요청이 있습니다</p>
              <p className="text-sm text-gray-600">{incomingRequestsCount}개</p>
            </div>
            <button
              type="button"
              onClick={() => setHashTab("friends")}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              확인하기
            </button>
          </div>
        )}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="이전 날"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm text-gray-600">{isToday ? "오늘" : "선택한 날짜"}</p>
              <p className="text-lg">{viewDateLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="다음 날"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={handleToday}
              className="w-full mt-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              오늘로 돌아가기
            </button>
          )}
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">이 날짜에 읽을 계획이 없습니다.</p>
          <p className="text-gray-500 text-sm mt-1">다른 날짜를 선택하거나 계획을 추가해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {incomingRequestsCount > 0 && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p>새 친구 요청이 있습니다</p>
            <p className="text-sm text-gray-600">{incomingRequestsCount}개</p>
          </div>
          <button
            type="button"
            onClick={() => setHashTab("friends")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            확인하기
          </button>
        </div>
      )}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="이전 날"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm text-gray-600">{isToday ? "오늘" : "선택한 날짜"}</p>
            <p className="text-lg">{viewDateLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleNextDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="다음 날"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={handleToday}
            className="w-full mt-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            오늘로 돌아가기
          </button>
        )}
      </div>

      <TodayReading
        readings={readings}
        completedByIndex={completedByIndex}
        onToggleReading={(index, completed) => {
          const target = combined[index];
          if (!target) return;
          updateReadingMutation.mutate({
            planId: target.planId,
            day: target.day,
            readingIndex: target.readingIndex,
            completed,
            readingCount: target.readingCount,
          });
        }}
      />
    </div>
  );
}

function ProgressTab() {
  const { plans } = usePlans();
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { selectPlan, currentDay, setCurrentDay, setViewDate } = usePlanStore();
  
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

  const getChartData = () => {
    const data: Array<{ day: number; completed: number }> = [];
    const sortedDays = [...progress.completedDays].sort((a, b) => a - b);
    for (let i = 0; i < sortedDays.length; i++) {
      data.push({ day: sortedDays[i], completed: i + 1 });
    }
    return data;
  };

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
        <p className="text-sm text-gray-500 mt-1">오늘까지 {elapsedDays}일 중 {completedUpToToday}일 완료</p>
        <p className="text-gray-600 mt-1">{completionMessage}</p>
      </div>

      <ProgressChart
        totalDays={plan.totalDays}
        completedDays={progress.completedDays.length}
        chartData={getChartData()}
      />

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
            setHashTab('home');
          }}
          totalDays={plan.totalDays}
        />
      )}
    </div>
  );
}
