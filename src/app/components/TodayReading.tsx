import { BookOpenCheck, CheckCircle, Circle, CircleDashed, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo } from "react";

interface Reading {
  planName?: string;
  book: string;
  chapters: string;
}

interface TodayReadingProps {
  day?: number;
  readings: Reading[];
  completedByIndex: boolean[];
  completedChaptersByIndex?: string[][]; // Array of completed chapter strings for each reading
  onToggleReading: (readingIndex: number, completed: boolean, completedChapters?: string[]) => void;
  subtitle?: string | null;
}

// Helper to expand "1-3,5" into ["1", "2", "3", "5"]
function expandChapters(chapterStr: string): string[] {
  const result: string[] = [];
  const parts = chapterStr.split(",");
  
  for (const part of parts) {
    const clean = part.trim();

    // If it contains ":", extract the chapter number (e.g. "18:9-16" -> "18")
    if (clean.includes(":")) {
      const chapter = clean.split(":")[0].replace(/[^0-9]/g, "");
      if (chapter) {
        result.push(chapter);
      } else {
        result.push(clean);
      }
      continue;
    }

    // If it contains "절", extract chapter number (e.g. "18장 9-16절" -> "18")
    if (clean.includes("절")) {
      const match = clean.match(/(\d+)장/);
      if (match && match[1]) {
        result.push(match[1]);
      } else {
        // Fallback: try parsing the start
        const num = parseInt(clean);
        if (!isNaN(num)) result.push(String(num));
        else result.push(clean);
      }
      continue;
    }

    const trimmed = clean.replace(/장/g, "");

    const range = trimmed.split("-");
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          result.push(String(i));
        }
      } else {
          result.push(trimmed);
      }
    } else {
      result.push(trimmed);
    }
  }
  return result;
}

interface ReadingItemProps {
  reading: Reading;
  index: number;
  isFullyCompleted: boolean;
  completedChapters: string[];
  isExpanded: boolean;
  onToggleReading: (readingIndex: number, completed: boolean, completedChapters?: string[]) => void;
  onToggleExpand: (index: number) => void;
}

function ReadingItem({
  reading,
  index,
  isFullyCompleted,
  completedChapters,
  isExpanded,
  onToggleReading,
  onToggleExpand,
}: ReadingItemProps) {
  // Expand and deduplicate chapters (e.g. "18:1-10, 18:11-20" -> "18")
  const allChapters = useMemo(() => {
    const expanded = expandChapters(reading.chapters);
    return Array.from(new Set(expanded));
  }, [reading.chapters]);
  
  // If fully completed (legacy or manual), treat all chapters as completed for display
  const effectiveCompletedChapters = isFullyCompleted ? allChapters : completedChapters;
  const completedCount = effectiveCompletedChapters.length;
  const totalCount = allChapters.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  const isPartial = !isFullyCompleted && completedCount > 0;

  const handleSubCheck = (
    chapter: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    
    // Current state
    // FIX: Use effectiveCompletedChapters so that if it is fully completed (but the list is empty/ignored),
    // we start with all chapters checked, then remove one.
    const currentSet = new Set(effectiveCompletedChapters);
    
    // Toggle logic
    if (currentSet.has(chapter)) {
      currentSet.delete(chapter);
    } else {
      currentSet.add(chapter);
    }
    
    const nextCompletedChapters = Array.from(currentSet);
    
    // Determine new overall completion status
    // If all chapters are present in the set, it is fully complete.
    // If chapters list is empty (invalid state?), we can't be fully complete unless it was already empty (which means no chapters).
    const isNowFullyComplete = allChapters.length > 0 && allChapters.every(c => currentSet.has(c));
    
    onToggleReading(index, isNowFullyComplete, nextCompletedChapters);
  };

  return (
    <div className="space-y-2">
      <div 
          className={`relative overflow-hidden rounded-lg border transition-all ${
            isFullyCompleted 
              ? "border-green-200" 
              : isPartial 
                ? "border-amber-200" 
                : "border-border"
          }`}
      >
          {/* Progress Bar Background */}
          <div 
              className={`absolute inset-0 h-full transition-all duration-500 ease-in-out ${
                    isFullyCompleted ? "bg-green-50 opacity-100" : "bg-amber-50 opacity-100"
              }`}
              style={{ width: `${progressPercent}%` }}
          />

          <div 
              className="relative flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onClick={() => onToggleExpand(index)}
          >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                      type="button"
                      onClick={(e) => {
                          e.stopPropagation();
                          // Main checkbox toggle
                          if (isFullyCompleted) {
                              // Uncheck all
                              onToggleReading(index, false, []);
                          } else {
                              // Check all
                              onToggleReading(index, true, allChapters);
                          }
                      }}
                      className="shrink-0"
                  >
                      {isFullyCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : isPartial ? (
                          <CircleDashed className="w-6 h-6 text-amber-600" />
                      ) : (
                          <Circle className="w-6 h-6 text-muted-foreground/60" />
                      )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground break-words">{reading.planName}</p>
                      <p className="font-medium break-words">{reading.book}</p>
                      <p className="text-sm text-muted-foreground break-words">{reading.chapters}</p>
                  </div>

                  {/* Dropdown Indicator */}
                  {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
              </div>
          </div>
      </div>

      {/* Sub-items (Chapters) */}
      {isExpanded && (
          <div className="pl-4 pr-2 py-2 flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-200">
              {allChapters.map((chapter) => {
                  const isChecked = effectiveCompletedChapters.includes(chapter);
                  return (
                      <button
                          key={chapter}
                          onClick={(e) => handleSubCheck(chapter, e)}
                          className={`
                              flex items-center justify-center py-2 px-3 min-w-[3rem] rounded-md text-sm font-medium border transition-colors whitespace-nowrap
                              ${isChecked 
                                  ? "bg-primary/10 border-primary/20 text-primary" 
                                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                              }
                          `}
                      >
                          {chapter}
                      </button>
                  );
              })}
          </div>
      )}
    </div>
  );
}

export function TodayReading({
  day,
  readings,
  completedByIndex,
  completedChaptersByIndex = [],
  onToggleReading,
  subtitle = "오늘의 읽기",
}: TodayReadingProps) {
  const allCompleted = readings.length > 0 && completedByIndex.every(Boolean);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <BookOpenCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2>{typeof day === "number" ? `Day ${day}` : "오늘"}</h2>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            allCompleted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
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
        {readings.map((reading, index) => (
          <ReadingItem
            key={index}
            reading={reading}
            index={index}
            isFullyCompleted={completedByIndex[index]}
            completedChapters={completedChaptersByIndex[index] || []}
            isExpanded={expandedIndices.has(index)}
            onToggleReading={onToggleReading}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  );
}