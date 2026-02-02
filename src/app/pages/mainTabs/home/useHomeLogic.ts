import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlans } from "../../../../hooks/usePlans";
import { usePlanStore } from "../../../../stores/plan.store";
import { useAuthStore } from "../../../../stores/auth.store";
import * as progressService from "../../../../services/progressService";
import * as friendService from "../../../../services/friendService";
import * as authService from "../../../../services/authService";
import { enqueueReadingToggle, isOfflineLikeError, OfflineError } from "../../../utils/offlineProgressQueue";
import { computeTodayDay, startOfTodayLocal } from "../dateUtils";
import { expandChapters } from "../../../utils/expandChapters";

type CombinedReading = {
  planId: string;
  planName: string;
  day: number;
  readingIndex: number;
  readingCount: number;
  totalReadingsCount: number;
  book: string;
  chapters: string;
  completed: boolean;
  completedChapters: string[];
};

export function useHomeLogic() {
  const { plans, isLoading: isPlansLoading } = usePlans();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userName = useAuthStore((s) => s.user?.name ?? "사용자");

  // Fetch Streak
  const { data: streakData, isLoading: isStreakLoading } = useQuery({
    queryKey: ["streak", userId],
    queryFn: authService.checkStreak,
    enabled: !!userId,
  });

  const streak = streakData?.currentStreak ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;

  // Priority Loading: Defer secondary data (friend requests)
  const [isIdle, setIsIdle] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsIdle(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const { data: friendsData } = useQuery({
    queryKey: ["friends", userId],
    queryFn: friendService.getFriends,
    enabled: !!userId && isIdle,
    refetchInterval: 30000,
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
      setGlobalViewDate(null);
    }
  }, [globalViewDate, setGlobalViewDate]);

  const setViewDate = (date: Date) => {
    setViewDateLocal(date);
  };

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

  const todayDayLabel = useMemo(() => {
    // Find the first active plan for today
    const activePlan = plans.find(p => {
        const d = computeTodayDay(p, today);
        return d >= 1 && d <= p.totalDays;
    });
    return activePlan ? `Day ${computeTodayDay(activePlan, today)}` : "오늘";
  }, [plans, today]);

  const viewPlans = useMemo(() => {
    if (!plans) return [];
    return plans
      .map((p) => ({ plan: p, day: computeTodayDay(p, viewDate) }))
      .filter(({ plan, day }) => day >= 1 && day <= (plan.totalDays || 365));
  }, [plans, viewDate]);

  const uniqueDays = useMemo(() => new Set(viewPlans.map(p => p.day)), [viewPlans]);
  const displayDay = uniqueDays.size === 1 ? viewPlans[0].day : undefined;

  const viewDayLabel = useMemo(() => {
    if (isToday) return "오늘";
    if (uniqueDays.size === 1) return `Day ${viewPlans[0].day}`;
    if (viewPlans.length > 0) return "읽기 목록";
    return "선택한 날짜";
  }, [isToday, uniqueDays, viewPlans]);

  const queryClient = useQueryClient();
  const progressMutationSeqByPlanRef = useRef(new Map<string, number>());

  // Spread out progress fetching to avoid a burst of N simultaneous requests
  // (especially when a user has many plans).
  const [progressPrefetchStage, setProgressPrefetchStage] = useState(0);
  const PROGRESS_PREFETCH_BATCH_SIZE = 2;

  // Fetch progress for ALL plans to show dots on calendar
  // but stage it to reduce initial loading pressure.
  const allProgressQueries = useQueries({
    queries: plans.map((plan, idx) => {
      const isOptimistic = plan.id.startsWith("optimistic-");

      // Always prioritize progress for plans that are active on the current viewDate.
      // Others are enabled gradually in small batches.
      const isPlanRelevantForViewDate = viewPlans.some((vp) => vp.plan.id === plan.id);
      const isEnabledByStage = idx < progressPrefetchStage * PROGRESS_PREFETCH_BATCH_SIZE;

      return {
        queryKey: ["progress", userId, plan.id],
        queryFn: () => progressService.getProgress(plan.id),
        enabled: !!userId && !isOptimistic && (isPlanRelevantForViewDate || isEnabledByStage),
      };
    }),
  });

  useEffect(() => {
    if (!userId) return;
    const realPlans = plans.filter((p) => !p.id.startsWith("optimistic-"));
    if (realPlans.length === 0) return;

    // Reset when plan list changes meaningfully.
    setProgressPrefetchStage(1);

    const maxStages = Math.ceil(realPlans.length / PROGRESS_PREFETCH_BATCH_SIZE);
    if (maxStages <= 1) return;

    let stage = 1;
    const timer = setInterval(() => {
      stage += 1;
      setProgressPrefetchStage(stage);
      if (stage >= maxStages) {
        clearInterval(timer);
      }
    }, 350);

    return () => clearInterval(timer);
  }, [plans, userId]);

  const progressByPlanId = useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < plans.length; i++) {
      map.set(plans[i].id, allProgressQueries[i].data?.progress ?? null);
    }
    return map;
  }, [allProgressQueries, plans]);

  const updateReadingMutation = useMutation({
    mutationFn: (vars: {
      planId: string;
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number; // This is actually chapter count for the item
      totalReadingsCount: number; // Total items in the day
      completedChapters?: string[];
    }) => {
      if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
        throw new OfflineError();
      }
      return progressService.updateReadingProgress(
        vars.planId,
        vars.day,
        vars.readingIndex,
        vars.completed,
        vars.readingCount,
        vars.completedChapters
      );
    },
    onMutate: async (vars) => {
      const key = ["progress", userId, vars.planId] as const;

      const prevSeq = progressMutationSeqByPlanRef.current.get(vars.planId) ?? 0;
      const seq = prevSeq + 1;
      progressMutationSeqByPlanRef.current.set(vars.planId, seq);

      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<any>(key);

      queryClient.setQueryData<any>(key, (current: any) => {
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
        
        const prevChaptersMap = prevProgress.completedChaptersByDay ?? {};
        const prevDayChapters = prevChaptersMap[dayKey] ?? {};
        const nextDayChapters = { ...prevDayChapters };

        if (vars.completed) {
            delete nextDayChapters[vars.readingIndex];
        } else if (vars.completedChapters && vars.completedChapters.length > 0) {
            nextDayChapters[vars.readingIndex] = vars.completedChapters;
        } else {
            delete nextDayChapters[vars.readingIndex];
        }
        
        const nextCompletedChaptersByDay = {
            ...prevChaptersMap,
            [dayKey]: nextDayChapters,
        };

        const nextCompletedDays = new Set<number>(prevProgress.completedDays ?? []);
        // FIX: Use totalReadingsCount (items count) instead of readingCount (chapter count)
        const isDayCompleted = vars.totalReadingsCount > 0 && nextList.length >= vars.totalReadingsCount;
        
        if (isDayCompleted) nextCompletedDays.add(vars.day);
        else nextCompletedDays.delete(vars.day);

        return {
          ...current,
          progress: {
            ...prevProgress,
            completedReadingsByDay: nextCompletedReadingsByDay,
            completedChaptersByDay: nextCompletedChaptersByDay,
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
      queryClient.setQueryData(ctx.key, data);

      // Refresh weekly activity chart data (ProgressTab/AchievementReportModal)
      // which reads from the dailyStats query.
      queryClient.invalidateQueries({ queryKey: ["dailyStats", ctx.planId] });
    },
    onSettled: (_data, _error, vars) => {
      const key = ["progress", userId, vars.planId] as const;
      return queryClient.invalidateQueries({ queryKey: key });
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
      const dayChaptersMap = progress?.completedChaptersByDay?.[String(day)] ?? {};
      
      const totalReadingsCount = reading.readings.length;

      for (let readingIndex = 0; readingIndex < reading.readings.length; readingIndex++) {
        const r = reading.readings[readingIndex];
        const completedChapters = dayChaptersMap[readingIndex] ?? [];
        
        // Calculate exact chapter count for this reading item
        // Prefer DB-backed chapter_count (can be fractional), fallback to expanded chapter length.
        const rawChapterCount = (r as any)?.chapter_count;
        const parsedChapterCount = rawChapterCount === null || rawChapterCount === undefined ? NaN : Number(rawChapterCount);
        const chapterCount = Number.isFinite(parsedChapterCount)
          ? parsedChapterCount
          : expandChapters(r.chapters).length;
        
        rows.push({
          planId: plan.id,
          planName: plan.name,
          day,
          readingIndex,
          readingCount: chapterCount,
          totalReadingsCount,
          book: r.book,
          chapters: r.chapters,
          completed: isDayCompleted || completedSet.has(readingIndex),
          completedChapters: completedChapters,
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
  const completedChaptersByIndex = useMemo(() => combined.map((c) => c.completedChapters), [combined]);

  // Generate 7 days centered roughly around today, or just static Mon-Sun of current week
  const weekDates = useMemo(() => {
    const current = new Date(viewDate);
    const day = current.getDay(); // 0=Sun
    const diff = current.getDate() - day; // Adjust to Sunday
    const startOfWeek = new Date(current.setDate(diff));
    
    const days = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push(d);
    }
    return days;
  }, [viewDate]);

  const isAllPlansCompletedForDate = (date: Date) => {
    if (plans.length === 0) return false;
    
    // For this date, check if ALL active plans have their scheduled day completed
    const results = plans.map(p => {
        const day = computeTodayDay(p, date);
        if (day < 1 || day > p.totalDays) return true; // Not scheduled today, counts as 'done' or ignored
        
        const progress = progressByPlanId.get(p.id);
        return progress?.completedDays?.includes(day) ?? false;
    });
    
    return results.every(Boolean);
  };

  const hasAnyPlanForDate = (date: Date) => {
      return plans.some(p => {
          const day = computeTodayDay(p, date);
          return day >= 1 && day <= p.totalDays;
      });
  }

  return {
    // Data
    plans,
    userName,
    streak,
    longestStreak,
    incomingRequestsCount,
    today,
    viewDate,
    weekDates,
    readings,
    completedByIndex,
    completedChaptersByIndex,
    displayDay,
    viewPlans,
    combined,

    // UI Labels
    todayDayLabel,
    viewDateLabel,
    viewDayLabel,
    isToday,

    // Handlers
    setViewDate,
    handlePrevDay,
    handleNextDay,
    updateReadingMutation,
    
    // Logic Helpers
    isAllPlansCompletedForDate,
    hasAnyPlanForDate,

    isLoading: isPlansLoading || isStreakLoading,
  };
}