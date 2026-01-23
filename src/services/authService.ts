/**
 * Authentication Service
 * 
 * 인증 관련 API 호출을 담당하는 서비스 레이어
 * - 회원가입, 로그인, 로그아웃
 * - 세션 관리
 * - 회원 탈퇴
 */

import * as api from '../app/utils/api';

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  username: string;
}

export interface SignInRequest {
  username: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}

/**
 * 회원가입
 */
export async function signUp(request: SignUpRequest) {
  return api.signUp(
    request.email,
    request.password,
    request.name,
    request.username
  );
}

/**
 * 로그인
 */
export async function signIn(request: SignInRequest) {
  return api.signIn(request.username, request.password);
}

/**
 * Google OAuth 로그인
 */
export async function signInWithGoogle() {
  return api.signInWithGoogle();
}

/**
 * 로그아웃
 */
export async function signOut() {
  return api.signOut();
}

/**
 * 현재 세션 가져오기
 */
export async function getSession() {
  return api.getSession();
}

/**
 * Username으로 이메일 조회
 */
export async function getUsernameEmail(username: string) {
  return api.getUsernameEmail(username);
}

/**
 * 회원 탈퇴
 */
export async function deleteAccount() {
  return api.deleteAccount();
}

/**
 * 내 프로필 조회
 */
export async function getMyProfile() {
  return api.getMyProfile();
}

/**
 * 아이디(username) 변경
 */
export async function updateUsername(newUsername: string) {
  return api.updateUsername(newUsername);
}

/**
 * 비밀번호 변경 (현재 비밀번호 확인 포함)
 */
export async function updatePassword(currentPassword: string, newPassword: string) {
  return api.updatePassword(currentPassword, newPassword);
}

/**
 * 액세스 토큰 설정
 */
export function setAccessToken(token: string | null) {
  api.setAccessToken(token);
}

/**
 * 액세스 토큰 가져오기
 */
export function getAccessToken() {
  return api.getAccessToken();
}

/**
 * 연속 접속일(Streak) 확인 및 갱신
 */
export async function checkStreak(): Promise<{ currentStreak: number; longestStreak: number }> {
  return api.checkStreak();
}
