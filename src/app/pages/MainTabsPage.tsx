import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Home, BookOpen, Settings, UsersRound } from "lucide-react";
import { HomeTab } from "./mainTabs/HomeTab";
import type { TabKey } from "./mainTabs/tabHash";
import { parseTabFromHash, setHashTab } from "./mainTabs/tabHash";
import { Skeleton } from "../components/ui/skeleton";

// Lazy load other tabs
const ProgressTab = lazy(() => import("./mainTabs/ProgressTab").then(m => ({ default: m.ProgressTab })));
const PlanSelectorPage = lazy(() => import("./PlanSelectorPage").then(m => ({ default: m.PlanSelectorPage })));
const FriendsTabPage = lazy(() => import("./FriendsTabPage").then(m => ({ default: m.FriendsTabPage })));
const SettingsTabPage = lazy(() => import("./SettingsTabPage").then(m => ({ default: m.SettingsTabPage })));

function TabLoading() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function MainTabsPage() {
  const defaultTab: TabKey = "home";
  const [tab, setTab] = useState<TabKey>(() => parseTabFromHash(window.location.hash).tab ?? defaultTab);
  
  // Lazy render: keep track of which tabs have been visited
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => {
    const t = parseTabFromHash(window.location.hash).tab ?? defaultTab;
    return new Set(["home", t]);
  });

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      return new Set(prev).add(tab);
    });
  }, [tab]);

  const swipeStateRef = useRef<{
    startX: number;
    startY: number;
    startAt: number; active: boolean;
  }>({ startX: 0, startY: 0, startAt: 0, active: false });

  useEffect(() => {
    // 요구사항: 앱이 열릴 때 기본 탭은 항상 홈
    if (!parseTabFromHash(window.location.hash).tab) {
      setHashTab("home");
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const { tab: nextTab } = parseTabFromHash(window.location.hash);
      if (nextTab) setTab(nextTab);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    // 잘못된 hash인 경우 기본 탭으로 정리
    const { tab: parsedTab } = parseTabFromHash(window.location.hash);
    if (!parsedTab) {
      setHashTab(defaultTab);
    }
  }, [tab, defaultTab]);

  const tabs = useMemo(
    () =>
      [
        { key: "home" as const, label: "읽기", icon: Home },
        { key: "progress" as const, label: "진행률", icon: BarChart3 },
        { key: "add" as const, label: "계획", icon: BookOpen },
        { key: "friends" as const, label: "친구", icon: UsersRound },
        { key: "settings" as const, label: "설정", icon: Settings },
      ],
    []
  );

  const tabOrder = useMemo(() => tabs.map((t) => t.key), [tabs]);

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
    // If the user swipes inside a control, do not change tabs.
    if (target.closest("input, textarea, select, button, a, [role='button']")) return true;
    return false;
  };

  const moveTabBy = (delta: number) => {
    const idx = tabOrder.indexOf(tab);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= tabOrder.length) return;
    setHashTab(tabOrder[nextIdx]);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <main
        className="pb-24"
        onTouchStart={(e) => {
          if (e.touches.length !== 1) return;
          if (isInteractiveTarget(e.target)) return;
          const t = e.touches[0];
          swipeStateRef.current = {
            startX: t.clientX,
            startY: t.clientY,
            startAt: Date.now(),
            active: true,
          };
        }}
        onTouchEnd={(e) => {
          const state = swipeStateRef.current;
          if (!state.active) return;
          swipeStateRef.current.active = false;

          // TouchEnd touches is empty; use changedTouches.
          const t = e.changedTouches[0];
          if (!t) return;

          const dx = t.clientX - state.startX;
          const dy = t.clientY - state.startY;
          const dt = Date.now() - state.startAt;

          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          // Horizontal swipe only: avoid interfering with vertical scroll.
          const isHorizontal = absX > 60 && absX > absY * 1.5;
          const isQuickEnough = dt < 700;
          if (!isHorizontal || !isQuickEnough) return;

          if (dx < 0) moveTabBy(1); // swipe left -> next tab
          else moveTabBy(-1); // swipe right -> prev tab
        }}
      >
        <div hidden={tab !== "home"}>
          <HomeTab />
        </div>
        <div hidden={tab !== "progress"}>
          <Suspense fallback={<TabLoading />}>
            {visitedTabs.has("progress") && <ProgressTab />}
          </Suspense>
        </div>
        <div hidden={tab !== "add"}>
          <Suspense fallback={<TabLoading />}>
            {visitedTabs.has("add") && <PlanSelectorPage embedded />}
          </Suspense>
        </div>
        <div hidden={tab !== "friends"}>
          <Suspense fallback={<TabLoading />}>
            {visitedTabs.has("friends") && <FriendsTabPage isActive={tab === "friends"} />}
          </Suspense>
        </div>
        <div hidden={tab !== "settings"}>
          <Suspense fallback={<TabLoading />}>
            {visitedTabs.has("settings") && <SettingsTabPage />}
          </Suspense>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="max-w-4xl mx-auto grid grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setHashTab(t.key)}
                className={`py-3 flex flex-col items-center gap-1 text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
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