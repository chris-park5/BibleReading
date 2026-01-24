import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle, Circle, CircleDashed, Search } from "lucide-react";
import { bookMatchesQuery } from "../utils/bookSearch";

import { cn } from "./ui/utils";

import { ChevronDown, ChevronUp } from "lucide-react";

interface ReadingHistoryProps {
  completedDays: Set<number>;
  partialDays?: Set<number>; // 일부만 읽은 날짜
  currentDay: number;
  selectedDay?: number;
  onDayClick: (day: number) => void;
  renderDayDetails?: (day: number, query: string) => React.ReactNode;
  startDate: string; // YYYY-MM-DD (local)
  totalDays: number;
  schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
  hideSearch?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  hideCalendar?: boolean;
  hideHeader?: boolean;
  className?: string;
  onViewChange?: (view: "calendar" | "list") => void;
}

type FilterType = "all" | "completed" | "partial" | "incomplete";

export function ReadingHistory({
  completedDays,
  partialDays,
  currentDay,
  selectedDay,
  onDayClick,
  renderDayDetails,
  startDate,
  totalDays,
  schedule,
  hideSearch = false,
  query: externalQuery,
  onQueryChange,
  hideCalendar = false,
  hideHeader = false,
  className,
  onViewChange,
}: ReadingHistoryProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = onQueryChange || setInternalQuery;

  // Reset expanded day when filter changes to avoid confusion
  useEffect(() => {
    setExpandedDay(null);
  }, [filter, query]);

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
  
  // 1. Search Query Matches
  const queryMatchedDays = useMemo(() => {
    if (!schedule || !normalizedQuery) return null;
    const hits = new Set<number>();
    for (const entry of schedule) {
      if (!entry?.day || !Array.isArray(entry.readings)) continue;
      const ok = entry.readings.some((r) => bookMatchesQuery(String(r?.book ?? ""), normalizedQuery));
      if (ok) hits.add(entry.day);
    }
    return hits;
  }, [schedule, normalizedQuery]);

  const safePartialDays = useMemo(() => partialDays ?? new Set<number>(), [partialDays]);

  // 2. Filter Matches
  const filterMatchedDays = useMemo(() => {
    if (filter === "all") return null;
    
    const hits = new Set<number>();
    for (let day = 1; day <= totalDays; day++) {
      const isCompleted = completedDays.has(day);
      const isPartial = safePartialDays.has(day);
      
      if (filter === "completed" && isCompleted) hits.add(day);
      else if (filter === "partial" && isPartial) hits.add(day);
      else if (filter === "incomplete" && !isCompleted && !isPartial) hits.add(day);
    }
    return hits;
  }, [filter, totalDays, completedDays, safePartialDays]);

  // 3. Combine Query and Filter
  const visibleDaysSet = useMemo(() => {
    const hasQuery = normalizedQuery.length > 0;
    const hasFilter = filter !== "all";

    if (!hasQuery && !hasFilter) return null;

    if (hasQuery && !hasFilter) return queryMatchedDays;
    if (!hasQuery && hasFilter) return filterMatchedDays;

    // Both present: Intersection
    const intersection = new Set<number>();
    const base = queryMatchedDays!; // known not null
    const check = filterMatchedDays!; // known not null

    base.forEach(day => {
      if (check.has(day)) intersection.add(day);
    });
    return intersection;

  }, [normalizedQuery, filter, queryMatchedDays, filterMatchedDays]);

  useEffect(() => {
    onViewChange?.(visibleDaysSet ? "list" : "calendar");
  }, [visibleDaysSet, onViewChange]);

  const hasSearch = !!schedule && !hideSearch;
  const matchCount = visibleDaysSet ? visibleDaysSet.size : 0;

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
    // Keep month in sync with currentDay when not searching/filtering.
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

  const toggleFilter = (f: FilterType) => {
    setFilter(prev => prev === f ? "all" : f);
  };

  return (
    <div className={cn("bg-card text-card-foreground rounded-xl border border-border p-6", className)}>
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
          {(normalizedQuery || filter !== "all") && (
            <div className="text-xs text-muted-foreground whitespace-nowrap">{matchCount}일</div>
          )}
        </div>
      )}

      {/* Search/Filter Empty State */}
      {hasSearch && (normalizedQuery || filter !== "all") && matchCount === 0 && (
        <div className="text-sm text-muted-foreground mb-3">검색 결과가 없습니다.</div>
      )}

      {!hideCalendar && (
        <div className="mb-4 flex items-center gap-2 sm:gap-4 justify-center text-sm flex-wrap">
          <button 
            type="button"
            onClick={() => toggleFilter('completed')}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md transition-all border",
              filter === 'completed' 
                ? "bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800 ring-1 ring-green-500" 
                : "border-transparent hover:bg-muted"
            )}
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className={cn("text-muted-foreground", filter === 'completed' && "text-foreground font-medium")}>완료</span>
          </button>

          <button 
            type="button"
            onClick={() => toggleFilter('partial')}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md transition-all border",
              filter === 'partial' 
                ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800 ring-1 ring-yellow-500" 
                : "border-transparent hover:bg-muted"
            )}
          >
            <CircleDashed className="w-4 h-4 text-yellow-500" />
            <span className={cn("text-muted-foreground", filter === 'partial' && "text-foreground font-medium")}>일부 완료</span>
          </button>

          <button
             type="button"
             onClick={() => toggleFilter('incomplete')}
             className={cn(
               "flex items-center gap-2 px-2 py-1 rounded-md transition-all border",
               filter === 'incomplete' 
                 ? "bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700 ring-1 ring-gray-400" 
                 : "border-transparent hover:bg-muted"
             )}
          >
             <Circle className="w-4 h-4 text-muted-foreground/40" />
            <span className={cn("text-muted-foreground", filter === 'incomplete' && "text-foreground font-medium")}>미완료</span>
          </button>

          {/* Today Indicator (Static) */}
          <div className="flex items-center gap-2 px-2 py-1 border border-transparent opacity-70">
            <div className="w-4 h-4 border border-primary rounded bg-primary/10" />
            <span className="text-muted-foreground">오늘</span>
          </div>
        </div>
      )}

      {/* Content */}
      {visibleDaysSet ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              {filter !== 'all' ? (
                <span>
                  {filter === 'completed' && "완료된 날짜"}
                  {filter === 'partial' && "일부 완료된 날짜"}
                  {filter === 'incomplete' && "미완료 날짜"}
                  {normalizedQuery && " (검색됨)"}
                </span>
              ) : "검색 결과"}
            </div>
            {!hideCalendar && (
              <button
                type="button"
                onClick={() => {
                  setInternalQuery("");
                  setFilter("all");
                  onQueryChange?.("");
                }}
                className="text-xs text-primary hover:underline"
              >
                캘린더로 돌아가기
              </button>
            )}
          </div>
          {searchResultDays.length === 0 ? (
            <div className="text-sm text-muted-foreground">표시할 날짜가 없습니다.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {searchResultDays.map((day) => {
                  const date = addDays(start, day - 1);
                  const mm = String(date.getMonth() + 1).padStart(2, "0");
                  const dd = String(date.getDate()).padStart(2, "0");

                  const isCompleted = completedDays.has(day);
                  const isPartial = safePartialDays.has(day);
                  const isCurrent = day === currentDay;
                  const isSelected = day === (selectedDay ?? currentDay);
                  const isExpanded = day === expandedDay;

                  const entry = schedule?.find(s => s.day === day);
                  
                  // Filter readings based on the search query
                  const relevantReadings = entry?.readings
                    ? normalizedQuery 
                      ? entry.readings.filter(r => bookMatchesQuery(String(r.book), normalizedQuery))
                      : entry.readings
                    : [];

                  const rangeText = relevantReadings
                    .map(r => `${r.book} ${r.chapters}`)
                    .join(", ");

                  return (
                    <div key={day} className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (renderDayDetails) {
                            setExpandedDay(prev => prev === day ? null : day);
                          } else {
                            onDayClick(day);
                          }
                        }}
                        className={cn(
                          "p-3 rounded-lg border flex items-center gap-3 transition-all",
                          isCurrent
                            ? isCompleted
                              ? "border-green-500 bg-primary/10" // Today + Completed
                              : isPartial
                              ? "border-yellow-500 bg-primary/5" // Today + Partial
                              : "border-primary bg-primary/10"   // Today + Incomplete
                            : isCompleted
                            ? "border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900/30"
                            : isPartial
                            ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/30"
                            : "border-border bg-card hover:bg-accent",
                          isSelected && !isCurrent && "ring-2 ring-ring"
                        )}
                        title={`${day}일차: ${rangeText}`}
                      >
                        <div className="shrink-0 w-12 text-center border-r border-border/50 pr-2">
                          <div className="text-[10px] text-muted-foreground uppercase">{mm}/{dd}</div>
                          <div className="text-sm font-bold">{day}일</div>
                        </div>
                        
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-sm font-medium break-words text-foreground/90">
                            {rangeText || "읽기 항목 없음"}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : isPartial ? (
                            <CircleDashed className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground/30" />
                          )}
                          
                          {renderDayDetails && (
                            isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </button>

                      {isExpanded && renderDayDetails && (
                        <div className="pl-4 border-l-2 border-border/50 ml-4 animate-in slide-in-from-top-2 fade-in duration-200">
                          {renderDayDetails(day, normalizedQuery)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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