import { useEffect, useState } from "react";
import { TrendingUp, UserPlus, UsersRound } from "lucide-react";
import { usePlanStore } from "../../stores/plan.store";
import * as api from "../utils/api";

interface Friend {
  userId: string;
  email: string;
  name: string;
  addedAt: string;
}

interface FriendProgress {
  user: { id: string; email: string; name: string };
  plan: { name: string; totalDays: number };
  progress: { completedDays: number[] };
}

export function FriendsTabPage() {
  const currentPlanId = usePlanStore((s) => s.selectedPlanId);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [friendProgress, setFriendProgress] = useState<FriendProgress | null>(null);

  useEffect(() => {
    void loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const result = await api.getFriends();
      setFriends(result.friends || []);
    } catch (err: any) {
      console.error("Failed to load friends:", err);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.addFriend(friendEmail);
      setFriendEmail("");
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "친구 추가에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (friend: Friend) => {
    if (!currentPlanId) {
      alert("현재 선택된 계획이 없습니다");
      return;
    }

    try {
      const result = await api.getFriendProgress(friend.userId, currentPlanId);
      setFriendProgress(result.friendProgress);
      setSelectedFriend(friend.userId);
    } catch (err: any) {
      alert("친구의 진도를 불러올 수 없습니다");
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-lg">
          <UsersRound className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1>친구</h1>
          <p className="text-gray-600">친구를 추가하고 진도 현황을 확인하세요</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h2 className="mb-3">친구 추가</h2>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input
            type="email"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            placeholder="친구의 이메일 입력"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            추가
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h2 className="mb-3">친구 목록 ({friends.length})</h2>
        {friends.length === 0 ? (
          <div className="text-center py-8 text-gray-500">아직 추가된 친구가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.userId}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p>{friend.name}</p>
                    <p className="text-sm text-gray-600">{friend.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewProgress(friend)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    진도 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFriend && friendProgress && (
        <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
          <h2 className="mb-4">{friendProgress.user.name}님의 진도</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">계획</p>
              <p>{friendProgress.plan.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">진행률</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-purple-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${
                        (friendProgress.progress.completedDays.length /
                          friendProgress.plan.totalDays) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span>
                  {friendProgress.progress.completedDays.length}/
                  {friendProgress.plan.totalDays}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
