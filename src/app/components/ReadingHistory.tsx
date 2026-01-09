import { useMemo, useState } from "react";
import { Calendar, CheckCircle, Circle, CircleDashed, Search } from "lucide-react";

interface ReadingHistoryProps {
  completedDays: Set<number>;
  partialDays?: Set<number>; // 일부만 읽은 날짜
  currentDay: number;
  onDayClick: (day: number) => void;
  totalDays: number;
  schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
}

export function ReadingHistory({
  completedDays,
  partialDays,
  currentDay,
  onDayClick,
  totalDays,
  schedule,
}: ReadingHistoryProps) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const matchedDays = useMemo(() => {
    if (!schedule || !normalizedQuery) return new Set<number>();
    const hits = new Set<number>();
    for (const entry of schedule) {
      if (!entry?.day || !Array.isArray(entry.readings)) continue;
      const ok = entry.readings.some((r) => String(r?.book ?? "").toLowerCase().includes(normalizedQuery));
      if (ok) hits.add(entry.day);
    }
    return hits;
  }, [schedule, normalizedQuery]);

  const hasSearch = !!schedule;
  const matchCount = normalizedQuery ? matchedDays.size : 0;
  const safePartialDays = partialDays ?? new Set<number>();

  const visibleDays = useMemo(() => {
    if (!hasSearch || !normalizedQuery) return days;
    return Array.from(matchedDays).sort((a, b) => a - b);
  }, [days, hasSearch, matchedDays, normalizedQuery]);

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-100 rounded-lg">
          <Calendar className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2>읽기 기록</h2>
          <p className="text-gray-600 text-sm">일자</p>
        </div>
      </div>

      {hasSearch && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="책 이름 검색 (예: 히브리서)"
              className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
            />
          </div>
          {normalizedQuery && (
            <div className="text-xs text-gray-500 whitespace-nowrap">{matchCount}일</div>
          )}
        </div>
      )}

      {hasSearch && normalizedQuery && matchCount === 0 && (
        <div className="text-sm text-gray-500 mb-3">검색 결과가 없습니다.</div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {visibleDays.map((day) => {
          const isCompleted = completedDays.has(day);
          const isPartial = safePartialDays.has(day);
          const isCurrent = day === currentDay;

          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              className={`aspect-square p-2 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                isCurrent
                  ? "border-blue-500 bg-blue-50"
                  : isCompleted
                  ? "border-green-200 bg-green-50"
                  : isPartial
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span
                className={`text-xs mb-1 ${
                  isCurrent
                    ? "text-blue-600"
                    : isCompleted
                    ? "text-green-600"
                    : isPartial
                    ? "text-yellow-600"
                    : "text-gray-600"
                }`}
              >
                {day}
              </span>
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : isPartial ? (
                <CircleDashed className="w-4 h-4 text-yellow-500" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4 justify-center text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-gray-600">완료</span>
        </div>
        <div className="flex items-center gap-2">
          <CircleDashed className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-600">일부 완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 rounded bg-blue-50" />
          <span className="text-gray-600">오늘</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-gray-300" />
          <span className="text-gray-600">미완료</span>
        </div>
      </div>
    </div>
  );
}

