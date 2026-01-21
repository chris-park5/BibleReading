import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle, Circle, CircleDashed, Search } from "lucide-react";
import { bookMatchesQuery } from "../utils/bookSearch";

import { ScrollArea } from "./ui/scroll-area";

interface ReadingHistoryProps {
  completedDays: Set<number>;
  partialDays?: Set<number>; // 일부만 읽은 날짜
  currentDay: number;
  selectedDay?: number;
  onDayClick: (day: number) => void;
  startDate: string; // YYYY-MM-DD (local)
  totalDays: number;
  schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
  hideSearch?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  hideCalendar?: boolean;
  hideHeader?: boolean;
}

export function ReadingHistory({
  completedDays,
  partialDays,
  currentDay,
  selectedDay,
  onDayClick,
  startDate,
  totalDays,
  schedule,
  hideSearch = false,
  query: externalQuery,
  onQueryChange,
  hideCalendar = false,
  hideHeader = false,
}: ReadingHistoryProps) {
  const [internalQuery, setInternalQuery] = useState("");

  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = onQueryChange || setInternalQuery;

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
      const ok = entry.readings.some((r) => bookMatchesQuery(String(r?.book ?? ""), normalizedQuery));
      if (ok) hits.add(entry.day);
    }
    return hits;
  }, [schedule, normalizedQuery]);

  const hasSearch = !!schedule && !hideSearch;
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
    <div className="bg-card text-card-foreground rounded-xl border border-border p-6">
      {!hideHeader && (
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2>읽기 기록</h2>
            <p className="text-sm text-muted-foreground">일자</p>
          </div>
        </div>
      )}

      {hasSearch && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="책 이름 검색 (예: 히브리서)"
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-input-background text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {normalizedQuery && (
            <div className="text-xs text-muted-foreground whitespace-nowrap">{matchCount}일</div>
          )}
        </div>
      )}

      {/* Search Empty State */}
      {hasSearch && normalizedQuery && matchCount === 0 && (
        <div className="text-sm text-muted-foreground mb-3">검색 결과가 없습니다.</div>
      )}

      {/* Content */}
      {visibleDaysSet ? (
        <div>
          <div className="text-sm font-medium mb-2">검색 결과</div>
          {searchResultDays.length === 0 ? (
            <div className="text-sm text-muted-foreground">표시할 날짜가 없습니다.</div>
          ) : (
            <ScrollArea className="max-h-[300px] overflow-y-auto pr-2">
              <div className="grid grid-cols-3 gap-2">
                {searchResultDays.map((day) => {
                  const date = addDays(start, day - 1);
                  const mm = String(date.getMonth() + 1).padStart(2, "0");
                  const dd = String(date.getDate()).padStart(2, "0");

                  const isCompleted = completedDays.has(day);
                  const isPartial = safePartialDays.has(day);
                  const isCurrent = day === currentDay;
                  const isSelected = day === (selectedDay ?? currentDay);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => onDayClick(day)}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                        isCurrent
                          ? "border-primary bg-primary/10"
                          : isCompleted
                          ? "border-green-200 bg-green-50"
                          : isPartial
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-border bg-card hover:bg-accent"
                      } ${
                        isSelected && !isCurrent ? "ring-2 ring-ring" : ""
                      }`}
                      title={`${day}일차`}
                    >
                      <div className="min-w-0 text-left">
                        <div className="text-xs text-muted-foreground">{mm}/{dd}</div>
                        <div className="text-sm font-medium truncate">{day}일차</div>
                      </div>
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : isPartial ? (
                          <CircleDashed className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : (
        // Render Calendar ONLY if NOT hidden
        !hideCalendar && (
          months.length === 0 ? (
            <div className="text-sm text-muted-foreground">달력을 표시할 수 없습니다.</div>
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
                      className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 transition-colors text-sm"
                    >
                      이전
                    </button>
                    <div className="text-sm font-medium">{monthLabel}</div>
                    <button
                      type="button"
                      onClick={() => setActiveMonthIndex((i) => Math.min(months.length - 1, i + 1))}
                      disabled={!canNext}
                      className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 transition-colors text-sm"
                    >
                      다음
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {weekdayLabels.map((w) => (
                      <div key={w} className="text-xs text-muted-foreground text-center">
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
                      const isSelected = day === (selectedDay ?? currentDay);

                      return (
                        <button
                          key={`d-${i}`}
                          type="button"
                          onClick={() => onDayClick(day)}
                          className={`aspect-square p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
                            isCurrent
                              ? "border-primary bg-primary/10"
                              : isCompleted
                              ? "border-green-200 bg-green-50"
                              : isPartial
                              ? "border-yellow-200 bg-yellow-50"
                              : "border-border bg-card hover:bg-accent"
                          } ${
                            isSelected && !isCurrent ? "ring-2 ring-ring" : ""
                          }`}
                          title={`${day}일차`}
                        >
                          <span
                            className={`text-xs mb-1 ${
                              isCurrent
                                ? "text-primary"
                                : isCompleted
                                ? "text-green-600"
                                : isPartial
                                ? "text-yellow-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {dayOfMonth}
                          </span>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : isPartial ? (
                            <CircleDashed className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground/40" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )
        )
      )}
    </div>
  );
}