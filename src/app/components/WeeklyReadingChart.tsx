import { useMemo } from "react";
import { cn } from "./ui/utils";
import type { Plan } from "../../types/domain";
import { expandChapters } from "../utils/expandChapters";

interface WeeklyReadingChartProps {
  dailyStats: { date: string; count: number }[];
  plan: Plan;
  loading?: boolean;
  className?: string;
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function WeeklyReadingChart({ dailyStats, plan, loading = false, className }: WeeklyReadingChartProps) {
  // 최근 7일 데이터 계산
  const chartData = useMemo(() => {
    const today = new Date();
    const last7Days: {
      date: Date;
      dayLabel: string;
      count: number;
      goal: number;
      isGoalMet: boolean;
      isToday: boolean;
    }[] = [];

    const scheduleMap = new Map<number, Plan["schedule"][number]>();
    plan.schedule.forEach((entry) => scheduleMap.set(entry.day, entry));
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      // 로컬 시간대 기준 YYYY-MM-DD 형식 (AchievementReportModal과 동일)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const stat = dailyStats.find((s) => s.date.split('T')[0] === dateStr);

      // 캘린더 날짜를 계획 day로 변환해서 해당 날짜 목표량 계산
      const planStart = new Date(plan.startDate);
      const diffTime =
        new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
        new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate()).getTime();
      const planDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      let goal = 0;
      if (planDay >= 1 && planDay <= plan.totalDays) {
        const daySchedule = scheduleMap.get(planDay);
        if (daySchedule?.readings) {
          daySchedule.readings.forEach((reading: { chapters: string }) => {
            goal += expandChapters(reading.chapters).length;
          });
        }
      }
      if (goal === 0 && planDay >= 1 && planDay <= plan.totalDays) goal = 1;

      const count = stat?.count ?? 0;
      const isGoalMet = goal > 0 && count + 1e-6 >= goal;
      
      last7Days.push({
        date,
        dayLabel: DAYS_KO[date.getDay()],
        count,
        goal,
        isGoalMet,
        isToday: i === 0,
      });
    }
    
    return last7Days;
  }, [dailyStats, plan]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const maxGoal = Math.max(...chartData.map((d) => d.goal), 1);
  const maxScale = Math.max(maxCount, maxGoal);
  const totalWeek = chartData.reduce((acc, d) => acc + d.count, 0);
  const avgPerDay = (totalWeek / 7).toFixed(1);
  const achievedDays = chartData.filter((d) => d.isGoalMet).length;

  return (
    <div className={cn("bg-card rounded-[32px] border border-border/50 shadow-sm p-6", className)}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">이번 주 읽기</p>
          <p className="text-lg font-bold">{totalWeek}장 완료</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">일 평균</p>
          <p className="text-sm font-semibold text-primary">{avgPerDay}장</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>읽음</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0 w-3 border-t border-dashed border-muted-foreground/70" />
            <span>목표</span>
          </div>
        </div>
      </div>

      {/* 바 차트 */}
      {loading ? (
        <div className="flex items-end justify-between gap-2 h-24 animate-pulse">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col items-center justify-end h-20">
                <div
                  className="w-full max-w-[32px] rounded-t-lg bg-muted/70"
                  style={{ height: `${18 + ((i * 9) % 42)}%` }}
                />
              </div>
              <div className="h-3 w-4 rounded bg-muted/70" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 h-24">
          {chartData.map((day, i) => {
            const countHeightPercent = maxScale > 0 ? (day.count / maxScale) * 100 : 0;
            const goalHeightPercent = maxScale > 0 ? (day.goal / maxScale) * 100 : 0;
            const countText = parseFloat(day.count.toFixed(1));
            const goalText = parseFloat(day.goal.toFixed(1));
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div className="w-full flex flex-col items-center justify-end h-20 relative">
                  {day.goal > 0 && (
                    <div
                      className="absolute w-full px-0.5 pointer-events-none"
                      style={{ bottom: `${goalHeightPercent}%` }}
                    >
                      <div className="w-full border-t border-dashed border-muted-foreground/60" />
                    </div>
                  )}
                  {day.count > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">
                      {day.count}
                    </span>
                  )}
                  <div
                    className={cn(
                      "w-full max-w-[32px] rounded-t-lg transition-all duration-500 relative",
                      day.isToday 
                        ? "bg-primary" 
                        : day.count > 0 
                          ? "bg-primary/40" 
                          : "bg-muted"
                    )}
                    style={{ 
                      height: day.count > 0 ? `${Math.max(countHeightPercent, 8)}%` : "4px",
                    }}
                  />

                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                    <div className="rounded-xl border border-border/60 bg-popover px-2.5 py-1 text-[10px] font-semibold text-popover-foreground shadow-md whitespace-nowrap">
                      {countText} / {goalText}장
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-xs font-medium",
                    day.isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {day.dayLabel}
                  </span>
                  {day.isGoalMet && <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
