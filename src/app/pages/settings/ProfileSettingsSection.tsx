import { useEffect, useState } from "react";
import { Eye, EyeOff, User, UserX } from "lucide-react";
import { useAuthStore } from "../../../stores/auth.store";
import * as authService from "../../../services/authService";

export function ProfileSettingsSection() {
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    setProfileLoading(true);
    try {
      const result = await authService.getMyProfile();
      setProfileUsername(result.profile.username);
      setProfileEmail(result.profile.email);
      setNewUsername(result.profile.username);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmMessage =
      "정말로 회원 탈퇴하시겠습니까?\n\n모든 데이터(계획, 진도 등)가 영구적으로 삭제되며 복구할 수 없습니다.";

    if (!confirm(confirmMessage)) {
      return;
    }

    const doubleConfirm = prompt('회원 탈퇴를 진행하려면 "탈퇴"를 입력하세요:');

    if (doubleConfirm !== "탈퇴") {
      alert("회원 탈퇴가 취소되었습니다.");
      return;
    }

    try {
      await authService.deleteAccount();
      alert("회원 탈퇴가 완료되었습니다.");
      await authService.signOut();
      logout();
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleUpdateUsername = async () => {
    if (!userId) {
      alert("로그인이 필요합니다");
      return;
    }

    const next = newUsername.trim();
    if (!next) {
      alert("새 아이디를 입력해주세요");
      return;
    }

    if (next === profileUsername) {
      alert("현재 아이디와 동일합니다");
      return;
    }

    try {
      setUpdatingUsername(true);
      await authService.updateUsername(next);
      setProfileUsername(next);
      alert("아이디가 변경되었습니다");
    } catch (err: any) {
      console.error("Failed to update username:", err);
      alert(err?.message ?? "아이디 변경에 실패했습니다");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!userId) {
      alert("로그인이 필요합니다");
      return;
    }

    if (!currentPassword) {
      alert("현재 비밀번호를 입력해주세요");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      alert("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      alert("새 비밀번호가 일치하지 않습니다");
      return;
    }

    try {
      setUpdatingPassword(true);
      await authService.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowNewPasswordConfirm(false);
      alert("비밀번호가 변경되었습니다");
    } catch (err: any) {
      console.error("Failed to update password:", err);
      alert(err?.message ?? "비밀번호 변경에 실패했습니다");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <>
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2>프로필</h2>
            <p className="text-gray-600">
              {profileLoading ? "불러오는 중..." : `${profileUsername || "-"} / ${profileEmail || "-"}`}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2">아이디 변경</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="새 아이디"
            />
            <button
              type="button"
              onClick={handleUpdateUsername}
              disabled={updatingUsername}
              className="mt-3 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingUsername ? "변경 중..." : "아이디 변경"}
            </button>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">비밀번호 변경</label>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">새 비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showNewPasswordConfirm ? "text" : "password"}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={updatingPassword}
                className="mt-3 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatingPassword ? "변경 중..." : "비밀번호 변경"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-red-200 rounded-xl p-6">
        <p className="text-sm text-gray-600 mb-4">
          회원 탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 rounded-lg transition-colors"
        >
          <UserX className="w-5 h-5" />
          회원 탈퇴
        </button>
      </div>
    </>
  );
}
