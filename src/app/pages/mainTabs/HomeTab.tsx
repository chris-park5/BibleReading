import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, BookHeart, Sparkles, Plus, Calendar as CalendarIcon, CheckCircle2, Bell, Settings, Users } from "lucide-react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlans } from "../../../hooks/usePlans";
import { usePlanStore } from "../../../stores/plan.store";
import { useAuthStore } from "../../../stores/auth.store";
import { TodayReading } from "../../components/TodayReading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import * as progressService from "../../../services/progressService";
import * as friendService from "../../../services/friendService";
import * as authService from "../../../services/authService";
import { enqueueReadingToggle, isOfflineLikeError, OfflineError } from "../../utils/offlineProgressQueue";
import { computeTodayDay, startOfTodayLocal } from "./dateUtils";
import { setHashTab } from "./tabHash";
import { cn } from "../../components/ui/utils";

type CombinedReading = {
  planId: string;
  planName: string;
  day: number;
  readingIndex: number;
  readingCount: number;
  book: string;
  chapters: string;
  completed: boolean;
  completedChapters: string[];
};

export function HomeTab() {
  const { plans } = usePlans();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userName = useAuthStore((s) => s.user?.name ?? "사용자");

  // Fetch Streak
  const { data: streak } = useQuery({
    queryKey: ["streak", userId],
    queryFn: authService.checkStreak,
    enabled: !!userId,
  });

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

  // Static 'Today' labels for the sticky header
  const todayDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(today);
  }, [today]);

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

  // Fetch progress for ALL plans to show dots on calendar, not just viewPlans
  // Optimization: We could only fetch for the current week, but standard getProgress fetches all.
  const allProgressQueries = useQueries({
    queries: plans.map((plan) => ({
      queryKey: ["progress", userId, plan.id],
      queryFn: () => progressService.getProgress(plan.id),
      enabled: !!userId,
    })),
  });

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
      readingCount: number;
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
    onMutate: (vars) => {
      const key = ["progress", userId, vars.planId] as const;

      const prevSeq = progressMutationSeqByPlanRef.current.get(vars.planId) ?? 0;
      const seq = prevSeq + 1;
      progressMutationSeqByPlanRef.current.set(vars.planId, seq);

      void queryClient.cancelQueries({ queryKey: key });

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
        const isDayCompleted = vars.readingCount > 0 && nextList.length >= vars.readingCount;
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
      
      const readingCount = reading.readings.length;

      for (let readingIndex = 0; readingIndex < reading.readings.length; readingIndex++) {
        const r = reading.readings[readingIndex];
        const completedChapters = dayChaptersMap[readingIndex] ?? [];
        
        rows.push({
          planId: plan.id,
          planName: plan.name,
          day,
          readingIndex,
          readingCount,
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

  // --- Sticky Header & Calendar Logic ---

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

  // --- Render ---

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Sticky Header: Streak & Static Today Date */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-foreground">{todayDateLabel}</p>
            </div>
            <div className="flex items-center gap-3">
                {/* Notification Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="relative flex items-center gap-1.5 p-1 hover:bg-accent rounded-full transition-colors outline-none pl-3 group">
                            {incomingRequestsCount > 0 && (
                                <span className="text-[10px] sm:text-[11px] font-bold text-red-500 animate-pulse whitespace-nowrap">
                                    새 친구 요청이 있습니다
                                </span>
                            )}
                            <div className="relative p-1">
                                <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                {incomingRequestsCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-background" />
                                )}
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>알림</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setHashTab("settings")}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>알림 설정</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHashTab("friends", "requests")}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>친구 요청</span>
                            {incomingRequestsCount > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {incomingRequestsCount}
                                </span>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-900/30">
                    <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak ?? 0}일</span>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-4">
        
        {/* Greeting Section (Non-sticky) */}
        <div>
            <h1 className="text-xl font-bold">
                반가워요, {userName}님!
            </h1>
        </div>

        {/* Weekly Calendar Strip */}
        <div>
            <div className="bg-card/50 border border-border/50 rounded-xl p-1 relative">
                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePrevDay}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                        title="이전 날"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex-1 flex justify-between items-center">
                        {weekDates.map((date, i) => {
                            const isSelected = date.getTime() === viewDate.getTime();
                            const isDateToday = date.getTime() === today.getTime();
                            const isCompleted = isAllPlansCompletedForDate(date);
                            const hasPlan = hasAnyPlanForDate(date);
                            
                            return (
                                <button
                                    key={i}
                                    onClick={() => setViewDate(date)}
                                    className={cn(
                                        "flex flex-col items-center justify-center w-9 h-14 rounded-lg transition-all duration-200",
                                        isSelected ? "bg-primary text-primary-foreground shadow-md scale-105" : "hover:bg-muted text-muted-foreground"
                                    )}
                                >
                                    <span className="text-[10px] font-medium opacity-80">
                                        {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}
                                    </span>
                                    <span className={cn("text-sm font-bold", isSelected && "text-white")}>
                                        {date.getDate()}
                                    </span>
                                    {/* Dot indicator */}
                                    <div className="mt-1 h-1 w-1 rounded-full overflow-hidden">
                                        {hasPlan && (
                                            <div className={cn(
                                                "h-full w-full rounded-full",
                                                isCompleted 
                                                    ? (isSelected ? "bg-white" : "bg-green-500") 
                                                    : (isDateToday && !isSelected ? "bg-primary" : "bg-transparent") 
                                                )} 
                                            />
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <button
                        onClick={handleNextDay}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                        title="다음 날"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Return to Today Button */}
            {!isToday && (
                <div className="flex justify-center mt-2">
                    <button 
                        onClick={() => setViewDate(today)}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1 bg-primary/5 px-3 py-1 rounded-full"
                    >
                        오늘 날짜로 돌아가기
                    </button>
                </div>
            )}
        </div>

        {/* Empty State */}
        {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                    <div className="relative bg-card p-6 rounded-full border border-border shadow-sm">
                        <BookHeart className="w-12 h-12 text-primary" strokeWidth={1.5} />
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
                </div>
                <div className="max-w-xs space-y-2">
                    <h3 className="text-xl font-bold">아직 읽기 계획이 없으시네요</h3>
                    <p className="text-muted-foreground">
                        새로운 성경 읽기 계획을 시작하고<br/>말씀과 함께하는 여정을 떠나보세요.
                    </p>
                </div>
                <button
                    onClick={() => setHashTab("add")}
                    className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                    <Plus className="w-5 h-5" />
                    새 계획 시작하기
                </button>
            </div>
        ) : !viewPlans.length ? (
            // No plans for this specific date
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                <CalendarIcon className="w-10 h-10 text-muted-foreground/50" />
                <div>
                    <p className="font-medium">이 날짜에는 예정된 읽기가 없습니다</p>
                    <p className="text-sm text-muted-foreground">쉬어가는 날이거나 계획 범위를 벗어났습니다.</p>
                </div>
                {!isToday && (
                    <button
                        onClick={() => setViewDate(today)}
                        className="text-primary text-sm font-medium hover:underline"
                    >
                        오늘로 돌아가기
                    </button>
                )}
            </div>
        ) : (
            // Active Plans
            <TodayReading
                day={isToday ? undefined : displayDay}
                subtitle={isToday ? "오늘의 읽기" : "이날의 읽기"}
                readings={readings}
                completedByIndex={completedByIndex}
                completedChaptersByIndex={completedChaptersByIndex}
                onToggleReading={(index, completed, completedChapters) => {
                const target = combined[index];
                if (!target) return;
                updateReadingMutation.mutate({
                    planId: target.planId,
                    day: target.day,
                    readingIndex: target.readingIndex,
                    completed,
                    readingCount: target.readingCount,
                    completedChapters,
                });
                }}
            />
        )}
      </div>
    </div>
  );
}