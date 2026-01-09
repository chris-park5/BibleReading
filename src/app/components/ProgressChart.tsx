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
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2>진행 상황</h2>
          <p className="text-gray-600">
            {completedChapters}장 / {totalChapters}장 완료
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <span className="text-blue-600">{percentage}%</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

