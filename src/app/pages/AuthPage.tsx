import { useAuthStore } from '../../stores/auth.store';
import { Auth } from '../components/Auth';

export function AuthPage() {
  const setUser = useAuthStore((state) => state.setUser);

  const handleAuthSuccess = async () => {
    // Supabase 세션에서 사용자 정보를 가져와 스토어에 저장
    const { getSession } = await import('../utils/api');
    const { session } = await getSession();
    
    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || '',
      });
    }
  };

  return <Auth onAuthSuccess={handleAuthSuccess} />;
}
