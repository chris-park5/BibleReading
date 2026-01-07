import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import * as api from "../utils/api";

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

  useEffect(() => {
    checkNotificationPermission();
    loadSettings();
  }, []);

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
    try {
      const result = await api.getNotifications();
      const notification = result.notifications.find(
        (n: any) => n.planId === planId
      );
      if (notification) {
        setEnabled(notification.enabled);
        setTime(notification.time);
      }
    } catch (err) {
      console.error("Failed to load notification settings:", err);
    }
  };

  const handleSave = async () => {
    if (enabled && !permissionGranted) {
      alert("알림 권한이 필요합니다");
      return;
    }

    try {
      await api.saveNotification(planId, time, enabled);

      if (enabled) {
        scheduleNotification();
      }

      alert("알림 설정이 저장되었습니다");
      onClose();
    } catch (err) {
      alert("알림 설정 저장에 실패했습니다");
    }
  };

  const scheduleNotification = () => {
    // 매일 정해진 시간에 알림 (실제로는 서비스 워커나 백그라운드 작업 필요)
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
          body: "오늘 말씀을 읽을 시간이에요. 앱을 열어 오늘의 읽기를 확인하세요.",
          icon: "/icon.svg",
        });
      }
    }, delay);
  };

  const handleTestNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("테스트 알림", {
        body: "오늘 말씀을 읽을 시간이에요. 알림이 정상적으로 작동합니다!",
        icon: "/icon.svg",
      });
    } else {
      alert("알림 권한이 필요합니다");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="border-b-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Bell className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h2>알림 설정</h2>
                <p className="text-gray-600">오늘 말씀 알림</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!permissionGranted && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                알림을 받으려면 브라우저에서 알림 권한을 허용해주세요
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p>매일 알림 받기</p>
              <p className="text-sm text-gray-600">
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
              <span className="absolute inset-0 bg-gray-300 rounded-full peer-checked:bg-blue-500 transition-colors cursor-pointer"></span>
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></span>
            </label>
          </div>

          {enabled && (
            <div>
              <label className="block text-gray-700 mb-2">알림 시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleTestNotification}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            테스트 알림 보내기
          </button>
        </div>

        <div className="border-t-2 border-gray-200 p-6 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
