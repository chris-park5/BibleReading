import { Calendar as CalendarIcon } from "lucide-react";

interface DayEmptyStateProps {
  isToday: boolean;
  setViewDate: (date: Date) => void;
  today: Date;
}

export function DayEmptyState({
  isToday,
  setViewDate,
  today,
}: DayEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
      <CalendarIcon className="w-10 h-10 text-muted-foreground/50" />
      <div>
        <p className="font-medium">이 날짜에는 예정된 읽기가 없습니다</p>
        <p className="text-sm text-muted-foreground">
          쉬어가는 날이거나 계획 범위를 벗어났습니다.
        </p>
      </div>
      {!isToday && (
        <button
          onClick={() => setViewDate(today)}
          className="text-primary text-sm font-medium hover:underline"
        >
          오늘로 돌아가기
        </button>
      )}
    </div>
  );
}
