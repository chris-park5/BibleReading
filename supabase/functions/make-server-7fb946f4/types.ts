/**
 * Type Definitions
 * 
 * API 요청/응답 타입 정의
 */

// ============================================
// Plan Types
// ============================================

export interface CreatePlanRequest {
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  totalChapters: number;
  schedule?: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>;
  isCustom: boolean;
  presetId?: string;
}

export interface UpdatePlanOrderRequest {
  planId: string;
  newOrder: number;
}

// ============================================
// Progress Types
// ============================================

export interface UpdateProgressRequest {
  planId: string;
  day: number;
  completed: boolean;
  readingIndex: number;
  readingCount: number;
  completedChapters?: string[];
  currentDate?: string;
}

export interface Progress {
  userId: string;
  planId: string;
  completedDays: number[];
  completedReadingsByDay: Record<string, number[]>;
  completedChaptersByDay?: Record<string, Record<number, string[]>>;
  lastUpdated: string;
}

export interface DailyStat {
  date: string;
  count: number;
}

// ============================================
// Friend Types
// ============================================

export interface AddFriendRequest {
  friendIdentifier: string; // email or username
}

export interface CancelFriendRequest {
  requestId: string;
}

export interface RespondFriendRequest {
  requestId: string;
  action: "accept" | "decline";
}

export interface SetSharePlanRequest {
  planId: string | null;
}

// ============================================
// Notification Types
// ============================================

export interface NotificationRequest {
  planId: string;
  time: string;
  enabled: boolean;
}
