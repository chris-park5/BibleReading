import { useState } from "react";
import { BookOpen, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import * as authService from "../../services/authService";

interface AuthProps {
  onAuthSuccess: () => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await authService.signUp({ email, password, name, username });
        // 회원가입 후 자동 로그인 (username 사용)
        await authService.signIn({ username, password });
      } else {
        // 로그인은 username으로
        await authService.signIn({ username, password });
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "인증에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    
    try {
      await authService.signInWithGoogle();
      // OAuth 리다이렉트가 발생하므로 onAuthSuccess는 리다이렉트 후에 호출됩니다
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message || "구글 로그인에 실패했습니다");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="mb-2">성경 읽기 계획</h1>
          <p className="text-gray-600">
            {isSignUp ? "새 계정을 만들어주세요" : "로그인하여 시작하세요"}
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-gray-700 mb-2">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="홍길동"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-gray-700 mb-2">
                {isSignUp ? "아이디" : "아이디"}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder={isSignUp ? "아이디를 입력하세요" : "아이디"}
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  title="영문자, 숫자, 밑줄(_)만 사용 가능합니다"
                />
              </div>
              {isSignUp && (
                <p className="mt-1 text-xs text-gray-500">
                  3-20자, 영문자/숫자/밑줄(_)만 사용 가능
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-20 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "처리 중..." : isSignUp ? "회원가입" : "로그인"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700">Google로 {isSignUp ? "회원가입" : "로그인"}</span>
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setShowPassword(false);
              }}
              className="text-blue-500 hover:text-blue-600"
            >
              {isSignUp
                ? "이미 계정이 있으신가요? 로그인"
                : "계정이 없으신가요? 회원가입"}
            </button>
          </div>

          {/* Setup Notice */}
          <div className="mt-6 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm">
              <strong>참고:</strong> 구글 로그인을 사용하려면{" "}
              <a
                href="https://supabase.com/docs/guides/auth/social-login/auth-google"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-800"
              >
                Supabase 설정
              </a>
              을 완료해야 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}