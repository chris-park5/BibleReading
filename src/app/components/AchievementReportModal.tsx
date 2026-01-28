import { Flame, Calendar, TrendingUp, Trophy, ArrowRight, MessageSquareQuote } from "lucide-react";
import { Plan, ReadingProgress } from "../../types/domain";
import { startOfTodayLocal, computeTodayDay } from "../pages/mainTabs/dateUtils";
import { computeChaptersTotals } from "../utils/chaptersProgress";
import { useMemo } from "react";
import { cn } from "./ui/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

interface AchievementReportModalProps {
  plan: Plan;
  progress: ReadingProgress;
  onClose: () => void;
  open: boolean;
}

export function AchievementReportModal({ plan, progress, onClose, open }: AchievementReportModalProps) {
  const today = startOfTodayLocal();
  const currentDay = computeTodayDay(plan, today);

  // 1. Calculate Stats
  const { 
    streak, 
    projectedEndDate, 
    daysAhead,
    achievementRate,
    completedChaptersCount
  } = useMemo(() => {
    // --- Consistency with ProgressTab ---
    const elapsedDays = Math.max(0, Math.min(plan.totalDays, currentDay));
    const { completedChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
    const { totalChapters: elapsedChapters } = computeChaptersTotals({
      schedule: plan.schedule,
      progress,
      upToDay: elapsedDays,
    });
    
    // "달성률" in ProgressTab = (completed / elapsed) * 100
    const completionRateElapsed = elapsedChapters === 0 ? 0 : Math.round((completedChapters / elapsedChapters) * 100);

    const completedDaysSet = new Set(progress.completedDays || []);
    const completedReadingsMap = progress.completedReadingsByDay || {};
    const completedChaptersMap = progress.completedChaptersByDay || {};

    let currentStreak = 0;
    let checkDay = currentDay;
    
    const isTodayDone = completedDaysSet.has(currentDay) || !!completedReadingsMap[String(currentDay)]?.length;
    if (!isTodayDone && checkDay > 1) checkDay--;

    if (checkDay < 1) checkDay = 1;
    if (checkDay > plan.totalDays) checkDay = plan.totalDays;

    while (checkDay >= 1) {
      const isDone = completedDaysSet.has(checkDay);
      const hasReadings = !!completedReadingsMap[String(checkDay)]?.length;
      const hasChapters = Object.keys(completedChaptersMap[String(checkDay)] || {}).length > 0;
      
      if (isDone || hasReadings || hasChapters) {
        currentStreak++;
        checkDay--;
      } else {
        break;
      }
    }

    const { totalChapters: totalPlanChapters } = computeChaptersTotals({ schedule: plan.schedule, progress });
    const remainingChapters = totalPlanChapters - completedChapters;
    
    // Calculate Global Pace (Chapters per Day) based on elapsed time
    const planStartDate = new Date(plan.startDate);
    const msSinceStart = today.getTime() - planStartDate.getTime();
    // Days since start (0 if today is start date)
    const daysSinceStart = Math.max(0, Math.floor(msSinceStart / (1000 * 60 * 60 * 24)));
    
    // Use completedChaptersCount for pace. 
    // If started today (days=0), use 1 as divisor to avoid Infinity, but effectively it's "completed today".
    // If completed 0, pace is 0.
    // If pace is 0, use planned average pace as fallback for projection.
    const currentGlobalPace = completedChapters / Math.max(1, daysSinceStart + 1);
    
    const plannedAvgPace = totalPlanChapters / plan.totalDays;
    
    // Effective pace for projection: Use current pace if valid, otherwise planned pace
    const effectivePace = currentGlobalPace > 0 ? currentGlobalPace : plannedAvgPace;
    
    const daysLeft = Math.ceil(remainingChapters / (effectivePace || 1));
    
    const projectedDate = new Date(today);
    projectedDate.setDate(projectedDate.getDate() + daysLeft);

    // Days Ahead/Behind calculation
    const expectedChapters = (currentDay / plan.totalDays) * totalPlanChapters;
    const diffChapters = completedChapters - expectedChapters;
    const diffDays = Math.round(diffChapters / (plannedAvgPace || 1));

    return {
      streak: currentStreak,
      projectedEndDate: projectedDate,
      daysAhead: diffDays,
      achievementRate: completionRateElapsed,
      completedChaptersCount: completedChapters 
    };
  }, [plan, progress, today, currentDay]);

  const yyyymmdd = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        {/* Header Area */}
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">리포트</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 font-medium">
            나의 읽기 여정
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          
          {/* 1. Achievement Rate (Largest Number - Synced with ProgressTab) */}
          <div className="pt-2">
             <div className="flex items-end justify-between mb-6">
                <div>
                   <div className="text-sm font-semibold text-slate-400 mb-1">달성률</div>
                   <div className="text-6xl font-black text-slate-900 tracking-tight leading-none">
                      {achievementRate}<span className="text-2xl font-medium text-slate-400 ml-1">%</span>
                   </div>
                </div>
                {/* Days Ahead/Behind Badge */}
                <div className={cn(
                   "px-3 py-1.5 rounded-full text-xs font-bold border",
                   daysAhead > 0 
                     ? "bg-blue-50 border-blue-100 text-blue-600" 
                     : daysAhead < 0 
                       ? "bg-slate-50 border-slate-200 text-slate-600" 
                       : "bg-slate-50 border-slate-200 text-slate-600"
                )}>
                   {daysAhead > 0 ? (
                      `+${daysAhead}일 앞서가는 중`
                   ) : daysAhead < 0 ? (
                      `${Math.abs(daysAhead)}일 늦음`
                   ) : (
                      "계획대로 진행 중"
                   )}
                </div>
             </div>

             <div className="flex items-center justify-between py-4 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-500">예상 완료일</span>
                <span className="text-base font-bold text-slate-900">
                   {yyyymmdd(projectedEndDate)}
                </span>
             </div>
          </div>

          {/* 2. Streak & Count (Red Flame & Synced Chapters) */}
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 rounded-2xl border border-slate-100 flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                   <Flame className={cn("w-4 h-4", streak > 0 ? "text-red-500 fill-red-500" : "text-slate-300")} />
                </div>
                <div>
                   <div className="text-2xl font-bold text-slate-900">
                      {streak}<span className="text-sm font-normal text-slate-400 ml-1">일</span>
                   </div>
                   <div className="text-xs font-medium text-slate-500 mt-1">연속 읽기</div>
                </div>
             </div>

             <div className="p-4 rounded-2xl border border-slate-100 flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                   <Trophy className="w-4 h-4" />
                </div>
                <div>
                   <div className="text-2xl font-bold text-slate-900">
                      {parseFloat(completedChaptersCount.toFixed(1))}<span className="text-sm font-normal text-slate-400 ml-1">장</span>
                   </div>
                   <div className="text-xs font-medium text-slate-500 mt-1">누적 완료</div>
                </div>
             </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
