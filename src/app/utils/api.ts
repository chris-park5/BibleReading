import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { createClient } from "@supabase/supabase-js";
import type { Plan, Progress } from "../../types/domain";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7fb946f4`;

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";

type MockUser = {
  id: string;
  email: string;
  user_metadata?: { name?: string };
};

type MockSession = {
  user: MockUser;
  access_token: string;
};

const MOCK_STORAGE_KEYS = {
  user: "mock_auth_user",
  plans: "mock_plans",
  progressByPlanId: "mock_progress_by_plan_id",
  developerPresetPlans: "developer_preset_plans",
} as const;

export type DeveloperPresetPlan = {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  totalDays: number;
  schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
};

export function getDeveloperPresetPlans(): DeveloperPresetPlan[] {
  return loadJson<DeveloperPresetPlan[]>(MOCK_STORAGE_KEYS.developerPresetPlans, []);
}

export function addDeveloperPresetPlan(plan: DeveloperPresetPlan) {
  const plans = getDeveloperPresetPlans();
  plans.unshift(plan);
  saveJson(MOCK_STORAGE_KEYS.developerPresetPlans, plans);
}

export function removeDeveloperPresetPlan(planId: string) {
  const plans = getDeveloperPresetPlans().filter((p) => p.id !== planId);
  saveJson(MOCK_STORAGE_KEYS.developerPresetPlans, plans);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getMockSession(): MockSession | null {
  const user = loadJson<MockUser | null>(MOCK_STORAGE_KEYS.user, null);
  if (!user) return null;
  return { user, access_token: "mock-access-token" };
}

function setMockUser(user: MockUser | null) {
  if (!user) {
    localStorage.removeItem(MOCK_STORAGE_KEYS.user);
    return;
  }
  saveJson(MOCK_STORAGE_KEYS.user, user);
}

function ensurePlanName(plan: any): string {
  return plan?.name ?? plan?.title ?? "(제목 없음)";
}

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
  useAuth = true
) {
  if (USE_MOCK_API) {
    throw new Error(
      "Mock API 모드에서는 fetchAPI를 직접 호출하지 않습니다. api.ts의 개별 함수를 사용하세요."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (useAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  } else if (useAuth) {
    headers["Authorization"] = `Bearer ${publicAnonKey}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

// Auth APIs
export async function signUp(email: string, password: string, name: string) {
  if (USE_MOCK_API) {
    // Mock 모드에서는 회원가입을 로컬 사용자 생성으로 처리
    const user: MockUser = {
      id: crypto.randomUUID(),
      email,
      user_metadata: { name },
    };
    setMockUser(user);
    setAccessToken("mock-access-token");
    return { success: true, user };
  }

  return fetchAPI(
    "/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    },
    false
  );
}

export async function signIn(email: string, password: string) {
  if (USE_MOCK_API) {
    // 어떤 이메일/비밀번호든 허용 (UI 확인용)
    const user: MockUser = {
      id: crypto.randomUUID(),
      email,
      user_metadata: { name: email.split("@")[0] || "사용자" },
    };
    setMockUser(user);
    setAccessToken("mock-access-token");
    const session: MockSession = { user, access_token: "mock-access-token" };
    return { session };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  if (session?.access_token) {
    setAccessToken(session.access_token);
  }

  return { session };
}

// Google OAuth Sign In
// IMPORTANT: You must complete setup at https://supabase.com/docs/guides/auth/social-login/auth-google
// Otherwise you will get a "provider is not enabled" error
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) throw error;

  return { data };
}

export async function signOut() {
  if (USE_MOCK_API) {
    setMockUser(null);
    setAccessToken(null);
    return;
  }

  await supabase.auth.signOut();
  setAccessToken(null);
}

export async function getSession() {
  if (USE_MOCK_API) {
    const session = getMockSession();
    if (session?.access_token) {
      setAccessToken(session.access_token);
    }
    return { session, error: null };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    setAccessToken(session.access_token);
  }

  return { session, error };
}

// Plan APIs
export async function createPlan(planData: {
  name: string;
  startDate: string;
  endDate?: string;
  totalDays: number;
  schedule: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
  isCustom: boolean;
}): Promise<{ success: boolean; plan: Plan }> {
  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) throw new Error("Mock 모드: 로그인 상태가 아닙니다");

    const plans = loadJson<Plan[]>(MOCK_STORAGE_KEYS.plans, []);
    const plan: Plan = {
      id: crypto.randomUUID(),
      userId: session.user.id,
      name: ensurePlanName(planData),
      startDate: planData.startDate,
      endDate: planData.endDate,
      totalDays: planData.totalDays,
      schedule: planData.schedule,
      isCustom: planData.isCustom,
      createdAt: new Date().toISOString(),
    };

    plans.unshift(plan);
    saveJson(MOCK_STORAGE_KEYS.plans, plans);

    // progress 초기화
    const progressByPlanId = loadJson<Record<string, Progress>>(
      MOCK_STORAGE_KEYS.progressByPlanId,
      {}
    );
    progressByPlanId[plan.id] = {
      userId: session.user.id,
      planId: plan.id,
      completedDays: [],
      lastUpdated: new Date().toISOString(),
    };
    saveJson(MOCK_STORAGE_KEYS.progressByPlanId, progressByPlanId);

    return { success: true, plan };
  }

  return fetchAPI("/plans", {
    method: "POST",
    body: JSON.stringify(planData),
  });
}

export async function getPlans(): Promise<{ success: boolean; plans: Plan[] }> {
  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) return { success: true, plans: [] };
    const plans = loadJson<Plan[]>(MOCK_STORAGE_KEYS.plans, []).filter(
      (p) => !p.userId || p.userId === session.user.id
    );
    return { success: true, plans };
  }

  return fetchAPI("/plans");
}

export async function updateReadingProgress(
  planId: string,
  day: number,
  readingIndex: number,
  completed: boolean,
  readingCount: number
): Promise<{ success: boolean; progress: Progress }> {
  if (!planId) throw new Error("Plan ID is required");
  if (!Number.isFinite(day)) throw new Error("day is required");
  if (!Number.isFinite(readingIndex)) throw new Error("readingIndex is required");

  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) throw new Error("Mock 모드: 로그인 상태가 아닙니다");

    const progressByPlanId = loadJson<Record<string, Progress>>(
      MOCK_STORAGE_KEYS.progressByPlanId,
      {}
    );

    const existing: Progress =
      progressByPlanId[planId] ||
      ({
        userId: session.user.id,
        planId,
        completedDays: [],
        completedReadingsByDay: {},
        lastUpdated: new Date().toISOString(),
      } as Progress);

    const completedReadingsByDay = { ...(existing.completedReadingsByDay || {}) };
    const key = String(day);
    const current = new Set<number>(completedReadingsByDay[key] || []);
    if (completed) current.add(readingIndex);
    else current.delete(readingIndex);
    completedReadingsByDay[key] = Array.from(current).sort((a, b) => a - b);

    // readingCount를 기준으로 day 완료 여부를 계산
    const completedDaysSet = new Set<number>(existing.completedDays || []);
    const isDayCompleted =
      Number.isFinite(readingCount) && readingCount > 0
        ? (completedReadingsByDay[key]?.length || 0) >= readingCount
        : false;

    if (isDayCompleted) completedDaysSet.add(day);
    else completedDaysSet.delete(day);

    const progress: Progress = {
      ...existing,
      completedReadingsByDay,
      completedDays: Array.from(completedDaysSet).sort((a, b) => a - b),
      lastUpdated: new Date().toISOString(),
    };

    progressByPlanId[planId] = progress;
    saveJson(MOCK_STORAGE_KEYS.progressByPlanId, progressByPlanId);

    return { success: true, progress };
  }

  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, readingIndex, completed, readingCount }),
  });
}

export async function deletePlan(planId: string): Promise<{ success: boolean }> {
  if (!planId) throw new Error("Plan ID is required");

  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) throw new Error("Mock 모드: 로그인 상태가 아닙니다");

    const plans = loadJson<Plan[]>(MOCK_STORAGE_KEYS.plans, []);
    const nextPlans = plans.filter((p) => p.id !== planId);
    saveJson(MOCK_STORAGE_KEYS.plans, nextPlans);

    const progressByPlanId = loadJson<Record<string, Progress>>(
      MOCK_STORAGE_KEYS.progressByPlanId,
      {}
    );
    delete progressByPlanId[planId];
    saveJson(MOCK_STORAGE_KEYS.progressByPlanId, progressByPlanId);

    return { success: true };
  }

  return fetchAPI(`/plans/${planId}`, { method: "DELETE" });
}

// Progress APIs
export async function updateProgress(
  planId: string,
  day: number,
  completed: boolean
): Promise<{ success: boolean; progress: Progress }> {
  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) throw new Error("Mock 모드: 로그인 상태가 아닙니다");

    const progressByPlanId = loadJson<Record<string, Progress>>(
      MOCK_STORAGE_KEYS.progressByPlanId,
      {}
    );

    const existing: Progress =
      progressByPlanId[planId] ||
      ({
        userId: session.user.id,
        planId,
        completedDays: [],
        lastUpdated: new Date().toISOString(),
      } as Progress);

    const set = new Set(existing.completedDays);
    if (completed) set.add(day);
    else set.delete(day);

    const progress: Progress = {
      ...existing,
      completedDays: Array.from(set).sort((a, b) => a - b),
      lastUpdated: new Date().toISOString(),
    };

    progressByPlanId[planId] = progress;
    saveJson(MOCK_STORAGE_KEYS.progressByPlanId, progressByPlanId);

    return { success: true, progress };
  }

  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, completed }),
  });
}

export async function getProgress(planId: string): Promise<{ success: boolean; progress: Progress }> {
  if (USE_MOCK_API) {
    const session = getMockSession();
    if (!session) {
      return {
        success: true,
        progress: {
          userId: "",
          planId,
          completedDays: [],
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    const progressByPlanId = loadJson<Record<string, Progress>>(
      MOCK_STORAGE_KEYS.progressByPlanId,
      {}
    );

    const progress =
      progressByPlanId[planId] ||
      ({
        userId: session.user.id,
        planId,
        completedDays: [],
        completedReadingsByDay: {},
        lastUpdated: new Date().toISOString(),
      } as Progress);

    // 오래된 데이터(필드 없음) 호환
    if (!progress.completedReadingsByDay) {
      progress.completedReadingsByDay = {};
    }

    return { success: true, progress: progress as Progress };
  }

  return fetchAPI(`/progress?planId=${planId}`);
}

// Friend APIs
export async function addFriend(friendEmail: string) {
  return fetchAPI("/friends", {
    method: "POST",
    body: JSON.stringify({ friendEmail }),
  });
}

export async function getFriends() {
  return fetchAPI("/friends");
}

export async function getFriendProgress(friendUserId: string, planId: string) {
  return fetchAPI(`/friend-progress?friendUserId=${friendUserId}&planId=${planId}`);
}

// Notification APIs
export async function saveNotification(
  planId: string,
  time: string,
  enabled: boolean
) {
  return fetchAPI("/notifications", {
    method: "POST",
    body: JSON.stringify({ planId, time, enabled }),
  });
}

export async function getNotifications() {
  return fetchAPI("/notifications");
}