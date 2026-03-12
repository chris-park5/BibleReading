import { useMemo } from "react";
import { cn } from "./ui/utils";

interface WeeklyReadingChartProps {
  dailyStats: { date: string; count: number }[];
  className?: string;
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function WeeklyReadingChart({ dailyStats, className }: WeeklyReadingChartProps) {
  // 최근 7일 데이터 계산
  const chartData = useMemo(() => {
    const today = new Date();
    const last7Days: { date: Date; dayLabel: string; count: number; isToday: boolean }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      // 로컬 시간대 기준 YYYY-MM-DD 형식 (AchievementReportModal과 동일)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const stat = dailyStats.find((s) => s.date.split('T')[0] === dateStr);
      
      last7Days.push({
        date,
        dayLabel: DAYS_KO[date.getDay()],
        count: stat?.count ?? 0,
        isToday: i === 0,
      });
    }
    
    return last7Days;
  }, [dailyStats]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const totalWeek = chartData.reduce((acc, d) => acc + d.count, 0);
  const avgPerDay = (totalWeek / 7).toFixed(1);

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

      {/* 바 차트 */}
      <div className="flex items-end justify-between gap-2 h-24">
        {chartData.map((day, i) => {
          const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col items-center justify-end h-20">
                {day.count > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground mb-1">
                    {day.count}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full max-w-[32px] rounded-t-lg transition-all duration-500",
                    day.isToday 
                      ? "bg-primary" 
                      : day.count > 0 
                        ? "bg-primary/40" 
                        : "bg-muted"
                  )}
                  style={{ 
                    height: day.count > 0 ? `${Math.max(heightPercent, 8)}%` : "4px",
                  }}
                />
              </div>
              <span className={cn(
                "text-xs font-medium",
                day.isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {day.dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
