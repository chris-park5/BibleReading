import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { usePlanStore } from "../../../stores/plan.store";
import { usePlans } from "../../../hooks/usePlans";
import * as notificationService from "../../../services/notificationService";
import { ensurePushSubscriptionRegistered } from "../../utils/pushClient";
import * as api from "../../utils/api";
import { readCachedNotificationSetting, writeCachedNotificationSetting } from "../../utils/notificationSettingsCache";

export function NotificationsSettingsSection() {
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { plans } = usePlans();
  const activePlanId = selectedPlanId || (plans.length > 0 ? plans[0].id : null);

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [notificationSyncWarning, setNotificationSyncWarning] = useState<string | null>(null);

  useEffect(() => {
    void checkNotificationPermission();
  }, []);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  // keep memo for parity with previous structure (avoids unnecessary re-renders if extended later)
  useMemo(() => activePlanId, [activePlanId]);

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

    // On mobile, permission requests often require a user gesture.
    const permission = await Notification.requestPermission();
    const ok = permission === "granted";
    setPermissionGranted(ok);
    if (!ok) {
      alert("알림 권한이 필요합니다");
    }
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
      // fall back to window Notification
    }

    try {
      new Notification(title, { body, icon: "/icon.svg" });
    } catch {
      // ignore
    }
  };

  const loadSettings = async () => {
    if (!activePlanId) return;

    setNotificationSyncWarning(null);

    // Show last known setting immediately to avoid "reset" 느낌 (e.g., when auth/session is still recovering).
    const cached = readCachedNotificationSetting(activePlanId);
    if (cached) {
      setEnabled(cached.enabled);
      setTime(cached.time);
    }

    try {
      const result = await notificationService.getNotifications();
      const notification = result.notifications.find((n: any) => n.planId === activePlanId);
      if (notification) {
        setEnabled(notification.enabled);
        setTime(notification.time);
        writeCachedNotificationSetting(activePlanId, { enabled: notification.enabled, time: notification.time });
      } else {
        // No server-side setting: fall back to defaults, and cache it.
        setEnabled(false);
        setTime("09:00");
        writeCachedNotificationSetting(activePlanId, { enabled: false, time: "09:00" });
      }
    } catch (err) {
      console.error("Failed to load notification settings:", err);

      const message = typeof (err as any)?.message === "string" ? (err as any).message : "";
      const status = (err as any)?.status;
      if (status === 401 || message.includes("로그인이 필요")) {
        setNotificationSyncWarning("서버에서 알림 설정을 불러오려면 로그인이 필요합니다");
      }
    }
  };

  const scheduleNotification = () => {
    const [hours, minutes] = time.split(":");
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(hours),
      parseInt(minutes)
    );

    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      if (Notification.permission === "granted") {
        void showNotification(
          "성경 읽기 알림",
          "오늘 말씀을 읽을 시간이에요. 앱을 열어 오늘의 읽기를 확인하세요."
        );
      }
    }, delay);
  };

  const handleTestNotification = () => {
    if (!activePlanId) {
      alert("먼저 계획을 선택해주세요");
      return;
    }

    void (async () => {
      const ok = await ensureNotificationPermission();
      if (!ok) return;

      // Register push so notifications can arrive even when app is closed.
      try {
        await ensurePushSubscriptionRegistered();
      } catch {
        // ignore
      }

      try {
        // Prefer server-sent push to verify background delivery.
        await api.sendTestPush();
      } catch {
        // Fallback: local notification
        await showNotification(
          "테스트 알림",
          "오늘 말씀을 읽을 시간이에요. 알림이 정상적으로 작동합니다!"
        );
      }
    })();
  };

  const handleSave = async () => {
    if (!activePlanId) {
      alert("먼저 계획을 선택해주세요");
      return;
    }

    if (enabled) {
      const ok = await ensureNotificationPermission();
      if (!ok) return;

      // Push subscription is required for background delivery.
      await ensurePushSubscriptionRegistered();
    }

    try {
      await notificationService.saveNotification(activePlanId, time, enabled);

      // Persist UI state locally as well to survive browser restarts / temporary auth issues.
      writeCachedNotificationSetting(activePlanId, { enabled, time });

      if (enabled) {
        scheduleNotification();
      }

      alert("알림 설정이 저장되었습니다");
    } catch (err) {
      const message = typeof (err as any)?.message === "string" ? (err as any).message : "";
      const status = (err as any)?.status;
      if (status === 401 || message.includes("로그인이 필요")) {
        setNotificationSyncWarning("서버에 저장하려면 로그인이 필요합니다");
      }
      alert("알림 설정 저장에 실패했습니다");
    }
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2>알림</h2>
          <p className="text-muted-foreground">오늘 말씀 알림</p>
        </div>
      </div>

      {!permissionGranted && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <p className="text-yellow-800 text-sm">알림을 받으려면 브라우저에서 알림 권한을 허용해주세요</p>
        </div>
      )}

      {notificationSyncWarning && (
        <div className="p-4 bg-muted/40 border border-border rounded-lg mb-4">
          <p className="text-muted-foreground text-sm">{notificationSyncWarning}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p>매일 알림 받기</p>
          <p className="text-sm text-muted-foreground">설정한 시간에 읽기 알림을 받습니다</p>
        </div>
        <label className="relative inline-block w-12 h-6">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const next = e.target.checked;
              if (!next) {
                setEnabled(false);
                return;
              }

              void (async () => {
                const ok = await ensureNotificationPermission();
                setEnabled(ok);
              })();
            }}
            className="sr-only peer"
          />
          <span className="absolute inset-0 bg-muted rounded-full peer-checked:bg-primary transition-colors cursor-pointer"></span>
          <span className="absolute left-1 top-1 w-4 h-4 bg-background rounded-full transition-transform peer-checked:translate-x-6 border border-border"></span>
        </label>
      </div>

      {enabled && (
        <div className="mt-4">
          <label className="block text-muted-foreground mb-2">알림 시간</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleTestNotification}
          className="flex-1 px-4 py-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
        >
          테스트 알림
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  );
}
