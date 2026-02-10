import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsBaseRaw = import.meta.env.VITE_SUPABASE_FUNCTIONS_BASE;

if (!supabaseUrlRaw) {
  throw new Error("VITE_SUPABASE_URL is missing");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing");
}
if (!functionsBaseRaw) {
  throw new Error("VITE_SUPABASE_FUNCTIONS_BASE is missing");
}

const supabaseUrl = String(supabaseUrlRaw).replace(/\/+$/, "");
const functionsBase = String(functionsBaseRaw).replace(/\/+$/, "");

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

let accessTokenOverride: string | null = null;

export function setAccessToken(token: string | null) {
  accessTokenOverride = token;
}

export function getAccessToken() {
  return accessTokenOverride;
}

export const SESSION_TIMEOUT_MS = 10_000;

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

async function resolveAuthToken(authRequired: boolean): Promise<string | null> {
  if (!authRequired) return null;

  if (accessTokenOverride) return accessTokenOverride;

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) return token;

  throw new Error("로그인이 필요합니다. 다시 로그인해주세요.");
}

export async function fetchAPI(
  path: string,
  init: RequestInit = {},
  authRequired: boolean = true,
  timeoutMs: number = SESSION_TIMEOUT_MS
) {
  const url = `${functionsBase}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = await resolveAuthToken(authRequired);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };

  // Preserve caller headers (if any) but allow us to set required defaults.
  if (init.headers) {
    const h = init.headers as any;
    if (typeof h.forEach === "function") {
      h.forEach((value: string, key: string) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, h);
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await withTimeout(
    fetch(url, {
      ...init,
      headers,
    }),
    timeoutMs,
    "요청 시간이 초과되었습니다"
  );

  const text = await res.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in (data as any) && String((data as any).error)) ||
      (data && typeof data === "object" && "message" in (data as any) && String((data as any).message)) ||
      (typeof data === "string" ? data : "요청에 실패했습니다");

    throw new Error(message);
  }

  return data;
}

export async function fetchAll<T>(
  pageQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
  pageSize: number = 1000
): Promise<T[]> {
  const out: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await pageQuery(from, to);
    if (error) throw error;

    const rows = data ?? [];
    out.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return out;
}
