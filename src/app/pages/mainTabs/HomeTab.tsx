import { useEffect, useMemo, useRef, useState } from "react";
import { TodayReading } from "../../components/TodayReading";
import { DayEmptyState } from "./home/DayEmptyState";
import { HomeEmptyState } from "./home/HomeEmptyState";
import { HomeHeader } from "./home/HomeHeader";
import { useHomeLogic } from "./home/useHomeLogic";
import { WeeklyCalendar } from "./home/WeeklyCalendar";
import { Skeleton } from "../../components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { BibleReadingByBook } from "./home/BibleReadingByBook";
import { AchievementReportModal } from "../../components/AchievementReportModal";
import { setHashTab } from "./tabHash";
import { expandChapters } from "../../utils/expandChapters";
import { cn } from "../../components/ui/utils";

function HomeTabSkeleton() {
  return (
    <div className="min-h-screen pb-20 relative">
      <div className="sticky top-0 z-10 bg-background/95 border-b border-border shadow-sm h-14 flex items-center px-4">
         <div className="w-full flex justify-between items-center max-w-4xl mx-auto">
            <Skeleton className="h-6 w-6 rounded-md" />
            <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
            </div>
         </div>
      </div>
      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function HomeTab() {
  const [viewMode, setViewMode] = useState<"daily" | "bible">(() => {
    if (typeof window === "undefined") return "daily";
    const saved = window.localStorage.getItem("homeViewMode");
    return saved === "bible" ? "bible" : "daily";
  });

  const todayReadingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("homeViewMode", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const {
    plans,
    progressByPlanId,
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
    isToday,
    setViewDate,
    handlePrevDay,
    handleNextDay,
    updateReadingMutation,
    isAllPlansCompletedForDate,
    hasAnyPlanForDate,
    isLoading,
    completedCelebration,
    dismissCompletedCelebration,
  } = useHomeLogic({ prefetchAllProgress: viewMode === "bible" });

  type BatchedUpdate = {
    planId: string;
    day: number;
    readingIndex: number;
    completed: boolean;
    readingCount: number;
    totalReadingsCount: number;
    completedChapters?: string[];
  };

  // Micro-batch Bible mode updates to avoid UI jank when applying many updates at once
  // (e.g., "전체 읽기/해제" or rapid consecutive taps).
  const pendingBibleUpdatesRef = useRef<Map<string, BatchedUpdate>>(new Map());
  const bibleFlushTimerRef = useRef<number | null>(null);
  const BIBLE_UPDATE_BATCH_SIZE = 12;
  const BIBLE_UPDATE_FLUSH_DELAY_MS = 0;

  const flushBibleUpdates = () => {
    bibleFlushTimerRef.current = null;
    if (pendingBibleUpdatesRef.current.size === 0) return;

    const entries = Array.from(pendingBibleUpdatesRef.current.entries());
    const batch = entries.slice(0, BIBLE_UPDATE_BATCH_SIZE);

    // Remove from queue first (so enqueueing during mutate won't double-send)
    for (const [k] of batch) pendingBibleUpdatesRef.current.delete(k);

    for (const [, u] of batch) {
      updateReadingMutation.mutate(u);
    }

    if (pendingBibleUpdatesRef.current.size > 0) {
      bibleFlushTimerRef.current = window.setTimeout(flushBibleUpdates, BIBLE_UPDATE_FLUSH_DELAY_MS);
    }
  };

  const enqueueBibleUpdates = (updates: BatchedUpdate[]) => {
    for (const u of updates) {
      // Coalesce: if same reading item is updated multiple times quickly,
      // only keep the last one.
      const k = `${u.planId}:${u.day}:${u.readingIndex}`;
      pendingBibleUpdatesRef.current.set(k, u);
    }

    if (bibleFlushTimerRef.current == null) {
      bibleFlushTimerRef.current = window.setTimeout(flushBibleUpdates, BIBLE_UPDATE_FLUSH_DELAY_MS);
    }
  };

  useEffect(() => {
    return () => {
      if (bibleFlushTimerRef.current != null) {
        window.clearTimeout(bibleFlushTimerRef.current);
        bibleFlushTimerRef.current = null;
      }
      pendingBibleUpdatesRef.current.clear();
    };
  }, []);

  const todaySummary = useMemo(() => {
    const list = combined ?? [];
    const total = list.reduce((acc, r) => acc + (Number.isFinite(r.readingCount) ? r.readingCount : 0), 0);
    let completed = 0;

    for (const r of list) {
      const weight = Number.isFinite(r.readingCount) ? r.readingCount : 0;
      if (weight <= 0) continue;

      if (r.completed) {
        completed += weight;
        continue;
      }

      const all = expandChapters(r.chapters);
      const ratio = all.length > 0 ? Math.min(1, (r.completedChapters?.length ?? 0) / all.length) : 0;
      completed += weight * ratio;
    }

    const safeTotal = total > 0 ? total : 0;
    const safeCompleted = Math.min(safeTotal, completed);
    const remaining = Math.max(0, safeTotal - safeCompleted);
    const percent = safeTotal > 0 ? (safeCompleted / safeTotal) * 100 : 0;

    return {
      total: Math.round(safeTotal * 100) / 100,
      completed: Math.round(safeCompleted * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percent: Math.round(percent),
      isDone: safeTotal > 0 && safeCompleted >= safeTotal - 1e-6,
      hasAny: list.length > 0,
    };
  }, [combined]);

  if (isLoading) {
    return <HomeTabSkeleton />;
  }

  const ProgressRing = ({ percent }: { percent: number }) => {
    const size = 56;
    const stroke = 6;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = c - (clamped / 100) * c;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-muted-foreground/15"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-primary"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen pb-20 relative">
      {completedCelebration && (
        <AchievementReportModal
          plan={completedCelebration.plan}
          progress={completedCelebration.progress}
          dailyStats={[]}
          open={true}
          onClose={dismissCompletedCelebration}
          variant="completed"
          primaryAction={{
            label: "완료된 계획 보기",
            onClick: () => {
              dismissCompletedCelebration();
              setHashTab("add");
            },
          }}
        />
      )}
      <HomeHeader
        incomingRequestsCount={incomingRequestsCount}
        streak={streak ?? 0}
        longestStreak={longestStreak ?? 0}
      />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 space-y-8">
        {/* Greeting Section */}
        <div className="pt-1 font-noto-kr">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            반가워요, <span className="font-medium">{userName}</span>님
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isToday ? "오늘의 읽기를 시작해볼까요?" : "선택한 날짜의 읽기를 확인해요."}
          </p>
        </div>

        {/* Hero Summary Card */}
        <button
          type="button"
          onClick={() => {
            if (!todaySummary.hasAny) return;
            if (viewMode !== "daily") setViewMode("daily");

            window.setTimeout(() => {
              todayReadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }}
          className={cn(
            "w-full text-left rounded-[36px] border border-border/50 bg-card shadow-sm px-7 py-6 transition-all",
            "hover:shadow-md hover:border-border/70 active:scale-[0.99]",
            todaySummary.isDone && "bg-emerald-50/40 border-emerald-200/60",
            !todaySummary.isDone && todaySummary.hasAny && "bg-blue-50/30 border-blue-200/40",
            !todaySummary.hasAny && "cursor-default active:scale-100 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-muted-foreground">오늘의 요약</div>
              <div className="mt-1 text-lg font-bold truncate">
                {todaySummary.hasAny ? (isToday ? "오늘의 성경읽기" : "선택한 날짜 읽기") : "읽기 계획이 없어요"}
              </div>
              {!todaySummary.hasAny ? (
                <div className="mt-2 text-sm text-muted-foreground">계획 탭에서 추가할 수 있어요.</div>
              ) : null}
            </div>

            {todaySummary.hasAny ? (
              <div className="relative">
                <ProgressRing percent={todaySummary.percent} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-sm font-bold text-primary">{todaySummary.percent}%</div>
                </div>
              </div>
            ) : null}
          </div>
        </button>

        {/* Segment Control */}
        <div className="relative w-full rounded-[999px] bg-muted/35 p-1 shadow-xs">
          <div
            aria-hidden="true"
            className={cn(
              "absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-[999px] bg-background shadow-sm transition-transform duration-500",
              viewMode === "bible" && "translate-x-full",
            )}
          />
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v === "daily" || v === "bible") setViewMode(v);
            }}
            variant="default"
            className="relative grid grid-cols-2 w-full bg-transparent"
          >
            <ToggleGroupItem
              value="daily"
              className="rounded-[999px] data-[state=on]:bg-transparent data-[state=on]:text-primary text-muted-foreground"
            >
              일일 읽기
            </ToggleGroupItem>
            <ToggleGroupItem
              value="bible"
              className="rounded-[999px] data-[state=on]:bg-transparent data-[state=on]:text-primary text-muted-foreground"
            >
              성경별 읽기
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Weekly Calendar Strip */}
        <WeeklyCalendar
          weekDates={weekDates}
          viewDate={viewDate}
          today={today}
          isToday={isToday}
          setViewDate={setViewDate}
          handlePrevDay={handlePrevDay}
          handleNextDay={handleNextDay}
          isAllPlansCompletedForDate={isAllPlansCompletedForDate}
          hasAnyPlanForDate={hasAnyPlanForDate}
        />

        {/* Main Content */}
        {plans.length === 0 ? (
          <HomeEmptyState />
        ) : (
          <>
            {!viewPlans.length ? (
              <DayEmptyState
                isToday={isToday}
                setViewDate={setViewDate}
                today={today}
              />
            ) : (
              viewMode === "daily" ? (
                <div ref={todayReadingRef} className="scroll-mt-24">
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
                        totalReadingsCount: target.totalReadingsCount,
                        completedChapters,
                      });
                    }}
                  />
                </div>
              ) : (
                <BibleReadingByBook
                  plans={plans}
                  progressByPlanId={progressByPlanId}
                  applyUpdates={(updates) => {
                    // Fire-and-forget + micro-batch: keep optimistic behavior, but avoid
                    // blocking the UI thread when a lot of updates are triggered at once.
                    enqueueBibleUpdates(updates);
                  }}
                />
              )
            )}

          </>
        )}
      </div>
    </div>
  );
}