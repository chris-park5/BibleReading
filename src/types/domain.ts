export interface Plan {
  id: string;
  userId?: string;
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>;
  isCustom: boolean;
  createdAt?: string;
}

export interface Progress {
  userId: string;
  planId: string;
  completedDays: number[];
  // day(숫자)를 key로, 완료한 reading index 배열을 저장
  // 예: { "1": [0,2], "2": [1] }
  completedReadingsByDay?: Record<string, number[]>;
  lastUpdated: string;
}
