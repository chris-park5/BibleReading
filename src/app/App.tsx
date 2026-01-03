import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/auth.store";
import { AuthPage } from "./pages/AuthPage";
import { MainTabsPage } from "./pages/MainTabsPage";
import { DeveloperPlansPage } from "./pages/DeveloperPlansPage";
import * as api from "./utils/api";

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore();
  const [hash, setHash] = useState(() => window.location.hash);

  const devPageEnabled = import.meta.env.VITE_ENABLE_DEV_PAGE === "true";
  const isDeveloperRoute = devPageEnabled && hash === "#/dev";

  // 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { session } = await api.getSession();
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

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // 인증 안 됨 -> AuthPage
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (isDeveloperRoute) {
    return (
      <DeveloperPlansPage
        onClose={() => {
          window.location.hash = "";
        }}
      />
    );
  }

  // 모바일 PWA 탭 기반 메인 화면
  return <MainTabsPage />;
}
