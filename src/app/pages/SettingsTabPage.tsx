import { useMemo, useState } from "react";
import { Bell, BookOpen, CheckCircle2, Flame, LogOut, UserCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/auth.store";
import { usePlans } from "../../hooks/usePlans";
import { getDailyStats } from "../utils/api";
import * as authService from "../../services/authService";
import { ProfileSettingsSection } from "./settings/ProfileSettingsSection";
import { NotificationsSettingsSection } from "./settings/NotificationsSettingsSection";

export function SettingsTabPage() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { plans } = usePlans();
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">("notifications");

  const { data: dailyStats = [] } = useQuery({
    queryKey: ["myPageDailyStats"],
    queryFn: () => getDailyStats().then((r) => r.stats),
    staleTime: 60_000,
    placeholderData: (prev) => prev ?? [],
  });

  const activePlansCount = useMemo(
    () => plans.filter((p: any) => (p?.status ?? "active") === "active").length,
    [plans]
  );

  const totalReadChapters = useMemo(
    () => dailyStats.reduce((sum, s) => sum + (Number.isFinite(Number(s.count)) ? Number(s.count) : 0), 0),
    [dailyStats]
  );

  const recent7DaysAverage = useMemo(() => {
    const byDate = new Map<string, number>();
    dailyStats.forEach((s) => {
      const ymd = String(s.date).split("T")[0];
      const count = Number(s.count);
      byDate.set(ymd, Number.isFinite(count) ? count : 0);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      total += byDate.get(ymd) ?? 0;
    }

    return Math.round((total / 7) * 10) / 10;
  }, [dailyStats]);

  const currentStreakDays = useMemo(() => {
    const byDate = new Map<string, number>();
    dailyStats.forEach((s) => {
      const ymd = String(s.date).split("T")[0];
      const count = Number(s.count);
      byDate.set(ymd, Number.isFinite(count) ? count : 0);
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 3650; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = byDate.get(ymd) ?? 0;
      if (count > 0) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }, [dailyStats]);

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
            <h1 className="text-xl font-bold">내 페이지</h1>
            <p className="text-xs text-muted-foreground mt-0.5">내 계정과 알림을 한곳에서 관리해요</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 space-y-8">
        <div className="bg-card text-card-foreground border border-border/50 rounded-[32px] px-7 py-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCircle2 className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">내 계정</p>
              <p className="text-base font-semibold truncate">{user?.name || "사용자"}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email || "이메일 정보 없음"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border/50 rounded-[32px] px-7 py-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">내 성경읽기</p>
              <h2 className="text-lg font-semibold">이번 여정 요약</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs">진행 중</span>
              </div>
              <p className="text-lg font-semibold">{activePlansCount}</p>
              <p className="text-xs text-muted-foreground">계획</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs">연속일</span>
              </div>
              <p className="text-lg font-semibold">{currentStreakDays}</p>
              <p className="text-xs text-muted-foreground">일</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs">누적 완료</span>
              </div>
              <p className="text-lg font-semibold">{Math.round(totalReadChapters)}</p>
              <p className="text-xs text-muted-foreground">장</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Bell className="w-4 h-4" />
                <span className="text-xs">최근 7일 평균</span>
              </div>
              <p className="text-lg font-semibold">{recent7DaysAverage}</p>
              <p className="text-xs text-muted-foreground">장/일</p>
            </div>
          </div>
        </div>

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
            <span className="inline-flex items-center gap-1.5">
              <Bell className="w-4 h-4" />
              알림
            </span>
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
            <span className="inline-flex items-center gap-1.5">
              <UserCircle2 className="w-4 h-4" />
              내 정보
            </span>
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