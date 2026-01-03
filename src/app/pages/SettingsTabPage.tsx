import { useEffect, useMemo, useState } from "react";
import { Bell, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { usePlanStore } from "../../stores/plan.store";
import { usePlan } from "../../hooks/usePlans";
import * as api from "../utils/api";

export function SettingsTabPage() {
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const plan = usePlan(selectedPlanId);
  const logout = useAuthStore((s) => s.logout);

  const planName = useMemo(() => plan?.name ?? "", [plan]);

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    void checkNotificationPermission();
  }, []);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  const checkNotificationPermission = async () => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setPermissionGranted(true);
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        setPermissionGranted(permission === "granted");
      }
    }
  };

  const loadSettings = async () => {
    if (!selectedPlanId) return;

    try {
      const result = await api.getNotifications();
      const notification = result.notifications.find(
        (n: any) => n.planId === selectedPlanId
      );
      if (notification) {
        setEnabled(notification.enabled);
        setTime(notification.time);
      } else {
        setEnabled(false);
        setTime("09:00");
      }
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    }
  };

  const scheduleNotification = () => {
    if (!planName) return;

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
        new Notification("성경 읽기 알림", {
          body: `${planName} - 오늘의 읽기를 시작하세요!`,
          icon: "/icon.svg",
        });
      }
    }, delay);
  };

  const handleTestNotification = () => {
    if (!planName) {
      alert("먼저 계획을 선택해주세요");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification("테스트 알림", {
        body: `${planName} - 알림이 정상적으로 작동합니다!`,
        icon: "/icon.svg",
      });
    } else {
      alert("알림 권한이 필요합니다");
    }
  };

  const handleSave = async () => {
    if (!selectedPlanId) {
      alert("먼저 계획을 선택해주세요");
      return;
    }

    if (enabled && !permissionGranted) {
      alert("알림 권한이 필요합니다");
      return;
    }

    try {
      await api.saveNotification(selectedPlanId, time, enabled);

      if (enabled) {
        scheduleNotification();
      }

      alert("알림 설정이 저장되었습니다");
    } catch (err) {
      alert("알림 설정 저장에 실패했습니다");
    }
  };

  const handleSignOut = async () => {
    await api.signOut();
    logout();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-100 rounded-lg">
          <Settings className="w-6 h-6 text-gray-700" />
        </div>
        <div>
          <h1>설정</h1>
          <p className="text-gray-600">알림 설정을 관리합니다</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-100 rounded-lg">
            <Bell className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h2>알림</h2>
            <p className="text-gray-600">{planName || "계획을 선택하면 설정할 수 있어요"}</p>
          </div>
        </div>

        {!permissionGranted && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg mb-4">
            <p className="text-yellow-800 text-sm">알림을 받으려면 브라우저에서 알림 권한을 허용해주세요</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p>매일 알림 받기</p>
            <p className="text-sm text-gray-600">설정한 시간에 읽기 알림을 받습니다</p>
          </div>
          <label className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <span className="absolute inset-0 bg-gray-300 rounded-full peer-checked:bg-blue-500 transition-colors cursor-pointer"></span>
            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></span>
          </label>
        </div>

        {enabled && (
          <div className="mt-4">
            <label className="block text-gray-700 mb-2">알림 시간</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleTestNotification}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            테스트 알림
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
