import { useEffect, useMemo, useState } from "react";
import { Bell, Eye, EyeOff, LogOut, Settings, User, UserX } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { usePlanStore } from "../../stores/plan.store";
import { usePlans } from "../../hooks/usePlans";
import * as authService from "../../services/authService";
import * as notificationService from "../../services/notificationService";
import { ensurePushSubscriptionRegistered } from "../utils/pushClient";
import * as api from "../utils/api";

export function SettingsTabPage() {
  const selectedPlanId = usePlanStore((s) => s.selectedPlanId);
  const { plans } = usePlans();
  const activePlanId = selectedPlanId || (plans.length > 0 ? plans[0].id : null);
  const plan = useMemo(() => plans.find((p) => p.id === activePlanId) ?? null, [plans, activePlanId]);
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const planName = useMemo(() => plan?.name ?? "", [plan]);

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [notificationSyncWarning, setNotificationSyncWarning] = useState<string | null>(null);

  const NOTIFICATION_CACHE_KEY = "bible-reading:notification-settings-cache:v1";

  const readCachedNotificationSetting = (planId: string): { enabled: boolean; time: string } | null => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, any>;
      const item = parsed?.[planId];
      if (!item) return null;
      if (typeof item.enabled !== "boolean") return null;
      if (typeof item.time !== "string") return null;
      return { enabled: item.enabled, time: item.time };
    } catch {
      return null;
    }
  };

  const writeCachedNotificationSetting = (planId: string, next: { enabled: boolean; time: string }) => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
      const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, any>;
      parsed[planId] = { enabled: next.enabled, time: next.time, updatedAt: Date.now() };
      localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore cache failures
    }
  };

  const [activeTab, setActiveTab] = useState<"profile" | "notifications">("notifications");

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    void checkNotificationPermission();
  }, []);

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

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
      const notification = result.notifications.find(
        (n: any) => n.planId === activePlanId
      );
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

  const loadProfile = async () => {
    if (!userId) return;
    setProfileLoading(true);
    try {
      const result = await authService.getMyProfile();
      setProfileUsername(result.profile.username);
      setProfileEmail(result.profile.email);
      setNewUsername(result.profile.username);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setProfileLoading(false);
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

  const handleSignOut = async () => {
    await authService.signOut();
    logout();
  };

  const handleDeleteAccount = async () => {
    const confirmMessage = "정말로 회원 탈퇴하시겠습니까?\n\n모든 데이터(계획, 진도 등)가 영구적으로 삭제되며 복구할 수 없습니다.";
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const doubleConfirm = prompt('회원 탈퇴를 진행하려면 "탈퇴"를 입력하세요:');
    
    if (doubleConfirm !== "탈퇴") {
      alert("회원 탈퇴가 취소되었습니다.");
      return;
    }

    try {
      await authService.deleteAccount();
      alert("회원 탈퇴가 완료되었습니다.");
      await authService.signOut();
      logout();
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleUpdateUsername = async () => {
    if (!userId) {
      alert("로그인이 필요합니다");
      return;
    }

    const next = newUsername.trim();
    if (!next) {
      alert("새 아이디를 입력해주세요");
      return;
    }

    if (next === profileUsername) {
      alert("현재 아이디와 동일합니다");
      return;
    }

    try {
      setUpdatingUsername(true);
      await authService.updateUsername(next);
      setProfileUsername(next);
      alert("아이디가 변경되었습니다");
    } catch (err: any) {
      console.error("Failed to update username:", err);
      alert(err?.message ?? "아이디 변경에 실패했습니다");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!userId) {
      alert("로그인이 필요합니다");
      return;
    }

    if (!currentPassword) {
      alert("현재 비밀번호를 입력해주세요");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      alert("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      alert("새 비밀번호가 일치하지 않습니다");
      return;
    }

    try {
      setUpdatingPassword(true);
      await authService.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowNewPasswordConfirm(false);
      alert("비밀번호가 변경되었습니다");
    } catch (err: any) {
      console.error("Failed to update password:", err);
      alert(err?.message ?? "비밀번호 변경에 실패했습니다");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-100 rounded-lg">
          <Settings className="w-6 h-6 text-gray-700" />
        </div>
        <div>
          <h1>설정</h1>
          <p className="text-gray-600">프로필과 알림 설정을 관리합니다</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-2 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === "profile" ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          프로필
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === "notifications" ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          알림
        </button>
      </div>

      {activeTab === "profile" && (
        <>
          <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2>프로필</h2>
                <p className="text-gray-600">
                  {profileLoading ? "불러오는 중..." : `${profileUsername || "-"} / ${profileEmail || "-"}`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">아이디 변경</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="새 아이디"
                  minLength={3}
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-gray-500">3-20자, 영문자/숫자/밑줄(_)만 사용 가능</p>
                <button
                  type="button"
                  onClick={handleUpdateUsername}
                  disabled={updatingUsername}
                  className="mt-3 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updatingUsername ? "변경 중..." : "아이디 변경"}
                </button>
              </div>

              <div className="border-t-2 border-gray-100 pt-4">
                <label className="block text-gray-700 mb-2">비밀번호 변경</label>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="현재 비밀번호"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showCurrentPassword ? "현재 비밀번호 숨기기" : "현재 비밀번호 보기"}
                      aria-pressed={showCurrentPassword}
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="새 비밀번호 (6자 이상)"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showNewPassword ? "새 비밀번호 숨기기" : "새 비밀번호 보기"}
                      aria-pressed={showNewPassword}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPasswordConfirm ? "text" : "password"}
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="새 비밀번호 확인"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showNewPasswordConfirm ? "새 비밀번호 확인 숨기기" : "새 비밀번호 확인 보기"}
                      aria-pressed={showNewPasswordConfirm}
                    >
                      {showNewPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={updatingPassword}
                  className="mt-3 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updatingPassword ? "변경 중..." : "비밀번호 변경"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-red-200 rounded-xl p-6">
            <p className="text-sm text-gray-600 mb-4">
              회원 탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 rounded-lg transition-colors"
            >
              <UserX className="w-5 h-5" />
              회원 탈퇴
            </button>
          </div>
        </>
      )}

      {activeTab === "notifications" && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Bell className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h2>알림</h2>
              <p className="text-gray-600">오늘 말씀 알림</p>
            </div>
          </div>

          {!permissionGranted && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg mb-4">
              <p className="text-yellow-800 text-sm">알림을 받으려면 브라우저에서 알림 권한을 허용해주세요</p>
            </div>
          )}

          {notificationSyncWarning && (
            <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg mb-4">
              <p className="text-gray-700 text-sm">{notificationSyncWarning}</p>
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
      )}

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
