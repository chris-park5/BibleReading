import { expandChapters } from "../utils/expandChapters";
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
  dailyStats?: { date: string; count: number }[];
  onClose: () => void;
  open: boolean;
}

export function AchievementReportModal({ plan, progress, dailyStats = [], onClose, open }: AchievementReportModalProps) {
  const today = startOfTodayLocal();
  const currentDay = computeTodayDay(plan, today);

  // 1. Calculate Stats
  const { 
    streak, 
    projectedEndDate, 
    daysAhead,
    achievementRate,
    completedChaptersCount,
    weeklyChart
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
    
    // Use computed completedChapters as the source of truth to ensure consistency with
    // corrected counting logic (e.g. handling "7-9" as 3 chapters)
    const effectiveCompletedChapters = completedChapters;

    // --- Advanced Calculation: Cumulative Schedule ---
    // Build cumulative chapter counts to handle variable daily amounts
    // cumulativeSchedule[d] = Total chapters scheduled from Day 1 to Day d
    const cumulativeSchedule = new Float32Array(plan.totalDays + 1);
    
    let runningTotal = 0;
    // We assume plan.schedule is not necessarily sorted or complete for all days, so we map it first
    const scheduleMap = new Map<number, any>();
    plan.schedule.forEach(s => scheduleMap.set(s.day, s));

    for (let d = 1; d <= plan.totalDays; d++) {
      const entry = scheduleMap.get(d);
      let dayCount = 0;
      if (entry && entry.readings) {
        for (const r of entry.readings) {
          const expanded = expandChapters(r.chapters);
          dayCount += expanded.length;
        }
      }
      runningTotal += dayCount;
      cumulativeSchedule[d] = runningTotal;
    }

    // 1. Calculate Effective Plan Day (interpolated)
    // Find largest d where cumulativeSchedule[d] <= effectiveCompletedChapters
    let effectivePlanDay = 0;
    
    // Optimization: start checking from roughly where we expect (proportional)
    // But simple loop is fast enough for typical plan size (365 days)
    for (let d = 1; d <= plan.totalDays; d++) {
      if (cumulativeSchedule[d] <= effectiveCompletedChapters) {
        effectivePlanDay = d;
      } else {
        // We are strictly less than this day's cumulative.
        // Interpolate: how much of day d did we finish?
        const prevCum = cumulativeSchedule[d - 1];
        const dayTotal = cumulativeSchedule[d] - prevCum;
        const remainder = effectiveCompletedChapters - prevCum;
        
        if (dayTotal > 0) {
           effectivePlanDay = (d - 1) + (remainder / dayTotal);
        } else {
           effectivePlanDay = d - 1; 
        }
        break;
      }
    }
    
    // If completed more than plan total (e.g. bugs or extra reading not in schedule?), cap at totalDays
    if (effectiveCompletedChapters >= cumulativeSchedule[plan.totalDays]) {
        effectivePlanDay = plan.totalDays;
    }

    // 2. Days Ahead / Behind
    // Compare Effective Plan Day vs Real Elapsed Days
    const planStartDate = new Date(plan.startDate);
    const msSinceStart = today.getTime() - planStartDate.getTime();
    const daysSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60 * 24));
    
    // If started today (daysSinceStart=0), we have "1 day" of scheduled time elapsed effectively
    // because "Day 1" is assigned to "Start Date".
    const realElapsedDays = Math.max(1, daysSinceStart + 1);

    // Days Ahead = (Work Done in Plan Days) - (Real Time Passed in Days)
    const diffDays = Math.round((effectivePlanDay - realElapsedDays) * 10) / 10;
    const roundedDiffDays = Math.round(diffDays); 

    // 3. Projected End Date based on "Plan Days per Real Day" pace
    // Pace = EffectivePlanDays / RealElapsedDays
    const currentPace = effectivePlanDay / realElapsedDays;
    
    // If pace is 0 (started today, read nothing), assume pace = 1 (on track) to give a reasonable projection
    // If pace is very slow, projection will be far out.
    const effectivePace = currentPace > 0 ? currentPace : 1;
    
    const remainingPlanDays = Math.max(0, plan.totalDays - effectivePlanDay);
    const daysLeftReal = Math.ceil(remainingPlanDays / effectivePace);
    
    const projectedDate = new Date(today);
    projectedDate.setDate(projectedDate.getDate() + daysLeftReal);

    // 4. Weekly Chart Data
    // Generate last 7 days
    const daysMap = new Map<string, number>();
    const last7Days: string[] = [];
    const dateLabels: string[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = i === 0 ? "오늘" : `${d.getMonth() + 1}/${d.getDate()}`;
      last7Days.push(ymd);
      dateLabels.push(label);
      daysMap.set(ymd, 0);
    }

    // Populate counts from history (Preferred for accuracy)
    // We track which days have history data to avoid double-counting or overwriting with stale dailyStats
    const daysWithHistory = new Set<string>();
    
    if (progress.history && progress.history.length > 0) {
      // Create a lookup for reading weights
      const readingWeights = new Map<string, number>();
      plan.schedule.forEach(s => {
        if (!s.readings) return;
        s.readings.forEach((r, idx) => {
          // Use explicit string conversion for keys
          const key = `${s.day}-${idx}`;
          const count = expandChapters(r.chapters).length;
          readingWeights.set(key, count);
        });
      });

      progress.history.forEach(h => {
        if (!h.completedAt) return;
        
        const date = new Date(h.completedAt);
        if (isNaN(date.getTime())) return; 

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const localYmd = `${y}-${m}-${d}`;

        if (daysMap.has(localYmd)) {
          const key = `${h.day}-${h.readingIndex}`;
          const count = readingWeights.get(key) || 1;
          daysMap.set(localYmd, (daysMap.get(localYmd) || 0) + count);
          daysWithHistory.add(localYmd);
        }
      });
    }
    
    // Merge dailyStats for days where we have NO history data
    // This allows using Server Stats for days where local history might be missing (e.g. old data or sync issues),
    // while preferring History (which includes optimistic updates) for days where we have it.
    dailyStats.forEach(ds => {
      // Normalize date just in case it comes with time
      const dateStr = ds.date.split('T')[0];
      if (daysMap.has(dateStr) && !daysWithHistory.has(dateStr)) {
         daysMap.set(dateStr, ds.count);
      }
    });

    const weeklyCounts = last7Days.map(ymd => daysMap.get(ymd) || 0);
    const maxCount = Math.max(...weeklyCounts, 1); // Avoid div by 0

    // Today's Goal (approximate)
    // Find the 'next' unfinished day's total chapters? 
    // Or just the current calculated plan day's total?
    // Let's use the current Effective Plan Day's integer floor as the "Target Day"
    const targetDayIndex = Math.min(plan.totalDays, Math.ceil(effectivePlanDay || 1));
    const targetDaySchedule = scheduleMap.get(targetDayIndex);
    let todayGoal = 0;
    if (targetDaySchedule?.readings) {
        targetDaySchedule.readings.forEach((r: any) => {
            todayGoal += expandChapters(r.chapters).length;
        });
    }
    // If goal is 0 (e.g. rest day or invalid), assume 1 to show something
    if (todayGoal === 0) todayGoal = 1;

    return {
      streak: currentStreak,
      projectedEndDate: projectedDate,
      daysAhead: roundedDiffDays,
      achievementRate: completionRateElapsed,
      completedChaptersCount: effectiveCompletedChapters,
      weeklyChart: {
        labels: dateLabels,
        data: weeklyCounts,
        max: maxCount,
        todayGoal
      }
    };
  }, [plan, progress, today, currentDay, dailyStats]);

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
          
          {/* 1. Achievement Rate */}
          <div className="pt-2">
             <div className="flex items-end justify-between mb-6">
                <div>
                   <div className="text-sm font-semibold text-slate-400 mb-1">달성률</div>
                   <div className="text-6xl font-black text-slate-900 tracking-tight leading-none">
                      {achievementRate}<span className="text-2xl font-medium text-slate-400 ml-1">%</span>
                   </div>
                </div>
                <div className={cn(
                   "px-3 py-1.5 rounded-full text-xs font-bold border",
                   daysAhead > 0 
                     ? "bg-blue-50 border-blue-100 text-blue-600" 
                     : daysAhead < 0 
                       ? "bg-slate-50 border-slate-200 text-slate-600" 
                       : "bg-slate-50 border-slate-200 text-slate-600"
                )}>
                   {daysAhead > 0 ? `+${daysAhead}일 앞서가는 중` : daysAhead < 0 ? `${Math.abs(daysAhead)}일 늦음` : "계획대로 진행 중"}
                </div>
             </div>

             <div className="flex items-center justify-between py-4 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-500">예상 완료일(수정중)</span>
                <span className="text-base font-bold text-slate-900">
                   {yyyymmdd(projectedEndDate)}
                </span>
             </div>
          </div>

          {/* 2. Weekly Activity Chart */}
          <div>
             <div className="flex items-center justify-between mb-4">
                 <h3 className="text-base font-bold text-slate-900">주간 활동 "수정중"</h3>
                 <div className="text-xs text-slate-500">
                     오늘 목표: <span className="font-bold text-slate-900">{completedChaptersCount > 0 && weeklyChart ? weeklyChart.todayGoal : "-"}장</span>
                 </div>
             </div>
             <div className="bg-slate-50 rounded-2xl p-4">
                 <div className="flex items-end justify-between h-32 gap-2">
                    {weeklyChart && weeklyChart.data.map((count, i) => {
                        const isToday = i === 6;
                        const isGoalMet = isToday && count >= weeklyChart.todayGoal;
                        // Determine height percentage (min 10% for visibility if >0)
                        const percentage = count === 0 ? 0 : Math.max(15, (count / Math.max(weeklyChart.max, weeklyChart.todayGoal)) * 100);
                        
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="relative w-full flex items-end justify-center h-full">
                                    <div 
                                        className={cn(
                                            "w-full rounded-t-md transition-all duration-500 ease-out",
                                            isToday 
                                                ? (isGoalMet ? "bg-blue-500 shadow-blue-200" : "bg-blue-400/60") 
                                                : "bg-slate-200 hover:bg-slate-300"
                                        )}
                                        style={{ height: `${percentage}%` }}
                                    >
                                        {count > 0 && (
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-sm border">
                                                {count}장
                                            </div>
                                        )}
                                    </div>
                                    {/* Goal Line Marker for Today */}
                                    {isToday && (
                                        <div 
                                            className="absolute w-full border-t-2 border-dashed border-blue-300/50 z-0 pointer-events-none"
                                            style={{ bottom: `${(weeklyChart.todayGoal / Math.max(weeklyChart.max, weeklyChart.todayGoal)) * 100}%` }}
                                        />
                                    )}
                                </div>
                                <div className={cn(
                                    "text-[10px] font-medium",
                                    isToday ? "text-blue-600" : "text-slate-400"
                                )}>
                                    {weeklyChart.labels[i]}
                                </div>
                            </div>
                        );
                    })}
                 </div>
             </div>
          </div>

          {/* 3. Streak & Count */}
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
                   <div className="text-xs font-medium text-slate-500 mt-1">완료</div>
                </div>
             </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}