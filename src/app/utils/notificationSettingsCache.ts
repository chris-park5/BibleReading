export type NotificationSettingCacheValue = {
  enabled: boolean;
  time: string;
};

const NOTIFICATION_CACHE_KEY = "bible-reading:notification-settings-cache:v1";

type CacheShape = Record<string, { enabled: boolean; time: string; updatedAt?: number }>;

export function readCachedNotificationSetting(planId: string): NotificationSettingCacheValue | null {
  try {
    const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    const item = parsed?.[planId];
    if (!item) return null;
    if (typeof item.enabled !== "boolean") return null;
    if (typeof item.time !== "string") return null;
    return { enabled: item.enabled, time: item.time };
  } catch {
    return null;
  }
}

export function writeCachedNotificationSetting(planId: string, next: NotificationSettingCacheValue): void {
  try {
    const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
    const parsed = (raw ? (JSON.parse(raw) as CacheShape) : {}) as CacheShape;
    parsed[planId] = { enabled: next.enabled, time: next.time, updatedAt: Date.now() };
    localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore cache failures
  }
}
