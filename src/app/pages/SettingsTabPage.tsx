import { useState } from "react";
import { LogOut } from "lucide-react";
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
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">설정</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pt-6">
        <div className="bg-card text-card-foreground border border-border rounded-xl p-2 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={
              activeTab === "notifications"
                ? "flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground transition-colors"
                : "flex-1 px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            }
          >
            알림
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={
              activeTab === "profile"
                ? "flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground transition-colors"
                : "flex-1 px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            }
          >
            프로필
          </button>
        </div>

        {activeTab === "profile" ? <ProfileSettingsSection /> : <NotificationsSettingsSection />}

        <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}