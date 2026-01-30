import { expandChapters } from "../utils/expandChapters";
import { Flame, Calendar, TrendingUp, Trophy, ArrowRight, MessageSquareQuote, Check } from "lucide-react";
import { Plan, Progress } from "../../types/domain";
import { startOfTodayLocal, computeTodayDay } from "../pages/mainTabs/dateUtils";
import { computeChaptersTotals } from "../utils/chaptersProgress";
import { useMemo } from "react";
import { cn } from "./ui/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

interface AchievementReportModalProps {
  plan: Plan;
  progress: Progress;
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

    // 4. Weekly Chart Data (Enhanced with Daily Goals)
    // Generate last 7 days with individual goals
    const daysMap = new Map<string, number>();
    const chartData: Array<{ 
      label: string; 
      date: string; 
      count: number; 
      goal: number; 
      isGoalMet: boolean; 
      isToday: boolean;
    }> = [];
    
    // Pre-fill daysMap with dailyStats
    dailyStats.forEach(ds => {
      const dateStr = ds.date.split('T')[0];
      daysMap.set(dateStr, ds.count);
    });

    let maxScale = 1;
    let achievedDaysCount = 0;
    let totalWeeklyRead = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = i === 0 ? "오늘" : `${d.getDate()}일`;
      
      // 1. Get Actual Count
      const count = daysMap.get(ymd) || 0;
      totalWeeklyRead += count;

      // 2. Calculate Goal for this specific date
      // Convert calendar date 'd' to Plan Day
      const planStart = new Date(plan.startDate);
      // Reset hours to avoid DST issues roughly, though we use local dates
      const diffTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - 
                       new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate()).getTime();
      const planDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      let dailyGoal = 0;
      // Only check schedule if within plan range
      if (planDay >= 1 && planDay <= plan.totalDays) {
          const daySched = scheduleMap.get(planDay);
          if (daySched?.readings) {
              daySched.readings.forEach((r: any) => {
                  dailyGoal += expandChapters(r.chapters).length;
              });
          }
      }
      if (dailyGoal === 0 && planDay >= 1 && planDay <= plan.totalDays) dailyGoal = 1; // Fallback for empty days in plan

      const isGoalMet = count >= dailyGoal && dailyGoal > 0;
      if (isGoalMet) achievedDaysCount++;

      // Track max for scaling
      maxScale = Math.max(maxScale, count, dailyGoal);

      chartData.push({
        label,
        date: ymd,
        count,
        goal: dailyGoal,
        isGoalMet,
        isToday: i === 0
      });
    }
    
    // Add some headroom to scale
    maxScale = Math.ceil(maxScale * 1.1);

    return {
      streak: currentStreak,
      projectedEndDate: projectedDate,
      daysAhead: roundedDiffDays,
      achievementRate: completionRateElapsed,
      completedChaptersCount: effectiveCompletedChapters,
      weeklyChart: {
        data: chartData,
        max: maxScale,
        achievedCount: achievedDaysCount,
        weeklyAverage: Math.round((totalWeeklyRead / 7) * 10) / 10
      }
    };
  }, [plan, progress, today, currentDay, dailyStats]);

  const yyyymmdd = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white">
        {/* Header Area */}
        <DialogHeader className="px-8 pt-8 pb-4 text-left">
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">리포트</DialogTitle>
          <DialogDescription className="text-base text-slate-500 font-medium">
            나의 읽기 여정
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 pb-10 space-y-10 overflow-y-auto max-h-[75vh] custom-scrollbar">
          
          {/* 1. Achievement Rate */}
          <div className="pt-2">
             <div className="flex items-end justify-between mb-6">
                <div>
                   <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wide">전체 달성률</div>
                   <div className="text-7xl font-black text-slate-900 tracking-tighter leading-none">
                      {achievementRate}<span className="text-3xl font-bold text-slate-300 ml-1">%</span>
                   </div>
                </div>
                <div className={cn(
                   "px-4 py-2 rounded-full text-xs font-bold border mb-2",
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
                <span className="text-sm font-medium text-slate-500">예상 완료일</span>
                <span className="text-base font-bold text-slate-900">
                   {yyyymmdd(projectedEndDate)}
                </span>
             </div>
          </div>

          {/* 2. Weekly Activity Chart (New Design) */}
          <div>
             <div className="flex items-center justify-between mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-slate-900">주간 활동</h3>
                 </div>
                 {/* Legend */}
                 <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5">
                         <div className="w-2 h-2 rounded-full bg-blue-600 shadow-sm shadow-blue-200"></div>
                         <span className="text-[10px] font-bold text-slate-400">읽음</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                         <div className="w-3 h-0 border-t border-dashed border-slate-400"></div>
                         <span className="text-[10px] font-bold text-slate-400">목표</span>
                     </div>
                 </div>
             </div>
             
             <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 relative">
                 {/* Chart Plot Area */}
                 <div className="relative h-40 flex items-end justify-between gap-2 mb-4">
                    {weeklyChart && weeklyChart.data.map((d, i) => {
                        // Calculate Heights
                        const countHeight = (d.count / weeklyChart.max) * 100;
                        const goalHeight = (d.goal / weeklyChart.max) * 100;
                        
                        return (
                            <div key={i} className="relative w-full h-full flex items-end justify-center group">
                                {/* Bar Container */}
                                <div className="relative w-full h-full flex items-end justify-center">
                                    
                                    {/* 1. Goal Marker (Individual) */}
                                    {d.goal > 0 && (
                                        <div 
                                            className="absolute w-full px-1 z-0 pointer-events-none transition-all duration-500"
                                            style={{ bottom: `${goalHeight}%` }}
                                        >
                                            <div className="w-full border-t border-dashed border-slate-300 group-hover:border-slate-400" />
                                        </div>
                                    )}

                                    {/* 2. Reading Bar */}
                                    <div 
                                        className={cn(
                                            "w-full max-w-[24px] rounded-full transition-all duration-700 ease-out relative flex items-center justify-center",
                                            d.isToday 
                                                ? "bg-blue-600 shadow-lg shadow-blue-200" 
                                                : d.count > 0 ? "bg-slate-200 group-hover:bg-slate-300" : "bg-slate-100"
                                        )}
                                        style={{ height: `${Math.max(countHeight, 4)}%` }} // Min height for visual
                                    >
                                        {/* Check Icon if Met */}
                                        {d.isGoalMet && (
                                            <div className="animate-in fade-in zoom-in duration-300 delay-150">
                                                 <Check className={cn("w-3 h-3 stroke-[3]", d.isToday ? "text-white" : "text-slate-400")} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        <div className="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-xl whitespace-nowrap">
                                            {d.count} / {d.goal}장
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                 </div>

                 {/* X-Axis Labels & Indicators */}
                 <div className="flex justify-between gap-2">
                    {weeklyChart && weeklyChart.data.map((d, i) => {
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                                {/* Status Dot */}
                                <div className={cn(
                                    "w-1 h-1 rounded-full transition-colors",
                                    d.isGoalMet ? "bg-blue-500" : "bg-transparent"
                                )}></div>
                                
                                {/* Date Label */}
                                <div className={cn(
                                    "text-[10px] font-bold text-center",
                                    d.isToday ? "text-blue-600" : "text-slate-400"
                                )}>
                                    {d.label.replace('일', '')}
                                </div>
                            </div>
                        );
                    })}
                 </div>
             </div>

             {/* Summary Dashboard */}
             <div className="grid grid-cols-2 gap-4 mt-6">
                 <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                         <Check className="w-5 h-5" />
                     </div>
                     <div>
                         <div className="text-2xl font-black text-slate-900">
                             {weeklyChart?.achievedCount ?? 0}<span className="text-sm font-medium text-slate-400">/7</span>
                         </div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">목표 달성</div>
                     </div>
                 </div>

                 <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                         <TrendingUp className="w-5 h-5" />
                     </div>
                     <div>
                         <div className="text-2xl font-black text-slate-900">
                             {weeklyChart?.weeklyAverage ?? 0}<span className="text-xs font-bold text-slate-400 ml-0.5">장</span>
                         </div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">일일 평균</div>
                     </div>
                 </div>
             </div>
          </div>

          {/* 3. Streak & Count (Simplified) */}
          <div className="grid grid-cols-2 gap-4">
             <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between h-36 relative overflow-hidden group">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center z-10">
                   <Flame className={cn("w-5 h-5", streak > 0 ? "text-red-500 fill-red-500" : "text-slate-300")} />
                </div>
                <div className="z-10">
                   <div className="text-3xl font-black text-slate-900">
                      {streak}<span className="text-sm font-bold text-slate-400 ml-1">일</span>
                   </div>
                   <div className="text-xs font-bold text-slate-500 mt-1">연속 읽기</div>
                </div>
                {/* Deco */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
             </div>

             <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between h-36 relative overflow-hidden group">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 z-10">
                   <Trophy className="w-5 h-5" />
                </div>
                <div className="z-10">
                   <div className="text-3xl font-black text-slate-900">
                      {parseFloat(completedChaptersCount.toFixed(1))}<span className="text-sm font-bold text-slate-400 ml-1">장</span>
                   </div>
                   <div className="text-xs font-bold text-slate-500 mt-1">총 읽은 양</div>
                </div>
                {/* Deco */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-yellow-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
             </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}