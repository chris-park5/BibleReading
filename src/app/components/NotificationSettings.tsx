import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import * as api from "../utils/api";
import { ensurePushSubscriptionRegistered } from "../utils/pushClient";

interface NotificationSettingsProps {
  onClose: () => void;
  planId: string;
  planName: string;
}

export function NotificationSettings({
  onClose,
  planId,
  planName,
}: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [permissionGranted, setPermissionGranted] = useState(false);

  const NOTIFICATION_CACHE_KEY = "bible-reading:notification-settings-cache:v1";

  const readCachedNotificationSetting = (id: string): { enabled: boolean; time: string } | null => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, any>;
      const item = parsed?.[id];
      if (!item) return null;
      if (typeof item.enabled !== "boolean") return null;
      if (typeof item.time !== "string") return null;
      return { enabled: item.enabled, time: item.time };
    } catch {
      return null;
    }
  };

  const writeCachedNotificationSetting = (id: string, next: { enabled: boolean; time: string }) => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
      const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, any>;
      parsed[id] = { enabled: next.enabled, time: next.time, updatedAt: Date.now() };
      localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore cache failures
    }
  };

  useEffect(() => {
    checkNotificationPermission();
    loadSettings();
  }, [planId]);

  const checkNotificationPermission = async () => {
    if ("Notification" in window) {
      setPermissionGranted(Notification.permission === "granted");
    }
  };

  const ensureNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림을 지원하지 않습니다");
      return false;
    }

    if (Notification.permission === "granted") {
      setPermissionGranted(true);
      return true;
    }

    if (Notification.permission === "denied") {
      setPermissionGranted(false);
      alert("알림 권한이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해주세요");
      return false;
    }

    const permission = await Notification.requestPermission();
    const ok = permission === "granted";
    setPermissionGranted(ok);
    if (!ok) alert("알림 권한이 필요합니다");
    return ok;
  };

  const showNotification = async (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, icon: "/icon.svg" });
        return;
      }
    } catch {
      // fall back
    }

    try {
      new Notification(title, { body, icon: "/icon.svg" });
    } catch {
      // ignore
    }
  };

  const normalizeTime = (t: string) => {
    const parts = String(t || "").split(":");
    if (parts.length < 2) return t;
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  };

  const loadSettings = async () => {
    const cached = readCachedNotificationSetting(planId);
    if (cached) {
      setEnabled(cached.enabled);
      setTime(normalizeTime(cached.time));
    }

    try {
      const result = await api.getNotifications();
      const notification = result.notifications.find(
        (n: any) => n.planId === planId
      );
      if (notification) {
        const normalized = normalizeTime(notification.time);
        setEnabled(notification.enabled);
        setTime(normalized);
        writeCachedNotificationSetting(planId, { enabled: notification.enabled, time: normalized });
      } else {
        setEnabled(false);
        setTime("09:00");
        writeCachedNotificationSetting(planId, { enabled: false, time: "09:00" });
      }
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    }
  };

  const handleSave = async () => {
    if (enabled) {
      const ok = await ensureNotificationPermission();
      if (!ok) return;

      // Register push so notifications can arrive even when app is closed.
      await ensurePushSubscriptionRegistered();
    }

    try {
      const normalizedTime = normalizeTime(time);
      await api.saveNotification(planId, normalizedTime, enabled);

      writeCachedNotificationSetting(planId, { enabled, time: normalizedTime });

      alert("알림 설정이 저장되었습니다");
      onClose();
    } catch (err) {
      alert("알림 설정 저장에 실패했습니다");
    }
  };

  const handleTestNotification = () => {
    void (async () => {
      const ok = await ensureNotificationPermission();
      if (!ok) return;

      try {
        await ensurePushSubscriptionRegistered();
      } catch {
        // ignore
      }

      try {
        await api.sendTestPush();
      } catch {
        await showNotification(
          "테스트 알림",
          "오늘 말씀을 읽을 시간이에요. 알림이 정상적으로 작동합니다!"
        );
      }
    })();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-card text-card-foreground rounded-xl max-w-md w-full border border-border">
        <div className="border-b border-border p-6 bg-background/80 backdrop-blur rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2>알림 설정</h2>
                <p className="text-muted-foreground">오늘 말씀 알림</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!permissionGranted && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                알림을 받으려면 브라우저에서 알림 권한을 허용해주세요
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p>매일 알림 받기</p>
              <p className="text-sm text-muted-foreground">
                설정한 시간에 읽기 알림을 받습니다
              </p>
            </div>
            <label className="relative inline-block w-12 h-6">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <span className="absolute inset-0 bg-muted rounded-full peer-checked:bg-primary transition-colors cursor-pointer"></span>
              <span className="absolute left-1 top-1 w-4 h-4 bg-background rounded-full transition-transform peer-checked:translate-x-6 border border-border"></span>
            </label>
          </div>

          {enabled && (
            <div>
              <label className="block text-muted-foreground mb-2">알림 시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <button
            onClick={handleTestNotification}
            className="w-full px-4 py-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
          >
            테스트 알림 보내기
          </button>
        </div>

        <div className="border-t border-border p-6 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
