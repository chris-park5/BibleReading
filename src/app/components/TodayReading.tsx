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
  subtitle?: string | null;
}

export function TodayReading({
  day,
  readings,
  completedByIndex,
  onToggleReading,
  subtitle = "오늘의 읽기",
}: TodayReadingProps) {
  const allCompleted = readings.length > 0 && completedByIndex.every(Boolean);

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
          <button
            key={index}
            type="button"
            onClick={() => onToggleReading(index, !completedByIndex[index])}
            className={`w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between gap-3 ${
              completedByIndex[index]
                ? "border-green-200 bg-green-50"
                : "border-border bg-muted/40 hover:bg-muted/60"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground break-words">{reading.planName ?? ""}</p>
              <p className="break-words">{reading.book}</p>
              <p className="text-sm text-muted-foreground break-words">{reading.chapters}</p>
            </div>
            {completedByIndex[index] ? (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/60 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
