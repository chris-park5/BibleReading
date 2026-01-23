import { TodayReading } from "../../components/TodayReading";
import { DayEmptyState } from "./home/DayEmptyState";
import { HomeEmptyState } from "./home/HomeEmptyState";
import { HomeHeader } from "./home/HomeHeader";
import { ReadingHistorySection } from "./home/ReadingHistorySection";
import { useHomeLogic } from "./home/useHomeLogic";
import { WeeklyCalendar } from "./home/WeeklyCalendar";

export function HomeTab() {
  const {
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
    isToday,
    setViewDate,
    handlePrevDay,
    handleNextDay,
    updateReadingMutation,
    isAllPlansCompletedForDate,
    hasAnyPlanForDate,
  } = useHomeLogic();

  return (
    <div className="min-h-screen pb-20 relative">
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

            <div className="pt-6 border-t border-border/50">
              <ReadingHistorySection />
            </div>
          </>
        )}
      </div>
    </div>
  );
}