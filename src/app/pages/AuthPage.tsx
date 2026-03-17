import { useAuthStore } from '../../stores/auth.store';
import { Auth } from '../components/Auth';
import { getSession } from '../utils/api';
import { ResetPasswordPage } from './ResetPasswordPage';

export function AuthPage() {
  const setUser = useAuthStore((state) => state.setUser);

  const isRecoveryRoute = (() => {
    if (typeof window === "undefined") return false;
    const search = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    return (
      window.location.pathname === "/auth/reset-password" ||
      search.get("type") === "recovery" ||
      search.has("code") ||
      hash.includes("type=recovery") ||
      hash.includes("access_token=")
    );
  })();

  const handleAuthSuccess = async () => {
    // Supabase 세션에서 사용자 정보를 가져와 스토어에 저장
    const { session } = await getSession();
    
    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || '',
      });
    }
  };

  if (isRecoveryRoute) {
    return <ResetPasswordPage />;
  }

  return <Auth onAuthSuccess={handleAuthSuccess} />;
}

export default AuthPage;
