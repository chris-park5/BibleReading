import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth.store";
import { usePlanStore } from "../stores/plan.store";
import { MainTabsPage } from "./pages/MainTabsPage";
import * as authService from "../services/authService";
import { queryClient } from "../queryClient";
import { RouteLoadingOverlay } from "./components/RouteLoadingOverlay";
import { clearOfflineQueueForUser, flushOfflineProgressQueue } from "./utils/offlineProgressQueue";
import { OfflineBanner } from "./components/OfflineBanner";
import { Button } from "./components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isRunningStandalone() {
  if (typeof window === "undefined") return false;

  // Chrome/Edge/Android
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;

  // iOS Safari
  const iosStandalone = Boolean((navigator as unknown as { standalone?: boolean }).standalone);

  return Boolean(displayModeStandalone || iosStandalone);
}

function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(() => isRunningStandalone());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const DISMISS_KEY = "pwa-install-dismissed-at";
    const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
    const now = Date.now();
    const isDismissed = dismissedAt > 0 && now - dismissedAt < DISMISS_WINDOW_MS;
    if (isDismissed) setDismissed(true);

    const onBeforeInstallPrompt = (e: Event) => {
      // default mini-infobar(안드로이드)을 막고, 우리가 버튼으로 트리거
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (installed || isRunningStandalone()) return null;
  if (dismissed) return null;
  if (!deferredPrompt) return null;

  const onInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // 사용자가 거절하면 재노출이 제한될 수 있어서, 여기서는 배너만 닫습니다.
      if (choice.outcome !== "accepted") {
        window.localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
        setDismissed(true);
      }
      setDeferredPrompt(null);
    } catch {
      // prompt 실패 시 배너를 닫아 UX 깨짐 방지
      window.localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
      setDismissed(true);
      setDeferredPrompt(null);
    }
  };

  const onDismiss = () => {
    window.localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">앱으로 설치할 수 있어요</p>
          <p className="text-xs text-muted-foreground">홈 화면에 추가해서 더 빠르게 사용하세요.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            닫기
          </Button>
          <Button size="sm" onClick={onInstall}>
            설치
          </Button>
        </div>
      </div>
    </div>
  );
}

const AuthPage = lazy(() => import("./pages/AuthPage"));
const DeveloperPlansPage = lazy(async () => {
  const mod = await import("./pages/DeveloperPlansPage");
  return { default: mod.DeveloperPlansPage };
});

class LazyRouteErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error);

      return (
        <div className="min-h-screen bg-white p-6">
          <div className="max-w-md mx-auto">
            <h1 className="text-lg font-semibold mb-2">화면을 불러오지 못했습니다</h1>
            <p className="text-sm text-gray-700 mb-4">
              네트워크 상태 또는 캐시 문제로 페이지 로딩이 실패할 수 있습니다. 새로고침 후 다시 시도해주세요.
            </p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words border border-gray-200 rounded-md p-3 mb-4">
              {message}
            </pre>
            <button
              className="px-4 py-2 rounded-md bg-blue-600 text-white"
              onClick={() => window.location.reload()}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore();
  const prevUserIdRef = useRef<string | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const navSeqRef = useRef(0);
  const isFetchingRef = useRef(0);
  const isMutatingRef = useRef(0);

  useEffect(() => {
    isFetchingRef.current = isFetching;
  }, [isFetching]);

  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === "true";
  const isDeveloperRoute = devPageEnabled && hash === "#/dev";

  // 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { session } = await authService.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || '',
          });
        } else {
          // 세션이 없으면 persisted auth 상태를 정리
          setUser(null);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        setUser(null);
      }
    };

    checkSession();
  }, [setUser]);

  // 계정 전환/로그아웃 시: 이전 계정 데이터가 남지 않도록 캐시/선택 상태 초기화
  useEffect(() => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const prevUserId = prevUserIdRef.current;

    if (prevUserId !== userId) {
      // 이전 계정의 오프라인 큐는 더 이상 의미가 없으므로 정리
      if (prevUserId) {
        void clearOfflineQueueForUser(prevUserId);
      }

      queryClient.clear();

      // plan selection도 계정별로 분리되지 않으므로, 전환 시 무조건 초기화
      try {
        usePlanStore.persist?.clearStorage?.();
      } catch {
        // ignore
      }
      usePlanStore.setState({
        selectedPlanId: null,
        currentDay: 1,
        viewDate: null,
        showPlanSelector: true,
        showCustomPlanCreator: false,
        showFriendsPanel: false,
        showNotificationSettings: false,
      });
    }

    prevUserIdRef.current = userId;
  }, [isAuthenticated]);

  // 오프라인에서 쌓인 진도 변경을 온라인 복구 시 자동 동기화
  useEffect(() => {
    const tryFlush = () => {
      if (!useAuthStore.getState().isAuthenticated) return;
      void flushOfflineProgressQueue();
    };

    // 앱 시작 시(온라인이라면) 한번 시도
    tryFlush();

    // 네트워크가 돌아오면 자동 시도
    window.addEventListener("online", tryFlush);
    return () => window.removeEventListener("online", tryFlush);
  }, [isAuthenticated]);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // 느린 페이지 전환/데이터 로딩 시에만(지연 후) 로딩 오버레이 표시
  useEffect(() => {
    navSeqRef.current += 1;
    const seq = navSeqRef.current;

    // 오프라인에서는 네트워크 대기가 길어질 수 있어 전환 오버레이를 띄우지 않습니다.
    if (!isOnline) {
      setShowLoadingOverlay(false);
      return;
    }

    // 200ms 안에 끝나면 오버레이를 띄우지 않아서 깜빡임 방지
    const t = window.setTimeout(() => {
      if (seq !== navSeqRef.current) return;
      // Important: only show loader for *route changes*.
      // This prevents the overlay from showing on in-page interactions
      // like progress checkbox updates.
      if ((isFetchingRef.current ?? 0) > 0 || (isMutatingRef.current ?? 0) > 0) {
        setShowLoadingOverlay(true);
      }
    }, 200);

    return () => window.clearTimeout(t);
  }, [hash]);

  useEffect(() => {
    if (!isOnline) {
      setShowLoadingOverlay(false);
      return;
    }
    if ((isFetching ?? 0) === 0 && (isMutating ?? 0) === 0) {
      setShowLoadingOverlay(false);
    }
  }, [isFetching, isMutating, isOnline]);

  // 인증 안 됨 -> AuthPage
  if (!isAuthenticated) {
    return (
      <>
        <InstallAppBanner />
        <OfflineBanner visible={!isOnline} />
        <LazyRouteErrorBoundary>
          <Suspense fallback={<RouteLoadingOverlay visible={true} />}>
            <AuthPage />
          </Suspense>
        </LazyRouteErrorBoundary>
      </>
    );
  }

  if (isDeveloperRoute) {
    return (
      <>
        <OfflineBanner visible={!isOnline} />
        <LazyRouteErrorBoundary>
          <Suspense fallback={<RouteLoadingOverlay visible={true} />}>
            <DeveloperPlansPage
              onClose={() => {
                window.location.hash = "";
              }}
            />
          </Suspense>
        </LazyRouteErrorBoundary>
      </>
    );
  }

  // 모바일 PWA 탭 기반 메인 화면
  return (
    <>
      <InstallAppBanner />
      <OfflineBanner visible={!isOnline} />
      <RouteLoadingOverlay visible={showLoadingOverlay} />
      <MainTabsPage />
    </>
  );
}
