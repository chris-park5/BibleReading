/**
 * Plan Service
 * 
 * 계획(Plan) 관련 API 호출을 담당하는 서비스 레이어
 * - 계획 생성, 조회, 삭제
 * - 계획 순서 변경
 */

import * as api from '../app/utils/api';
import type { Plan } from '../types/domain';

export interface CreatePlanRequest {
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>;
  isCustom: boolean;
  presetId?: string;
}

/**
 * 계획 생성
 */
export async function createPlan(
  request: CreatePlanRequest
): Promise<{ success: boolean; plan: Plan }> {
  return api.createPlan(request);
}

/**
 * 모든 계획 조회
 */
export async function getPlans(): Promise<{
  success: boolean;
  plans: Plan[];
}> {
  return api.getPlans();
}

/**
 * Fresh DB helper: seed preset_schedules if missing.
 * Idempotent on the server side.
 */
export async function seedPresetSchedules(
  presetId: string,
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>
): Promise<{ success: boolean; seeded: boolean }> {
  return api.seedPresetSchedules(presetId, schedule);
}

/**
 * 계획 삭제
 */
export async function deletePlan(planId: string): Promise<{
  success: boolean;
}> {
  return api.deletePlan(planId);
}

/**
 * 계획 순서 변경
 */
export async function updatePlanOrder(
  planId: string,
  newOrder: number
): Promise<{
  success: boolean;
}> {
  return api.updatePlanOrder(planId, newOrder);
}
