export interface Plan {
  id: string;
  userId?: string;
  presetId?: string;  // Reference to preset_plans table
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  totalChapters?: number;
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string; chapter_count?: number }>;
  }>;
  isCustom: boolean;
  displayOrder?: number;
  createdAt?: string;
}

export interface Progress {
  userId: string;
  planId: string;
  completedDays: number[];
  // day(숫자)를 key로, 완료한 reading index 배열을 저장
  // 예: { "1": [0,2], "2": [1] }
  completedReadingsByDay?: Record<string, number[]>;
  // day(숫자) -> readingIndex -> completed chapters array
  completedChaptersByDay?: Record<string, Record<number, string[]>>;
  // Completion history for analytics (charts)
  history?: Array<{ day: number; readingIndex: number; completedAt: string }>;
  lastUpdated: string;
}
