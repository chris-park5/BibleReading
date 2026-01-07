/**
 * API Client
 * 
 * 백엔드 API와 통신하는 클라이언트
 */

import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { createClient } from "@supabase/supabase-js";
import type { Plan, Progress } from "../../types/domain";

// ============================================================================
// Configuration
// ============================================================================

const HOSTNAME = typeof window !== "undefined" ? window.location.hostname : "";
const IS_LOCALHOST = HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1";

const SUPABASE_URL_RAW = (() => {
  const fromEnv = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (fromEnv) return fromEnv;
  if (IS_LOCALHOST) return `https://${projectId}.supabase.co`;
  throw new Error(
    "배포 환경 설정 오류: VITE_SUPABASE_URL이 설정되어 있지 않습니다. (Vercel Environment Variables에 Supabase Project URL을 추가하세요)"
  );
})();

const SUPABASE_URL = SUPABASE_URL_RAW.replace(/\/+$/, "");

const SUPABASE_ANON_KEY = (() => {
  const fromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (fromEnv) return fromEnv;
  if (IS_LOCALHOST) return publicAnonKey;
  throw new Error(
    "배포 환경 설정 오류: VITE_SUPABASE_ANON_KEY가 설정되어 있지 않습니다. (Vercel Environment Variables에 Supabase anon key를 추가하세요)"
  );
})();

const FUNCTIONS_BASE_RAW = (() => {
  const fromEnv = import.meta.env.VITE_SUPABASE_FUNCTIONS_BASE as string | undefined;
  if (fromEnv) return fromEnv;
  // Safe default: same Supabase project as SUPABASE_URL
  return `${SUPABASE_URL}/functions/v1/make-server-7fb946f4`;
})();

const FUNCTIONS_BASE = FUNCTIONS_BASE_RAW.replace(/\/+$/, "");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accessToken: string | null = null;

const DEFAULT_API_TIMEOUT_MS = 10_000;
const SESSION_RECOVERY_TIMEOUT_MS = 8_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    (async () => {
      await sleep(timeoutMs);
      throw new Error(message);
    })(),
  ]);
}

async function tryRecoverSessionToken(): Promise<void> {
  if (accessToken) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) accessToken = data.session.access_token;
  } catch {
    // ignore: proceed without session token (server may reject and we'll surface the error)
  }
}

async function getBearerTokenOrThrow(useAuth: boolean): Promise<string | null> {
  if (!useAuth) return null;

  // Ensure we have a valid session token even after browser restart.
  await tryRecoverSessionToken();
  if (accessToken) return accessToken;

  // Do not fall back to anon key for Authorization; the Edge Function verifies JWT.
  throw new Error("로그인이 필요합니다. 다시 로그인해주세요.");
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// ============================================================================
// Developer Preset Plans (localStorage 저장)
// ============================================================================

const DEVELOPER_PLANS_KEY = 'bible-reading-dev-plans';

export function getDeveloperPresetPlans(): any[] {
  try {
    const stored = localStorage.getItem(DEVELOPER_PLANS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addDeveloperPresetPlan(plan: any): void {
  const plans = getDeveloperPresetPlans();
  plans.push(plan);
  localStorage.setItem(DEVELOPER_PLANS_KEY, JSON.stringify(plans));
}

export function removeDeveloperPresetPlan(planId: string): void {
  const plans = getDeveloperPresetPlans();
  const filtered = plans.filter((p) => p.id !== planId);
  localStorage.setItem(DEVELOPER_PLANS_KEY, JSON.stringify(filtered));
}

// ============================================================================
// HTTP Client
// ============================================================================

async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
  useAuth = true
) {

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(options.headers as Record<string, string> | undefined),
  };

  // Supabase Functions는 보통 JWT 검증이 켜져 있으므로
  // apikey + Authorization(Bearer JWT)를 함께 보내는 것이 안전합니다.
  // 로그인 상태면 access token, 아니면 anon key(JWT)를 사용합니다.

  const bearer = await getBearerTokenOrThrow(useAuth);
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);

  // If caller provided a signal, respect it as well.
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    window.clearTimeout(timeout);
    if (err?.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    // If the response isn't JSON, surface a generic error.
    if (!response.ok) {
      throw new Error("API request failed");
    }
    data = null;
  }

  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

// ============================================================================
// Auth APIs
// ============================================================================

export async function signUp(
  email: string,
  password: string,
  name: string,
  username: string
) {
  return fetchAPI(
    "/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password, name, username }),
    },
    false
  );
}

export async function getUsernameEmail(username: string) {
  return fetchAPI(
    "/get-username-email",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
    false
  );
}

export async function signIn(username: string, password: string) {
  // username으로 이메일 조회
  const { success, email } = await getUsernameEmail(username);

  if (!success || !email) {
    throw new Error("사용자를 찾을 수 없습니다");
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

/**
 * Google OAuth Sign In
 */
export async function signInWithGoogle() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Use origin only to minimize Supabase Redirect URL mismatches across routes.
  const redirectTo = origin;

  // Supabase OAuth requires an absolute http(s) redirect URL.
  // If the app is opened via file:// (origin === "null"), Supabase returns a vague "request path" error.
  if (!redirectTo.startsWith("http://") && !redirectTo.startsWith("https://")) {
    throw new Error("구글 로그인을 사용하려면 http(s)로 실행해야 합니다. (예: npm run dev로 실행 후 접속)");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Use origin+pathname (no query/hash) so it works even when hosted under a sub-path.
      // Note: Redirect URL must be allow-listed in Supabase Auth settings.
      redirectTo,
    },
  });

  if (error) {
    const msg = (error as any)?.message ? String((error as any).message) : "";
    const normalized = msg.toLowerCase();
    if (normalized.includes("request path") && normalized.includes("invalid")) {
      throw new Error(
        `구글 로그인 설정 오류: Supabase Dashboard → Authentication → URL Configuration의 Redirect URLs에 현재 도메인을 추가해야 합니다. (현재: ${redirectTo})`
      );
    }
    throw error;
  }

  return { data };
}

// ============================================================================
// Web Push (public)
// ============================================================================

export async function getVapidPublicKey(): Promise<{ publicKey: string }> {
  const result = await fetchAPI(
    "/push/public-key",
    {
      method: "GET",
    },
    false
  );

  if (!result?.publicKey || typeof result.publicKey !== "string") {
    throw new Error("VAPID public key를 가져오지 못했습니다");
  }

  return { publicKey: result.publicKey };
}

export async function signOut() {
  await supabase.auth.signOut();
  setAccessToken(null);
}

export async function getSession() {
  // If we are returning from an OAuth provider, the URL may contain an auth code.
  // Supabase can usually detect/exchange automatically, but explicit handling makes it more reliable.
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const oauthError = params.get("error");
      const oauthErrorDescription = params.get("error_description");

      if (oauthError) {
        throw new Error(oauthErrorDescription || oauthError);
      }

      if (code) {
        await withTimeout(
          supabase.auth.exchangeCodeForSession(code),
          20_000,
          "OAuth 세션 교환 시간이 초과되었습니다"
        );

        // Remove query params to prevent re-processing the auth code on refresh.
        // Keep the hash route if present.
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
      }
    } catch (e) {
      // Surface a useful error for UI/console; session may still be recovered via storage.
      // eslint-disable-next-line no-console
      console.error("OAuth callback handling failed:", e);
    }
  }

  const {
    data: { session },
    error,
  } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_RECOVERY_TIMEOUT_MS,
    "세션 확인 시간이 초과되었습니다"
  );

  if (session?.access_token) {
    setAccessToken(session.access_token);
  }

  return { session, error };
}

export async function getMyProfile(): Promise<{
  success: true;
  profile: { id: string; email: string; name: string; username: string };
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: profileRow, error: profileError } = await supabase
    .from("users")
    .select("id, email, name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileRow) throw new Error("프로필 정보를 찾을 수 없습니다");

  return {
    success: true,
    profile: {
      id: profileRow.id,
      email: profileRow.email ?? user.email ?? "",
      name: profileRow.name ?? "",
      username: profileRow.username ?? "",
    },
  };
}

export async function updateUsername(newUsername: string): Promise<{ success: true }> {
  const username = String(newUsername ?? "").trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error("아이디는 3-20자여야 합니다");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("아이디는 영문자/숫자/밑줄(_)만 사용할 수 있습니다");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다");

  const { error } = await supabase
    .from("users")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    // Unique violation 등은 메시지가 환경마다 다를 수 있어, 사용자 메시지는 일반화
    if ((error as any).code === "23505") {
      throw new Error("이미 사용 중인 아이디입니다");
    }
    throw error;
  }

  return { success: true };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: true }> {
  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");

  if (!current) throw new Error("현재 비밀번호를 입력해주세요");
  if (next.length < 6) throw new Error("새 비밀번호는 6자 이상이어야 합니다");

  const {
    data: { session },
    error: sessionError,
  } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_RECOVERY_TIMEOUT_MS,
    "세션 확인 시간이 초과되었습니다"
  );

  if (sessionError) throw sessionError;
  const email = session?.user?.email;
  if (!email) {
    throw new Error("이 계정의 이메일 정보를 찾을 수 없습니다");
  }

  // 기존 비밀번호 확인(재로그인)
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });

  if (verifyError) {
    throw new Error("현재 비밀번호가 올바르지 않습니다");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateError) throw updateError;

  // accessToken을 최신 세션으로 동기화
  const { data } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_RECOVERY_TIMEOUT_MS,
    "세션 확인 시간이 초과되었습니다"
  );
  if (data.session?.access_token) {
    setAccessToken(data.session.access_token);
  }

  return { success: true };
}

// ============================================================================
// Plan APIs
// ============================================================================

export async function createPlan(planData: {
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
}): Promise<{ success: boolean; plan: Plan }> {
  return fetchAPI("/plans", {
    method: "POST",
    body: JSON.stringify(planData),
  });
}

export async function getPlans(): Promise<{
  success: boolean;
  plans: Plan[];
}> {
  return fetchAPI("/plans");
}

export async function seedPresetSchedules(
  presetId: string,
  schedule: Array<{
    day: number;
    readings: Array<{ book: string; chapters: string }>;
  }>
): Promise<{ success: boolean; seeded: boolean }> {
  return fetchAPI("/preset-schedules/seed", {
    method: "POST",
    body: JSON.stringify({ presetId, schedule }),
  });
}

export async function deletePlan(planId: string): Promise<{
  success: boolean;
}> {
  if (!planId) throw new Error("Plan ID is required");

  return fetchAPI(`/plans/${planId}`, { method: "DELETE" });
}

export async function updatePlanOrder(planId: string, newOrder: number): Promise<{
  success: boolean;
}> {
  if (!planId) throw new Error("Plan ID is required");

  return fetchAPI("/plans/order", {
    method: "PATCH",
    body: JSON.stringify({ planId, newOrder }),
  });
}

// ============================================================================
// Progress APIs
// ============================================================================

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

  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, readingIndex, completed, readingCount }),
  });
}

export async function updateProgress(
  planId: string,
  day: number,
  completed: boolean
): Promise<{ success: boolean; progress: Progress }> {
  return fetchAPI("/progress", {
    method: "POST",
    body: JSON.stringify({ planId, day, completed }),
  });
}

export async function getProgress(planId: string): Promise<{
  success: boolean;
  progress: Progress;
}> {
  return fetchAPI(`/progress?planId=${planId}`);
}

// ============================================================================
// Friend APIs
// ============================================================================

export async function addFriend(friendIdentifier: string) {
  return fetchAPI("/friends", {
    method: "POST",
    body: JSON.stringify({ friendIdentifier }),
  });
}

export async function getFriends() {
  return fetchAPI("/friends");
}

export async function getFriendProgress(friendUserId: string, planId: string) {
  return fetchAPI(
    `/friend-progress?friendUserId=${friendUserId}&planId=${planId}`
  );
}

export async function deleteFriend(friendUserId: string) {
  return fetchAPI(`/friends/${friendUserId}`, { method: "DELETE" });
}

// ============================================================================
// Share Plan APIs
// ============================================================================

export async function getSharePlan(): Promise<{ success: boolean; sharedPlanId: string | null }> {
  return fetchAPI("/share-plan");
}

export async function setSharePlan(planId: string | null): Promise<{ success: boolean }> {
  return fetchAPI("/share-plan", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export async function respondFriendRequest(requestId: string, action: "accept" | "decline") {
  return fetchAPI("/friend-requests/respond", {
    method: "POST",
    body: JSON.stringify({ requestId, action }),
  });
}

export async function cancelFriendRequest(requestId: string) {
  return fetchAPI("/friend-requests/cancel", {
    method: "POST",
    body: JSON.stringify({ requestId }),
  });
}

export async function getFriendStatus(friendUserId: string) {
  return fetchAPI(`/friend-status?friendUserId=${friendUserId}`);
}

// ============================================================================
// Notification APIs
// ============================================================================

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

// ============================================================================
// Web Push APIs
// ============================================================================

export async function savePushSubscription(input: {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}) {
  return fetchAPI("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendTestPush() {
  return fetchAPI("/push/test", { method: "POST" });
}

export async function deleteAccount(): Promise<{ success: boolean }> {
  return fetchAPI("/account", { method: "DELETE" });
}
