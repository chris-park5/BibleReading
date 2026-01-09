import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlans } from "../../../hooks/usePlans";
import { usePlanStore } from "../../../stores/plan.store";
import { useAuthStore } from "../../../stores/auth.store";
import { TodayReading } from "../../components/TodayReading";
import * as progressService from "../../../services/progressService";
import * as friendService from "../../../services/friendService";
import { enqueueReadingToggle, isOfflineLikeError, OfflineError } from "../../utils/offlineProgressQueue";
import { computeTodayDay, startOfTodayLocal } from "./dateUtils";
import { setHashTab } from "./tabHash";

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

export function HomeTab() {
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
          <div className="bg-card text-card-foreground border border-border rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
            <div>
              <p>새 친구 요청이 있습니다</p>
              <p className="text-sm text-muted-foreground">{incomingRequestsCount}개</p>
            </div>
            <button
              type="button"
              onClick={() => setHashTab("friends")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
            >
              확인하기
            </button>
          </div>
        )}

        <div className="bg-card text-card-foreground border border-border rounded-xl p-6 text-center">
          <p>현재 진행 중인 계획이 없습니다.</p>
          <p className="text-muted-foreground text-sm mt-1">계획을 추가하면 홈에서 오늘 읽을 분량을 볼 수 있습니다.</p>
          <button
            type="button"
            onClick={() => setHashTab("add")}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
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
          <div className="bg-card text-card-foreground border border-border rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p>새 친구 요청이 있습니다</p>
              <p className="text-sm text-muted-foreground">{incomingRequestsCount}개</p>
            </div>
            <button
              type="button"
              onClick={() => setHashTab("friends")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
            >
              확인하기
            </button>
          </div>
        )}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="이전 날"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm text-muted-foreground">{isToday ? "오늘" : "선택한 날짜"}</p>
              <p className="text-lg">{viewDateLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="다음 날"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={handleToday}
              className="w-full mt-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              오늘로 돌아가기
            </button>
          )}
        </div>
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6 text-center">
          <p>이 날짜에 읽을 계획이 없습니다.</p>
          <p className="text-muted-foreground text-sm mt-1">다른 날짜를 선택하거나 계획을 추가해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {incomingRequestsCount > 0 && (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p>새 친구 요청이 있습니다</p>
            <p className="text-sm text-muted-foreground">{incomingRequestsCount}개</p>
          </div>
          <button
            type="button"
            onClick={() => setHashTab("friends")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
          >
            확인하기
          </button>
        </div>
      )}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="이전 날"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm text-muted-foreground">{isToday ? "오늘" : "선택한 날짜"}</p>
            <p className="text-lg">{viewDateLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleNextDay}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="다음 날"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={handleToday}
            className="w-full mt-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
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
