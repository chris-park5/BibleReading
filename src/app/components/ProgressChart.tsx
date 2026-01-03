import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProgressChartProps {
  totalDays: number;
  completedDays: number;
  chartData: Array<{ day: number; completed: number }>;
}

export function ProgressChart({
  totalDays,
  completedDays,
  chartData,
}: ProgressChartProps) {
  const percentage = Math.round((completedDays / totalDays) * 100);

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2>진행 상황</h2>
          <p className="text-gray-600">
            {completedDays}일 / {totalDays}일 완료
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

      {chartData.length > 1 && (
        <div className="h-48 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                label={{ value: "일", position: "insideBottomRight", offset: -5 }}
              />
              <YAxis
                label={{ value: "완료", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: number) => [`${value}일`, "완료"]}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
