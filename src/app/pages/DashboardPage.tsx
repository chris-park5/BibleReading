import { useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { usePlanStore } from '../../stores/plan.store';
import { usePlan } from '../../hooks/usePlans';
import { useProgress } from '../../hooks/useProgress';
import { TodayReading } from '../components/TodayReading';
import { ProgressChart } from '../components/ProgressChart';
import { ReadingHistory } from '../components/ReadingHistory';
import { useAuthStore } from '../../stores/auth.store';
import * as friendService from '../../services/friendService';
import { computeChaptersTotals } from "../utils/chaptersProgress";

export function DashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { 
    selectedPlanId, 
    currentDay, 
    setCurrentDay,
    nextDay,
    prevDay,
  } = usePlanStore();

  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data: friendsData } = useQuery({
    queryKey: ['friends', userId],
    queryFn: friendService.getFriends,
    enabled: !!userId,
  });
  const incomingRequestsCount = friendsData?.incomingRequests?.length ?? 0;
  
  const selectedPlan = usePlan(selectedPlanId);
  const { progress, toggleReading } = useProgress(selectedPlanId);

  if (!selectedPlan || !progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const todayReading = selectedPlan.schedule.find((s) => s.day === currentDay);
  
  // DB 스키마 한계로 인해 completedReadingsByDay가 비어있을 수 있음
  // 따라서 completedDays에 포함되어 있다면 모든 reading이 완료된 것으로 간주
  const isDayCompleted = progress.completedDays.includes(currentDay);
  const completedIndices = progress.completedReadingsByDay?.[String(currentDay)] ?? [];
  const completedSet = new Set(completedIndices);
  
  const completedByIndex = (todayReading?.readings ?? []).map((_, i) => 
    isDayCompleted || completedSet.has(i)
  );
  
  const readingCount = todayReading?.readings.length ?? 0;

  const handleNextDay = () => {
    if (currentDay < selectedPlan.totalDays) {
      nextDay();
    }
  };

  const handlePrevDay = () => {
    if (currentDay > 1) {
      prevDay();
    }
  };

  const { totalChapters, completedChapters } = useMemo(() => {
    return computeChaptersTotals({ schedule: selectedPlan.schedule, progress });
  }, [selectedPlan.schedule, progress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {!embedded && (
        <header className="bg-white border-b-2 border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1>{selectedPlan.name}</h1>
                <p className="text-gray-600">{selectedPlan.totalDays}일 계획</p>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {incomingRequestsCount > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
            <div>
              <p>새 친구 요청이 있습니다</p>
              <p className="text-sm text-gray-600">{incomingRequestsCount}개</p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.hash = "#/friends";
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              확인하기
            </button>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Reading */}
            {todayReading && (
              <div>
                <TodayReading
                  day={currentDay}
                  readings={todayReading.readings}
                  completedByIndex={completedByIndex}
                  onToggleReading={(readingIndex, completed) =>
                    toggleReading({
                      day: currentDay,
                      readingIndex,
                      completed,
                      readingCount,
                    })
                  }
                />

                {/* Navigation */}
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={handlePrevDay}
                    disabled={currentDay === 1}
                    className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    이전 날
                  </button>
                  <button
                    onClick={handleNextDay}
                    disabled={currentDay === selectedPlan.totalDays}
                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    다음 날
                  </button>
                </div>
              </div>
            )}

            {/* Progress Chart */}
            <ProgressChart
              totalChapters={totalChapters}
              completedChapters={completedChapters}
            />
          </div>

          {/* Right Column - Reading History */}
          <div className="lg:col-span-1">
            <ReadingHistory
              completedDays={new Set(progress.completedDays)}
              partialDays={new Set<number>()}
              currentDay={currentDay}
              onDayClick={setCurrentDay}
              totalDays={selectedPlan.totalDays}
              schedule={selectedPlan.schedule}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

