import { useEffect, useState } from "react";
import { BookOpen, Eye, EyeOff, Lock } from "lucide-react";
import * as authService from "../../services/authService";

export function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prepare = async () => {
      try {
        const { ready } = await authService.preparePasswordRecoverySession();
        setStatus(ready ? "ready" : "invalid");
      } catch (err) {
        console.error("Failed to prepare recovery session:", err);
        setStatus("invalid");
      }
    };
    void prepare();
  }, []);

  const goToLogin = async () => {
    try {
      await authService.signOut();
    } catch {
      // ignore
    }
    window.history.replaceState({}, document.title, "/");
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다");
      return;
    }

    setLoading(true);
    try {
      await authService.completePasswordReset(newPassword);
      setDone(true);
    } catch (err: any) {
      console.error("Password reset failed:", err);
      setError(err?.message || "비밀번호 재설정에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="mb-2">비밀번호 재설정</h1>
          <p className="text-muted-foreground">새 비밀번호를 설정해주세요</p>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border border-border/50 shadow-sm p-8">
          {status === "checking" && (
            <p className="text-sm text-muted-foreground text-center">링크를 확인하는 중...</p>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">유효하지 않거나 만료된 재설정 링크입니다.</p>
              </div>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
              >
                로그인 화면으로 이동
              </button>
            </div>
          )}

          {status === "ready" && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">새 비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-20 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    aria-pressed={showNewPassword}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">새 비밀번호 확인</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-20 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "변경 중..." : "새 비밀번호 저장"}
              </button>
            </form>
          )}

          {status === "ready" && done && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-700 text-sm">비밀번호가 성공적으로 변경되었습니다.</p>
              </div>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
              >
                로그인 화면으로 이동
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
