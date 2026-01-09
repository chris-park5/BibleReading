import { useState, useEffect } from "react";
import { UserPlus, UsersRound, TrendingUp, X } from "lucide-react";
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

interface FriendsPanelProps {
  onClose: () => void;
  currentPlanId: string | null;
}

export function FriendsPanel({ onClose, currentPlanId }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [error, setError] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [friendProgress, setFriendProgress] = useState<FriendProgress | null>(
    null
  );

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const result = await api.getFriends();
      setFriends(result.friends || []);
    } catch (err: any) {
      console.error("Failed to load friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.addFriend(friendIdentifier);
      setFriendIdentifier("");
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-card text-card-foreground rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="sticky top-0 bg-background/80 backdrop-blur border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <UsersRound className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2>친구 관리</h2>
                <p className="text-muted-foreground">친구를 추가하고 진도를 확인하세요</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 친구 추가 */}
          <div>
            <h3 className="mb-3">친구 추가</h3>
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                value={friendIdentifier}
                onChange={(e) => setFriendIdentifier(e.target.value)}
                className="flex-1 px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="친구의 이메일 또는 아이디 입력"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                추가
              </button>
            </form>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          {/* 친구 목록 */}
          <div>
            <h3 className="mb-3">
              친구 목록 ({loadingFriends ? "불러오는 중" : friends.length})
            </h3>
            {loadingFriends ? (
              <div className="text-center py-8 text-muted-foreground">불러오는 중...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                아직 추가된 친구가 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.userId}
                    className="p-4 border border-border rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p>{friend.name}</p>
                        <p className="text-sm text-muted-foreground">{friend.email}</p>
                      </div>
                      <button
                        onClick={() => handleViewProgress(friend)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/15 transition-colors"
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

          {/* 친구 진도 */}
          {selectedFriend && friendProgress && (
            <div className="p-4 bg-primary/5 border border-border rounded-lg">
              <h3 className="mb-4">{friendProgress.user.name}님의 진도</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">계획</p>
                  <p>{friendProgress.plan.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">진행률</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all"
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
                <div>
                  <p className="text-sm text-muted-foreground">완료한 날</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {friendProgress.progress.completedDays
                      .slice(0, 20)
                      .map((day) => (
                        <span
                          key={day}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-sm"
                        >
                          Day {day}
                        </span>
                      ))}
                    {friendProgress.progress.completedDays.length > 20 && (
                      <span className="px-2 py-1 text-muted-foreground text-sm">
                        +{friendProgress.progress.completedDays.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
