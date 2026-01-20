/**
 * Friend Service
 * 
 * 친구 기능 관련 API 호출을 담당하는 서비스 레이어
 * - 친구 추가, 조회
 * - 친구의 진도 조회
 */

import * as api from '../app/utils/api';

export interface Friend {
  userId: string;
  email: string;
  name: string;
  username?: string;
  addedAt: string;
}

export interface IncomingFriendRequest {
  requestId: string;
  fromUser: {
    id: string;
    email: string;
    name: string;
    username?: string;
  };
  createdAt: string;
}

export interface OutgoingFriendRequest {
  requestId: string;
  toUser: {
    id: string;
    email: string;
    name: string;
    username?: string;
  };
  createdAt: string;
}

export interface FriendStatus {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string;
  };
  plan: {
    id: string;
    name: string;
    totalDays: number;
    startDate?: string | null;
  } | null;
  achievementRate: number;
  progressRate?: number;
  completedDays: number;
  totalDays: number;
}

export interface FriendProgress {
  user: {
    id: string;
    email: string;
    name: string;
  };
  plan: {
    name: string;
    totalDays: number;
  };
  progress: {
    completedDays: number[];
  };
  achievementRate?: number;
  progressRate?: number;
}

/**
 * 친구 추가
 */
export async function addFriend(friendIdentifier: string) {
  return api.addFriend(friendIdentifier);
}

/**
 * 친구 목록 조회
 */
export async function getFriends(): Promise<{
  success: boolean;
  friends: Friend[];
  incomingRequests?: IncomingFriendRequest[];
  outgoingRequests?: OutgoingFriendRequest[];
}> {
  return api.getFriends();
}

export async function respondFriendRequest(
  requestId: string,
  action: "accept" | "decline"
): Promise<{ success: boolean }> {
  return api.respondFriendRequest(requestId, action);
}

export async function cancelFriendRequest(requestId: string): Promise<{ success: boolean }> {
  return api.cancelFriendRequest(requestId);
}

export async function getFriendStatus(friendUserId: string): Promise<{
  success: boolean;
  friendStatus: FriendStatus;
}> {
  return api.getFriendStatus(friendUserId);
}

/**
 * 친구의 진도 조회
 */
export async function getFriendProgress(
  friendUserId: string,
  planId: string
): Promise<{
  success: boolean;
  friendProgress: FriendProgress;
}> {
  return api.getFriendProgress(friendUserId, planId);
}

export async function deleteFriend(friendUserId: string): Promise<{ success: boolean }> {
  return api.deleteFriend(friendUserId);
}

export async function getSharePlan(): Promise<{ success: boolean; sharedPlanId: string | null }> {
  return api.getSharePlan();
}

export async function setSharePlan(planId: string | null): Promise<{ success: boolean }> {
  return api.setSharePlan(planId);
}

export async function getLeaderboard() {
  return api.getLeaderboard();
}
