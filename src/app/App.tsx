import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth.store";
import { usePlanStore } from "../stores/plan.store";
import { AuthPage } from "./pages/AuthPage";
import { MainTabsPage } from "./pages/MainTabsPage";
import { DeveloperPlansPage } from "./pages/DeveloperPlansPage";
import * as authService from "../services/authService";
import { queryClient } from "../queryClient";
import { RouteLoadingOverlay } from "./components/RouteLoadingOverlay";
import { clearOfflineQueueForUser, flushOfflineProgressQueue } from "./utils/offlineProgressQueue";
import { OfflineBanner } from "./components/OfflineBanner";

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
        <OfflineBanner visible={!isOnline} />
        <RouteLoadingOverlay visible={showLoadingOverlay} />
        <AuthPage />
      </>
    );
  }

  if (isDeveloperRoute) {
    return (
      <>
        <OfflineBanner visible={!isOnline} />
        <RouteLoadingOverlay visible={showLoadingOverlay} />
        <DeveloperPlansPage
          onClose={() => {
            window.location.hash = "";
          }}
        />
      </>
    );
  }

  // 모바일 PWA 탭 기반 메인 화면
  return (
    <>
      <OfflineBanner visible={!isOnline} />
      <RouteLoadingOverlay visible={showLoadingOverlay} />
      <MainTabsPage />
    </>
  );
}
