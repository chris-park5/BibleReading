/**
 * Notification Service
 * 
 * 알림 기능 관련 API 호출을 담당하는 서비스 레이어
 * - 알림 설정 저장, 조회
 */

import * as api from '../app/utils/api';

export interface Notification {
  planId: string;
  time: string;
  enabled: boolean;
}

/**
 * 알림 설정 저장
 */
export async function saveNotification(
  planId: string,
  time: string,
  enabled: boolean
) {
  return api.saveNotification(planId, time, enabled);
}

/**
 * 알림 설정 조회
 */
export async function getNotifications(): Promise<{
  success: boolean;
  notifications: Notification[];
}> {
  return api.getNotifications();
}
