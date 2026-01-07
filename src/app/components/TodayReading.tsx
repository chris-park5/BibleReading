import { useMemo } from "react";
import { BookOpenCheck, CheckCircle, Circle } from "lucide-react";

interface Reading {
  planName?: string;
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

  const showPlanHeaders = useMemo(() => {
    const names = readings.map((r) => r.planName).filter((v): v is string => !!v);
    return new Set(names).size > 1;
  }, [readings]);

  const groups = useMemo(() => {
    const map = new Map<string, Array<{ reading: Reading; index: number }>>();
    for (let index = 0; index < readings.length; index++) {
      const reading = readings[index];
      const key = showPlanHeaders ? (reading.planName ?? "") : "";
      const list = map.get(key) ?? [];
      list.push({ reading, index });
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [readings, showPlanHeaders]);

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

      <div className="space-y-4">
        {groups.map(([planName, items]) => (
          <div key={planName || "__default"} className="space-y-3">
            {showPlanHeaders && planName && (
              <div className="px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-600">계획</p>
                <p className="text-gray-900">{planName}</p>
              </div>
            )}

            <div className="space-y-3">
              {items.map(({ reading, index }) => (
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
                  <div className="min-w-0">
                    <p className="text-gray-900 break-words">{reading.book}</p>
                    <p className="text-gray-600 text-sm break-words">{reading.chapters}</p>
                  </div>
                  {completedByIndex[index] ? (
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
