import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../components/ui/utils";

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
}: WeeklyCalendarProps) {
  return (
    <div>
      <div className="bg-card/50 border border-border/50 rounded-xl p-1 relative">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            title="이전 날"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 flex justify-between items-center">
            {weekDates.map((date, i) => {
              const isSelected = date.getTime() === viewDate.getTime();
              const isDateToday = date.getTime() === today.getTime();
              const isCompleted = isAllPlansCompletedForDate(date);
              const hasPlan = hasAnyPlanForDate(date);

              return (
                <button
                  key={i}
                  onClick={() => setViewDate(date)}
                  className={cn(
                    "flex flex-col items-center justify-center w-9 h-14 rounded-lg transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "hover:bg-muted text-muted-foreground"
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
                      isSelected && "text-white"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* Dot indicator */}
                  <div className="mt-1 h-1 w-1 rounded-full overflow-hidden">
                    {hasPlan && (
                      <div
                        className={cn(
                          "h-full w-full rounded-full",
                          isCompleted
                            ? isSelected
                              ? "bg-white"
                              : "bg-green-500"
                            : isDateToday && !isSelected
                            ? "bg-primary"
                            : "bg-transparent"
                        )}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
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
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 bg-primary/5 px-3 py-1 rounded-full"
          >
            오늘 날짜로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
