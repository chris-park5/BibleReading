import { useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import * as authService from "../../services/authService";
import { ProfileSettingsSection } from "./settings/ProfileSettingsSection";
import { NotificationsSettingsSection } from "./settings/NotificationsSettingsSection";

export function SettingsTabPage() {
  const logout = useAuthStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">("notifications");

  const handleSignOut = async () => {
    await authService.signOut();
    logout();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-lg">
            <Settings className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">설정</h1>
            <p className="text-gray-600">프로필과 알림 설정을 관리합니다</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-2 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={
            activeTab === "notifications"
              ? "flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white transition-colors"
              : "flex-1 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          }
        >
          알림
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={
            activeTab === "profile"
              ? "flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white transition-colors"
              : "flex-1 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          }
        >
          프로필
        </button>
      </div>

      {activeTab === "profile" ? <ProfileSettingsSection /> : <NotificationsSettingsSection />}

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
