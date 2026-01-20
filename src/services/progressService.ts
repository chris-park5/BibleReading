/**
 * Progress Service
 * 
 * 진도(Progress) 관련 API 호출을 담당하는 서비스 레이어
 * - 진도 조회
 * - 읽기 완료 상태 업데이트
 */

import * as api from '../app/utils/api';
import type { Progress } from '../types/domain';

/**
 * 계획의 진도 조회
 */
export async function getProgress(planId: string): Promise<{
  success: boolean;
  progress: Progress;
}> {
  return api.getProgress(planId);
}

/**
 * 특정 읽기의 완료 상태 업데이트
 */
export async function updateReadingProgress(
  planId: string,
  day: number,
  readingIndex: number,
  completed: boolean,
  readingCount: number,
  completedChapters?: string[]
): Promise<{ success: boolean; progress: Progress }> {
  return api.updateReadingProgress(
    planId,
    day,
    readingIndex,
    completed,
    readingCount,
    completedChapters
  );
}

/**
 * 하루 전체의 완료 상태 업데이트
 */
export async function updateProgress(
  planId: string,
  day: number,
  completed: boolean
): Promise<{ success: boolean; progress: Progress }> {
  return api.updateProgress(planId, day, completed);
}
