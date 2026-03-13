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
  const safeCompleted = formatChapterCount(completedChapters);
  const safeTotal = formatChapterCount(totalChapters);

  return (
    <div className={cn("bg-card text-card-foreground rounded-[32px] border border-border/50 shadow-sm p-6 group transition-all hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">진행상황</p>
          <p className="mt-1 text-2xl font-bold tracking-tight leading-none">
            {safeCompleted}
            <span className="text-base font-semibold text-muted-foreground"> / {safeTotal}장</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10">
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

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/20 px-2 py-0.5">완료 {safeCompleted}장</span>
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/20 px-2 py-0.5">전체 {safeTotal}장</span>
      </div>
    </div>
  );
}

