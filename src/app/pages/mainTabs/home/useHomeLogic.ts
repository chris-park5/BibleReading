import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlans } from "../../../../hooks/usePlans";
import { usePlanStore } from "../../../../stores/plan.store";
import { useAuthStore } from "../../../../stores/auth.store";
import * as progressService from "../../../../services/progressService";
import * as friendService from "../../../../services/friendService";
import * as authService from "../../../../services/authService";
import { enqueueReadingToggle, isOfflineLikeError, OfflineError } from "../../../utils/offlineProgressQueue";
import { getDailyStats } from "../../../utils/api";
import { computeTodayDay, parseYYYYMMDDLocal, startOfTodayLocal } from "../dateUtils";
import { expandChapters } from "../../../utils/expandChapters";
import { computeChaptersTotals } from "../../../utils/chaptersProgress";
import type { Plan } from "../../../../types/domain";
import { buildCompletionSnapshot } from "../../../utils/planCompletionSnapshot";

export type CombinedReading = {
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

export function useHomeLogic(
  {
    prefetchAllProgress = false,
  }: {
    prefetchAllProgress?: boolean;
  } = {},
) {
  const { plans: allPlans, isLoading: isPlansLoading, completePlanAsync } = usePlans();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userName = useAuthStore((s) => s.user?.name ?? "사용자");

  const plans = useMemo(() => {
    // Home(읽기)에서는 '진행 중' 계획만 대상으로 한다.
    return (allPlans ?? []).filter((p: Plan) => (p as any)?.status !== "completed" && (p as any)?.status !== "archived");
  }, [allPlans]);

  const [completedCelebration, setCompletedCelebration] = useState<null | { plan: Plan; progress: any }>(null);
  const completingPlanIdsRef = useRef<Set<string>>(new Set());

  // Fetch Streak
  const { data: streakData, isLoading: isStreakLoading } = useQuery({
    queryKey: ["streak", userId],
    queryFn: authService.checkStreak,
    enabled: !!userId,
  });

  const loginStreak = streakData?.currentStreak ?? 0;
  const longestLoginStreak = streakData?.longestStreak ?? 0;

  const { data: readingStreakDailyStats = [] } = useQuery({
    queryKey: ["readingStreakStats", userId],
    queryFn: () => getDailyStats().then((r) => r.stats),
    enabled: !!userId,
    staleTime: 60_000,
    placeholderData: (prev) => prev ?? [],
  });

  // 기준: 하루에 조금이라도 읽으면(0 초과) 연속읽기 1일로 인정.
  // 오늘 아직 읽지 않았더라도 자정 전에는 전날 기준 streak를 유지한다.
  const readingStreak = useMemo(() => {
    const byDate = new Map<string, number>();
    readingStreakDailyStats.forEach((s) => {
      const ymd = String(s.date).split("T")[0];
      const count = Number(s.count);
      const prev = byDate.get(ymd) ?? 0;
      byDate.set(ymd, prev + (Number.isFinite(count) ? count : 0));
    });

    let streak = 0;
    const cursor = startOfTodayLocal();
    const todayYmd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    const todayCount = byDate.get(todayYmd) ?? 0;
    const startOffset = todayCount > 0 ? 0 : 1;

    let i = startOffset;
    while (true) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = byDate.get(ymd) ?? 0;
      if (count > 0) streak += 1;
      else break;
      i += 1;
    }

    return streak;
  }, [readingStreakDailyStats]);

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
  const progressMutationQueueByPlanRef = useRef(new Map<string, Promise<unknown>>());
  const progressPendingMutationsByPlanRef = useRef(new Map<string, number>());

  const incPending = (planId: string) => {
    const prev = progressPendingMutationsByPlanRef.current.get(planId) ?? 0;
    const next = prev + 1;
    progressPendingMutationsByPlanRef.current.set(planId, next);
    return next;
  };

  const decPending = (planId: string) => {
    const prev = progressPendingMutationsByPlanRef.current.get(planId) ?? 0;
    const next = Math.max(0, prev - 1);
    progressPendingMutationsByPlanRef.current.set(planId, next);
    return next;
  };

  // 배치 API로 모든 계획의 진도를 한번에 조회
  const realPlanIds = useMemo(() => 
    plans.filter(p => !p.id.startsWith("optimistic-")).map(p => p.id),
    [plans]
  );

  const { data: batchProgressData } = useQuery({
    queryKey: ["progress-batch", userId, realPlanIds.join(",")],
    queryFn: () => progressService.getBatchProgress(realPlanIds),
    enabled: !!userId && realPlanIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5분
  });

  // 배치 결과를 개별 캐시에 시딩 (mutation 호환성 유지)
  useEffect(() => {
    if (!batchProgressData?.progressMap || !userId) return;
    
    for (const [planId, progress] of Object.entries(batchProgressData.progressMap)) {
      const queryKey = ["progress", userId, planId];
      // 기존 캐시가 없는 경우에만 시딩 (mutation으로 업데이트된 것은 덮어쓰지 않음)
      const existing = queryClient.getQueryData(queryKey);
      if (!existing) {
        queryClient.setQueryData(queryKey, { success: true, progress });
      }
    }
  }, [batchProgressData, userId, queryClient]);

  // 개별 progress 쿼리들을 구독하여 mutation 후 업데이트 감지
  const allProgressQueries = useQueries({
    queries: plans.map((plan) => {
      const isOptimistic = plan.id.startsWith("optimistic-");
      const batchProgress = batchProgressData?.progressMap?.[plan.id];
      
      return {
        queryKey: ["progress", userId, plan.id],
        queryFn: () => progressService.getProgress(plan.id),
        enabled: !!userId && !isOptimistic,
        // 배치 API 결과가 있으면 초기 데이터로 사용 (네트워크 요청 방지)
        initialData: batchProgress ? { success: true, progress: batchProgress } : undefined,
        // 배치 API로 이미 데이터를 받았으면 즉시 refetch하지 않음
        staleTime: batchProgress ? 1000 * 60 * 5 : 0,
      };
    }),
  });

  const progressByPlanId = useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < plans.length; i++) {
      map.set(plans[i].id, allProgressQueries[i]?.data?.progress ?? null);
    }
    return map;
  }, [allProgressQueries, plans]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (completedCelebration) return;

    for (const plan of plans) {
      if (!plan?.id || plan.id.startsWith("optimistic-")) continue;
      if (completingPlanIdsRef.current.has(plan.id)) continue;

      const progress = progressByPlanId.get(plan.id);
      if (!progress) continue;

      const { totalChapters, completedChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
      const EPS = 1e-6;
      const isComplete = totalChapters > 0 && completedChapters + EPS >= totalChapters;
      if (!isComplete) continue;

      const seenKey = `planCompletedCelebrated:${plan.id}`;
      const alreadySeen = window.localStorage.getItem(seenKey) === "1";
      if (alreadySeen) continue;

      try {
        window.localStorage.setItem(seenKey, "1");
      } catch {
        // ignore
      }

      completingPlanIdsRef.current.add(plan.id);
      setCompletedCelebration({ plan, progress });

      // Fire-and-forget: mark as completed in DB.
      const snapshot = buildCompletionSnapshot(plan, progress);
      void completePlanAsync({ planId: plan.id, snapshot }).catch(() => {
        // ignore
      });

      break;
    }
  }, [plans, progressByPlanId, completedCelebration, completePlanAsync]);

  const updateReadingMutation = useMutation({
    mutationKey: ["progress-update"],
    mutationFn: (vars: {
      planId: string;
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number; // This is actually chapter count for the item
      totalReadingsCount: number; // Total items in the day
      completedChapters?: string[];
    }) => {
      // Serialize requests per plan so rapid consecutive toggles don't race.
      const previous = progressMutationQueueByPlanRef.current.get(vars.planId) ?? Promise.resolve();

      const task = async () => {
        await previous.catch(() => {});

        if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
          throw new OfflineError();
        }
        return progressService.updateReadingProgress(
          vars.planId,
          vars.day,
          vars.readingIndex,
          vars.completed,
          vars.readingCount,
          vars.completedChapters,
        );
      };

      const nextPromise = task();
      progressMutationQueueByPlanRef.current.set(vars.planId, nextPromise);
      return nextPromise;
    },
    onMutate: async (vars) => {
      const key = ["progress", userId, vars.planId] as const;

      incPending(vars.planId);

      const prevSeq = progressMutationSeqByPlanRef.current.get(vars.planId) ?? 0;
      const seq = prevSeq + 1;
      progressMutationSeqByPlanRef.current.set(vars.planId, seq);

      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<any>(key);

      queryClient.setQueryData<any>(key, (current: any) => {
        if (!current?.progress) return current;

        const prevProgress = current.progress;
        const dayKey = String(vars.day);
        const nextHistory = Array.isArray(prevProgress.history) ? [...prevProgress.history] : [];
        if (vars.completed) {
          nextHistory.push({
            day: vars.day,
            readingIndex: vars.readingIndex,
            completedAt: new Date().toISOString(),
          });
        }

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
            history: nextHistory,
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

      const pending = progressPendingMutationsByPlanRef.current.get(ctx.planId) ?? 0;
      // If other toggles are queued/in-flight, don't rollback (it will cause flicker/disappearing checks).
      if (pending > 1) {
        if (isOfflineLikeError(err)) {
          void enqueueReadingToggle({
            planId: vars.planId,
            day: vars.day,
            readingIndex: vars.readingIndex,
            completed: vars.completed,
            readingCount: vars.readingCount,
          });
        }
        return;
      }

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

      const pending = progressPendingMutationsByPlanRef.current.get(ctx.planId) ?? 0;
      // Only let the last queued mutation write the server response into cache.
      // Otherwise it can overwrite newer optimistic state.
      if (pending <= 1) {
        queryClient.setQueryData(ctx.key, data);
      }
    },
    onSettled: (_data, _error, vars) => {
      const remaining = decPending(vars.planId);
      if (remaining > 0) return;

      const key = ["progress", userId, vars.planId] as const;
      // Only refetch once after the rapid sequence drains.
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["dailyStats", vars.planId] });
      queryClient.invalidateQueries({ queryKey: ["readingStreakStats", userId] });
      queryClient.invalidateQueries({ queryKey: ["myPageDailyStats"] });
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

  // 날짜별 완료 상태 반환: 'complete' | 'partial' | 'incomplete' | null
  const getCompletionStatusForDate = (date: Date): 'complete' | 'partial' | 'incomplete' | null => {
    const activePlansForDate = plans.filter(p => {
      const day = computeTodayDay(p, date);
      return day >= 1 && day <= p.totalDays;
    });
    
    if (activePlansForDate.length === 0) return null;
    
    let totalReadings = 0;
    let completedReadings = 0;
    
    for (const plan of activePlansForDate) {
      const day = computeTodayDay(plan, date);
      const progress = progressByPlanId.get(plan.id);
      const dayEntry = plan.schedule.find(s => s.day === day);
      const dayReadingsCount = dayEntry?.readings?.length ?? 0;
      
      totalReadings += dayReadingsCount;
      
      // 하루 전체가 완료된 경우
      if (progress?.completedDays?.includes(day)) {
        completedReadings += dayReadingsCount;
      } else {
        // 개별 읽기 완료 확인
        const completedIndices = progress?.completedReadingsByDay?.[String(day)] ?? [];
        completedReadings += completedIndices.length;
      }
    }
    
    if (totalReadings === 0) return null;
    if (completedReadings >= totalReadings) return 'complete';
    if (completedReadings > 0) return 'partial';
    return 'incomplete';
  };

  const lastReadTarget = useMemo(() => {
    let latestEntry: { planId: string; day: number; completedAt: string } | null = null;

    for (const plan of plans) {
      const progress = progressByPlanId.get(plan.id);
      const history = progress?.history ?? [];
      if (history.length === 0) continue;

      for (const entry of history) {
        if (!Number.isFinite(entry.day)) continue;
        if (entry.day < 1 || entry.day > plan.totalDays) continue;
        if (!entry.completedAt) continue;

        const completedAtMs = new Date(entry.completedAt).getTime();
        if (!Number.isFinite(completedAtMs)) continue;

        if (!latestEntry || completedAtMs > new Date(latestEntry.completedAt).getTime()) {
          latestEntry = {
            planId: plan.id,
            day: entry.day,
            completedAt: entry.completedAt,
          };
        }
      }
    }

    // Fallback: some update paths may not have history yet. Use latest day with any progress.
    if (!latestEntry) {
      let fallback: { planId: string; day: number; date: Date } | null = null;

      for (const plan of plans) {
        const progress = progressByPlanId.get(plan.id);
        if (!progress) continue;

        const candidateDays = new Set<number>();
        for (const d of progress.completedDays ?? []) {
          if (Number.isFinite(d)) candidateDays.add(d);
        }
        for (const [dayKey, indices] of Object.entries(progress.completedReadingsByDay ?? {})) {
          const d = Number(dayKey);
          if (Number.isFinite(d) && Array.isArray(indices) && indices.length > 0) candidateDays.add(d);
        }
        for (const [dayKey, chapterMap] of Object.entries(progress.completedChaptersByDay ?? {})) {
          const d = Number(dayKey);
          const hasAny = Object.values(chapterMap ?? {}).some((chapters) => Array.isArray(chapters) && chapters.length > 0);
          if (Number.isFinite(d) && hasAny) candidateDays.add(d);
        }

        if (candidateDays.size === 0) continue;

        const planStartDate = parseYYYYMMDDLocal(plan.startDate);
        if (Number.isNaN(planStartDate.getTime())) continue;

        for (const d of candidateDays) {
          if (d < 1 || d > plan.totalDays) continue;
          const date = new Date(planStartDate);
          date.setDate(planStartDate.getDate() + d - 1);

          if (!fallback || date.getTime() > fallback.date.getTime()) {
            fallback = { planId: plan.id, day: d, date };
          }
        }
      }

      if (!fallback) return null;

      const fallbackPlan = plans.find((item) => item.id === fallback.planId);
      if (!fallbackPlan) return null;

      return {
        date: fallback.date,
        day: fallback.day,
        planId: fallback.planId,
        planName: fallbackPlan.name,
        completedAt: fallback.date.toISOString(),
      };
    }

    const plan = plans.find((item) => item.id === latestEntry?.planId);
    if (!plan) return null;

    const planStartDate = parseYYYYMMDDLocal(plan.startDate);
    if (Number.isNaN(planStartDate.getTime())) return null;

    const targetDate = new Date(planStartDate);
    targetDate.setDate(planStartDate.getDate() + latestEntry.day - 1);

    return {
      date: targetDate,
      day: latestEntry.day,
      planId: latestEntry.planId,
      planName: plan.name,
      completedAt: latestEntry.completedAt,
    };
  }, [plans, progressByPlanId]);

  return {
    // Data
    plans,
    progressByPlanId,
    userName,
    readingStreak,
    loginStreak,
    longestLoginStreak,
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
    getCompletionStatusForDate,
    lastReadTarget,

    isLoading: isPlansLoading || isStreakLoading,

    completedCelebration,
    dismissCompletedCelebration: () => setCompletedCelebration(null),
  };
}