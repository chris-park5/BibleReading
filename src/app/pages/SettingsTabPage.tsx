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
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-all duration-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">설정</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 space-y-8">
        <div className="relative w-full rounded-[999px] bg-muted/35 p-1 shadow-xs">
          <div
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-[999px] bg-background shadow-sm transition-transform duration-500 ${
              activeTab === "profile" ? "translate-x-full" : ""
            }`}
          />
          <div className="relative flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={
              activeTab === "notifications"
                ? "flex-1 px-4 py-2 rounded-[999px] bg-transparent text-primary font-medium transition-colors"
                : "flex-1 px-4 py-2 rounded-[999px] text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            알림
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={
              activeTab === "profile"
                ? "flex-1 px-4 py-2 rounded-[999px] bg-transparent text-primary font-medium transition-colors"
                : "flex-1 px-4 py-2 rounded-[999px] text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            프로필
          </button>
          </div>
        </div>

        {activeTab === "profile" ? <ProfileSettingsSection /> : <NotificationsSettingsSection />}

        <div className="bg-card text-card-foreground border border-border/50 rounded-[32px] px-7 py-6 shadow-sm">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-muted-foreground hover:bg-accent/50 rounded-[18px] transition-colors"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}