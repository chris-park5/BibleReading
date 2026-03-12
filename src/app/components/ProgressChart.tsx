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
    <div className={cn("bg-card text-card-foreground rounded-[32px] border border-border/50 shadow-sm p-6 group", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">진행상황</p>
          <p className="text-lg font-semibold">
            {formatChapterCount(completedChapters)}장 / {formatChapterCount(totalChapters)}장 완료
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{percentage}%</span>
          </div>
          <div className="text-muted-foreground/50 group-hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
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

