import { TrendingUp } from "lucide-react";
import { cn } from "./ui/utils";

interface ProgressChartProps {
  totalChapters: number;
  completedChapters: number;
  className?: string;
}

function formatChapterCount(val: number) {
  return parseFloat(val.toFixed(1));
}

export function ProgressChart({
  totalChapters,
  completedChapters,
  className,
}: ProgressChartProps) {
  const percentage = totalChapters <= 0 ? 0 : Math.round((completedChapters / totalChapters) * 100);

  return (
    <div className={cn("bg-card text-card-foreground rounded-xl border-none shadow-sm p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">진행상황</p>
          <p className="text-lg font-semibold">
            {formatChapterCount(completedChapters)}장 / {formatChapterCount(totalChapters)}장 완료
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">{percentage}%</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

