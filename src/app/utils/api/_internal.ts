import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";

// ============================================================================
// API Error Class
// ============================================================================

export type ApiErrorCode = 
  | "UNAUTHORIZED"      // 401: 인증 필요
  | "SESSION_EXPIRED"   // 401: 세션 만료
  | "FORBIDDEN"         // 403: 권한 없음
  | "NOT_FOUND"         // 404: 리소스 없음
  | "VALIDATION_ERROR"  // 400: 입력값 오류
  | "CONFLICT"          // 409: 충돌
  | "RATE_LIMITED"      // 429: 요청 제한
  | "SERVER_ERROR"      // 500: 서버 오류
  | "NETWORK_ERROR"     // 네트워크 오류
  | "TIMEOUT"           // 타임아웃
  | "UNKNOWN";          // 알 수 없는 오류

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiError";
    
    // Error 클래스 상속 시 프로토타입 체인 복원 (ES5 호환)
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** 인증 관련 에러인지 확인 */
  isAuthError(): boolean {
    return this.code === "UNAUTHORIZED" || this.code === "SESSION_EXPIRED";
  }

  /** 재시도 가능한 에러인지 확인 */
  isRetryable(): boolean {
    return this.code === "NETWORK_ERROR" || 
           this.code === "TIMEOUT" || 
           this.code === "SERVER_ERROR" ||
           this.code === "RATE_LIMITED";
  }

  /** 사용자에게 보여줄 메시지 */
  getUserMessage(): string {
    switch (this.code) {
      case "SESSION_EXPIRED":
        return "세션이 만료되었습니다. 다시 로그인해주세요.";
      case "UNAUTHORIZED":
        return "로그인이 필요합니다.";
      case "FORBIDDEN":
        return "접근 권한이 없습니다.";
      case "NOT_FOUND":
        return "요청한 정보를 찾을 수 없습니다.";
      case "VALIDATION_ERROR":
        return this.message || "입력값을 확인해주세요.";
      case "RATE_LIMITED":
        return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
      case "NETWORK_ERROR":
        return "네트워크 연결을 확인해주세요.";
      case "TIMEOUT":
        return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
      case "SERVER_ERROR":
        return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      default:
        return this.message || "오류가 발생했습니다.";
    }
  }
}

function getApiErrorCode(statusCode: number, errorText: string): ApiErrorCode {
  const normalized = errorText.toLowerCase();
  
  switch (statusCode) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      if (normalized.includes("session") && normalized.includes("does not exist")) {
        return "SESSION_EXPIRED";
      }
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 500:
    case 502:
    case 503:
    case 504:
      return "SERVER_ERROR";
    default:
      return "UNKNOWN";
  }
}

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

  // Always fetch the latest session. Supabase client handles caching and refreshing automatically.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (token) {
    accessToken = token; // Update local cache for synchronous access if needed elsewhere
    return token;
  }

  // Do not fall back to anon key for Authorization; the Edge Function verifies JWT.
  throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다. 다시 로그인해주세요.");
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

export async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
  useAuth = true,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
) {
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
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

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
      throw new ApiError(0, "TIMEOUT", "요청 시간이 초과되었습니다");
    }
    // 네트워크 에러 (오프라인, DNS 실패 등)
    throw new ApiError(0, "NETWORK_ERROR", err?.message || "네트워크 연결을 확인해주세요");
  } finally {
    window.clearTimeout(timeout);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    // If the response isn't JSON, surface a generic error.
    if (!response.ok) {
      const code = getApiErrorCode(response.status, "");
      throw new ApiError(response.status, code, "API 요청이 실패했습니다");
    }
    data = null;
  }

  if (!response.ok) {
    const errText = data?.error ? String(data.error) : "";
    const code = getApiErrorCode(response.status, errText);

    // 세션 만료 시 추가 처리
    if (code === "SESSION_EXPIRED") {
      setAccessToken(null);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
      try {
        window.dispatchEvent(new CustomEvent("auth:expired", { detail: { reason: errText } }));
      } catch {
        // ignore
      }
    }

    throw new ApiError(response.status, code, errText || "API 요청이 실패했습니다", data);
  }

  return data;
}

export const SESSION_TIMEOUT_MS = SESSION_RECOVERY_TIMEOUT_MS;

/**
 * Fetch all rows from a Supabase query using range-based pagination.
 * Needed because Supabase limits rows (usually 1000) per request.
 * 
 * @param queryFactory Function that returns a Supabase query with .range() applied
 * @param pageSize Default 1000
 */
export async function fetchAll<T>(
  queryFactory: (from: number, to: number) => Promise<{ data: any; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;
  
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allRows.push(...(data as T[]));
    
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return allRows;
}
