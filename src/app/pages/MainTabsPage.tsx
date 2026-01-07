import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Home, PlusSquare, Settings, UsersRound } from "lucide-react";
import { PlanSelectorPage } from "./PlanSelectorPage";
import { FriendsTabPage } from "./FriendsTabPage";
import { SettingsTabPage } from "./SettingsTabPage";
import { HomeTab } from "./mainTabs/HomeTab";
import { ProgressTab } from "./mainTabs/ProgressTab";
import type { TabKey } from "./mainTabs/tabHash";
import { parseTabFromHash, setHashTab } from "./mainTabs/tabHash";

export function MainTabsPage() {
  const defaultTab: TabKey = "home";
  const [tab, setTab] = useState<TabKey>(() => parseTabFromHash(window.location.hash) ?? defaultTab);

  useEffect(() => {
    // 요구사항: 앱이 열릴 때 기본 탭은 항상 홈
    if (window.location.hash !== "#/home") {
      setHashTab("home");
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = parseTabFromHash(window.location.hash);
      if (next) setTab(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    // 잘못된 hash인 경우 기본 탭으로 정리
    const parsed = parseTabFromHash(window.location.hash);
    if (!parsed) {
      setHashTab(defaultTab);
    }
  }, [tab, defaultTab]);

  const tabs = useMemo(
    () =>
      [
        { key: "home" as const, label: "홈", icon: Home },
        { key: "progress" as const, label: "진도율", icon: BarChart3 },
        { key: "add" as const, label: "계획 추가", icon: PlusSquare },
        { key: "friends" as const, label: "친구", icon: UsersRound },
        { key: "settings" as const, label: "설정", icon: Settings },
      ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <main className="pb-20">
        {tab === "home" && <HomeTab />}
        {tab === "progress" && <ProgressTab />}
        {tab === "add" && <PlanSelectorPage embedded />}
        {tab === "friends" && <FriendsTabPage />}
        {tab === "settings" && <SettingsTabPage />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t-2 border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setHashTab(t.key)}
                className={`py-3 flex flex-col items-center gap-1 text-sm transition-colors ${
                  active ? "text-blue-600" : "text-gray-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
