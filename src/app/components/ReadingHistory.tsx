import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle, Circle, CircleDashed, Search } from "lucide-react";

interface ReadingHistoryProps {
  completedDays: Set<number>;
  partialDays?: Set<number>; // 일부만 읽은 날짜
  currentDay: number;
  onDayClick: (day: number) => void;
  startDate: string; // YYYY-MM-DD (local)
  totalDays: number;
  schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
}

export function ReadingHistory({
  completedDays,
  partialDays,
  currentDay,
  onDayClick,
  startDate,
  totalDays,
  schedule,
}: ReadingHistoryProps) {
  const [query, setQuery] = useState("");

  const parseYYYYMMDDLocal = (s: string): Date => {
    const [y, m, d] = String(s || "").split("-").map((n) => Number(n));
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  };

  const start = useMemo(() => parseYYYYMMDDLocal(startDate), [startDate]);

  const addDays = (date: Date, delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    return d;
  };

  const dayIndexForDate = (date: Date): number => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const dateMid = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return Math.floor((dateMid - startMid) / msPerDay) + 1;
  };

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

  const visibleDaysSet = useMemo(() => {
    if (!hasSearch || !normalizedQuery) return null;
    return matchedDays;
  }, [hasSearch, matchedDays, normalizedQuery]);

  const end = useMemo(() => addDays(start, Math.max(0, totalDays - 1)), [start, totalDays]);

  const months = useMemo(() => {
    const list: Array<{ y: number; m: number; first: Date; last: Date }> = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cur.getTime() <= endMonth.getTime()) {
      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      list.push({ y: cur.getFullYear(), m: cur.getMonth(), first, last });
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [start, end]);

  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  const currentDate = useMemo(() => addDays(start, Math.max(0, currentDay - 1)), [start, currentDay]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);

  useEffect(() => {
    // Keep month in sync with currentDay when not searching.
    if (visibleDaysSet) return;
    const idx = months.findIndex((m) => m.y === currentDate.getFullYear() && m.m === currentDate.getMonth());
    if (idx >= 0) setActiveMonthIndex(idx);
  }, [currentDate, months, visibleDaysSet]);

  useEffect(() => {
    // Clamp index if months list changes.
    setActiveMonthIndex((prev) => {
      if (months.length === 0) return 0;
      return Math.max(0, Math.min(months.length - 1, prev));
    });
  }, [months.length]);

  const searchResultDays = useMemo(() => {
    if (!visibleDaysSet) return [] as number[];
    return Array.from(visibleDaysSet).sort((a, b) => a - b);
  }, [visibleDaysSet]);

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

      <div className="mb-4 flex items-center gap-4 justify-center text-sm flex-wrap">
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

      {hasSearch && normalizedQuery && matchCount === 0 && (
        <div className="text-sm text-gray-500 mb-3">검색 결과가 없습니다.</div>
      )}

      {visibleDaysSet ? (
        <div>
          <div className="text-sm font-medium text-gray-800 mb-2">검색 결과</div>
          {searchResultDays.length === 0 ? (
            <div className="text-sm text-gray-500">표시할 날짜가 없습니다.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {searchResultDays.map((day) => {
                const date = addDays(start, day - 1);
                const mm = String(date.getMonth() + 1).padStart(2, "0");
                const dd = String(date.getDate()).padStart(2, "0");

                const isCompleted = completedDays.has(day);
                const isPartial = safePartialDays.has(day);
                const isCurrent = day === currentDay;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onDayClick(day)}
                    className={`p-2 rounded-lg border-2 flex items-center justify-between gap-2 transition-all ${
                      isCurrent
                        ? "border-blue-500 bg-blue-50"
                        : isCompleted
                        ? "border-green-200 bg-green-50"
                        : isPartial
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    title={`${day}일차`}
                  >
                    <div className="min-w-0 text-left">
                      <div className="text-xs text-gray-500">{mm}/{dd}</div>
                      <div className="text-sm font-medium text-gray-800 truncate">{day}일차</div>
                    </div>
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : isPartial ? (
                        <CircleDashed className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : months.length === 0 ? (
        <div className="text-sm text-gray-500">달력을 표시할 수 없습니다.</div>
      ) : (
        (() => {
          const mo = months[Math.max(0, Math.min(months.length - 1, activeMonthIndex))];
          const monthLabel = `${mo.y}.${String(mo.m + 1).padStart(2, "0")}`;
          const leadingBlanks = mo.first.getDay();
          const daysInMonth = mo.last.getDate();
          const cells = Array.from({ length: leadingBlanks + daysInMonth }, (_, i) => i);
          const canPrev = activeMonthIndex > 0;
          const canNext = activeMonthIndex < months.length - 1;

          return (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveMonthIndex((i) => Math.max(0, i - 1))}
                  disabled={!canPrev}
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors text-sm"
                >
                  이전
                </button>
                <div className="text-sm font-medium text-gray-800">{monthLabel}</div>
                <button
                  type="button"
                  onClick={() => setActiveMonthIndex((i) => Math.min(months.length - 1, i + 1))}
                  disabled={!canNext}
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors text-sm"
                >
                  다음
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekdayLabels.map((w) => (
                  <div key={w} className="text-xs text-gray-500 text-center">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {cells.map((i) => {
                  const dayOfMonth = i - leadingBlanks + 1;
                  if (dayOfMonth <= 0) {
                    return <div key={`b-${i}`} className="aspect-square" />;
                  }

                  const date = new Date(mo.y, mo.m, dayOfMonth);
                  const day = dayIndexForDate(date);
                  const inRange = day >= 1 && day <= totalDays;

                  if (!inRange) {
                    return <div key={`o-${i}`} className="aspect-square" />;
                  }

                  const isCompleted = completedDays.has(day);
                  const isPartial = safePartialDays.has(day);
                  const isCurrent = day === currentDay;

                  return (
                    <button
                      key={`d-${i}`}
                      type="button"
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
                      title={`${day}일차`}
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
                        {dayOfMonth}
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
            </div>
          );
        })()
      )}

    </div>
  );
}

