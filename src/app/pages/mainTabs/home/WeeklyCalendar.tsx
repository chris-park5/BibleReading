import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../components/ui/utils";

type CompletionStatus = 'complete' | 'partial' | 'incomplete' | null;

interface WeeklyCalendarProps {
  weekDates: Date[];
  viewDate: Date;
  today: Date;
  isToday: boolean;
  setViewDate: (date: Date) => void;
  handlePrevDay: () => void;
  handleNextDay: () => void;
  isAllPlansCompletedForDate: (date: Date) => boolean;
  hasAnyPlanForDate: (date: Date) => boolean;
  getCompletionStatusForDate: (date: Date) => CompletionStatus;
}

export function WeeklyCalendar({
  weekDates,
  viewDate,
  today,
  isToday,
  setViewDate,
  handlePrevDay,
  handleNextDay,
  isAllPlansCompletedForDate,
  hasAnyPlanForDate,
  getCompletionStatusForDate,
}: WeeklyCalendarProps) {
  return (
    <div>
      <div className="bg-card border border-border/50 shadow-sm rounded-[32px] p-2 relative">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-1.5 sm:p-2 hover:bg-muted/60 rounded-[18px] transition-colors text-muted-foreground"
            title="이전 날"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 grid grid-cols-7 gap-1 items-center">
            {weekDates.map((date, i) => {
              const isSelected = date.getTime() === viewDate.getTime();
              const isDateToday = date.getTime() === today.getTime();
              const completionStatus = getCompletionStatusForDate(date);
              const hasPlan = hasAnyPlanForDate(date);

              // 점 색깔 결정
              const getDotColor = () => {
                if (!hasPlan || !completionStatus) return "bg-transparent";
                switch (completionStatus) {
                  case 'complete':
                    return "bg-emerald-500";
                  case 'partial':
                    return "bg-amber-500";
                  case 'incomplete':
                    return "bg-muted-foreground/40";
                  default:
                    return "bg-transparent";
                }
              };

              return (
                <button
                  key={i}
                  onClick={() => setViewDate(date)}
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-14 rounded-[20px] sm:rounded-[22px] transition-all duration-200 min-w-0",
                    isSelected && "bg-primary/12 ring-1 ring-primary/18 shadow-sm",
                    !isSelected && isDateToday && "bg-primary/6 ring-1 ring-primary/15",
                    !isSelected && !isDateToday && "hover:bg-muted/60",
                    isSelected ? "text-primary" : isDateToday ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="text-[10px] font-medium opacity-80">
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                    }).format(date)}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      isSelected && "text-primary"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* Dot indicator */}
                  <div className="mt-1 h-1.5 w-1.5 rounded-full overflow-hidden">
                    {hasPlan && completionStatus && (
                      <div className={cn("h-full w-full rounded-full", getDotColor())} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextDay}
            className="p-1.5 sm:p-2 hover:bg-muted/60 rounded-[18px] transition-colors text-muted-foreground"
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
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 bg-primary/6 px-4 py-2 rounded-[999px]"
          >
            오늘 날짜로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
