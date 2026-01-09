import { TrendingUp } from "lucide-react";

interface ProgressChartProps {
  totalChapters: number;
  completedChapters: number;
}

export function ProgressChart({
  totalChapters,
  completedChapters,
}: ProgressChartProps) {
  const percentage = totalChapters <= 0 ? 0 : Math.round((completedChapters / totalChapters) * 100);

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2>진행 상황</h2>
          <p className="text-muted-foreground">
            {completedChapters}장 / {totalChapters}장 완료
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="text-primary">{percentage}%</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

