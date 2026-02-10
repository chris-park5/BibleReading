import { Capacitor } from "@capacitor/core";
import { getNativeDb } from "./nativeSqliteDb";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    if (!db) return;
    const json = JSON.stringify(value);
    await db.run(
      "INSERT OR REPLACE INTO kv_cache (key, value, updated_at) VALUES (?, ?, ?)",
      [key, json, Date.now()],
    );
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    if (!db) return null;

    const res = await db.query("SELECT value FROM kv_cache WHERE key = ? LIMIT 1", [key]);
    const row = (res.values?.[0] as any) ?? null;
    if (!row?.value || typeof row.value !== "string") return null;
    return safeJsonParse<T>(row.value);
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return safeJsonParse<T>(raw);
  } catch {
    return null;
  }
}

export async function cacheRemove(key: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    if (!db) return;
    await db.run("DELETE FROM kv_cache WHERE key = ?", [key]);
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
