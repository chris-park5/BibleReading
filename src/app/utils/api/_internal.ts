import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";

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

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
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

export async function getBearerTokenOrThrow(useAuth: boolean): Promise<string | null> {
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
// HTTP Client
// ============================================================================

export async function fetchAPI(endpoint: string, options: RequestInit = {}, useAuth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(options.headers as Record<string, string> | undefined),
  };

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

export const SESSION_TIMEOUT_MS = SESSION_RECOVERY_TIMEOUT_MS;
