import { useEffect, useMemo, useState } from "react";
import { BarChart3, Home, PlusSquare, Settings, UsersRound } from "lucide-react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
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
import * as api from "../utils/api";

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
  const today = useMemo(() => startOfTodayLocal(), []);
  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(today);
  }, [today]);

  const queryClient = useQueryClient();

  const todayPlans = useMemo(() => {
    return plans
      .map((p) => ({ plan: p, day: computeTodayDay(p, today) }))
      .filter(({ plan, day }) => day >= 1 && day <= plan.totalDays);
  }, [plans, today]);

  const progressQueries = useQueries({
    queries: todayPlans.map(({ plan }) => ({
      queryKey: ["progress", plan.id],
      queryFn: () => api.getProgress(plan.id),
      enabled: true,
    })),
  });

  const progressByPlanId = useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < todayPlans.length; i++) {
      map.set(todayPlans[i].plan.id, progressQueries[i].data?.progress ?? null);
    }
    return map;
  }, [progressQueries, todayPlans]);

  const updateReadingMutation = useMutation({
    mutationFn: (vars: {
      planId: string;
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number;
    }) =>
      api.updateReadingProgress(
        vars.planId,
        vars.day,
        vars.readingIndex,
        vars.completed,
        vars.readingCount
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["progress", vars.planId] });
    },
  });

  const combined: CombinedReading[] = useMemo(() => {
    const rows: CombinedReading[] = [];

    for (const { plan, day } of todayPlans) {
      const reading = plan.schedule.find((s) => s.day === day);
      if (!reading) continue;

      const progress = progressByPlanId.get(plan.id);
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
          book: `${plan.name} · ${r.book}`,
          chapters: r.chapters,
          completed: completedSet.has(readingIndex),
        });
      }
    }

    return rows;
  }, [progressByPlanId, todayPlans]);

  const readings = useMemo(
    () => combined.map((c) => ({ book: c.book, chapters: c.chapters })),
    [combined]
  );
  const completedByIndex = useMemo(() => combined.map((c) => c.completed), [combined]);

  if (!plans.length) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">현재 진행 중인 계획이 없습니다.</p>
          <p className="text-gray-500 text-sm mt-1">아래 탭에서 계획을 추가해주세요.</p>
          <button
            type="button"
            onClick={() => setHashTab("add")}
            className="mt-4 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            계획 추가로 이동
          </button>
        </div>
      </div>
    );
  }

  if (!todayPlans.length) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">오늘 읽을 계획이 없습니다.</p>
          <p className="text-gray-500 text-sm mt-1">계획의 시작일/기간을 확인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-600">오늘</p>
        <p className="text-lg">{todayLabel}</p>
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
  const { selectPlan, currentDay, setCurrentDay } = usePlanStore();
  const plan = usePlan(selectedPlanId);
  const { progress } = useProgress(selectedPlanId);
  const [showHistory, setShowHistory] = useState(false);

  if (!selectedPlanId || !plan || !progress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-700">진도율을 보려면 계획을 선택해주세요.</p>
          <p className="text-gray-500 text-sm mt-1">계획 추가는 홈 탭에서 진행할 수 있습니다.</p>
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
                p.id === selectedPlanId
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {p.name}
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
          completedDays={new Set(progress.completedDays)}
          currentDay={currentDay}
          onDayClick={setCurrentDay}
          totalDays={plan.totalDays}
        />
      )}
    </div>
  );
}
