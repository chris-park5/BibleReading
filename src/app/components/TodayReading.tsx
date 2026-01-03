import { BookOpenCheck, CheckCircle, Circle } from "lucide-react";

interface Reading {
  book: string;
  chapters: string;
}

interface TodayReadingProps {
  day?: number;
  readings: Reading[];
  completedByIndex: boolean[];
  onToggleReading: (readingIndex: number, completed: boolean) => void;
}

export function TodayReading({
  day,
  readings,
  completedByIndex,
  onToggleReading,
}: TodayReadingProps) {
  const allCompleted = readings.length > 0 && completedByIndex.every(Boolean);

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <BookOpenCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2>{typeof day === "number" ? `Day ${day}` : "오늘"}</h2>
            <p className="text-gray-600">오늘의 읽기</p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            allCompleted ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {allCompleted ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
          <span className="text-sm">{allCompleted ? "완료" : "진행 중"}</span>
        </div>
      </div>

      <div className="space-y-3">
        {readings.map((reading, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onToggleReading(index, !completedByIndex[index])}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors flex items-center justify-between gap-3 ${
              completedByIndex[index]
                ? "border-green-200 bg-green-50"
                : "border-gray-200 bg-gray-50 hover:bg-gray-100"
            }`}
          >
            <p className="text-gray-900">
              <span>{reading.book}</span> {reading.chapters}
            </p>
            {completedByIndex[index] ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
