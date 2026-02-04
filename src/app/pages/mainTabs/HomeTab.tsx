import { useEffect, useRef, useState } from "react";
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

  if (isLoading) {
    return <HomeTabSkeleton />;
  }

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

      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-4">
        {/* Greeting Section (Non-sticky) */}
        <div>
          <h1 className="text-xl font-bold">반가워요, {userName}님!</h1>
        </div>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => {
            if (v === "daily" || v === "bible") setViewMode(v);
          }}
          variant="outline"
          className="w-full"
        >
          <ToggleGroupItem value="daily">일일 읽기</ToggleGroupItem>
          <ToggleGroupItem value="bible">성경별 읽기</ToggleGroupItem>
        </ToggleGroup>

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