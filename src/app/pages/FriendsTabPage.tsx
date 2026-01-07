import { useEffect, useState } from "react";
import { Check, Trash2, TrendingUp, UserPlus, UsersRound, X } from "lucide-react";
import * as friendService from "../../services/friendService";

export function FriendsTabPage() {
  const [friends, setFriends] = useState<friendService.Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<friendService.IncomingFriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<friendService.OutgoingFriendRequest[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [deletingFriendId, setDeletingFriendId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedFriendIds, setExpandedFriendIds] = useState<Set<string>>(() => new Set());
  const [friendStatusById, setFriendStatusById] = useState<Record<string, friendService.FriendStatus>>({});

  useEffect(() => {
    void loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const result = await friendService.getFriends();
      setFriends(result.friends || []);
      setIncomingRequests(result.incomingRequests || []);
      setOutgoingRequests(result.outgoingRequests || []);
    } catch (err: any) {
      console.error("Failed to load friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await friendService.addFriend(friendUsername.trim());
      setFriendUsername("");
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "친구 추가에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatus = async (friend: friendService.Friend) => {
    const isExpanded = expandedFriendIds.has(friend.userId);
    if (isExpanded) {
      setExpandedFriendIds((prev) => {
        const next = new Set(prev);
        next.delete(friend.userId);
        return next;
      });
      return;
    }

    // Open first (optimistic), then fetch status if needed.
    setExpandedFriendIds((prev) => {
      const next = new Set(prev);
      next.add(friend.userId);
      return next;
    });

    if (friendStatusById[friend.userId]) return;

    try {
      const result = await friendService.getFriendStatus(friend.userId);
      if (result?.friendStatus) {
        setFriendStatusById((prev) => ({ ...prev, [friend.userId]: result.friendStatus }));
      }
    } catch (err: any) {
      alert("친구 정보를 불러올 수 없습니다");
      console.error(err);
    }
  };

  const handleDeleteFriend = async (friend: friendService.Friend) => {
    if (!window.confirm("친구를 삭제할까요?")) return;

    setError("");
    setDeletingFriendId(friend.userId);
    try {
      await friendService.deleteFriend(friend.userId);
      setExpandedFriendIds((prev) => {
        const next = new Set(prev);
        next.delete(friend.userId);
        return next;
      });
      setFriendStatusById((prev) => {
        if (!prev[friend.userId]) return prev;
        const { [friend.userId]: _removed, ...rest } = prev;
        return rest;
      });
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "친구 삭제에 실패했습니다");
    } finally {
      setDeletingFriendId(null);
    }
  };

  const handleRespond = async (requestId: string, action: "accept" | "decline") => {
    setError("");
    setRespondingRequestId(requestId);
    try {
      await friendService.respondFriendRequest(requestId, action);
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "요청 처리에 실패했습니다");
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setError("");
    setRespondingRequestId(requestId);
    try {
      await friendService.cancelFriendRequest(requestId);
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "요청 취소에 실패했습니다");
    } finally {
      setRespondingRequestId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-lg">
          <UsersRound className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1>친구</h1>
          <p className="text-gray-600">친구를 추가하고 진도 현황을 확인하세요</p>
        </div>
      </div>

      {loadingFriends ? (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h2 className="mb-3">받은 친구 요청 (불러오는 중)</h2>
          <div className="text-center py-8 text-gray-500">불러오는 중...</div>
        </div>
      ) : incomingRequests.length > 0 ? (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h2 className="mb-3">받은 친구 요청 ({incomingRequests.length})</h2>
          <div className="space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 border-2 border-gray-200 rounded-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>
                      {req.fromUser.name}
                      {req.fromUser.username ? (
                        <span className="text-sm text-gray-600"> (#{req.fromUser.username})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-gray-600">{req.fromUser.email}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={respondingRequestId === req.requestId}
                      onClick={() => handleRespond(req.requestId, "accept")}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                    >
                      <Check className="w-4 h-4" />
                      수락
                    </button>
                    <button
                      type="button"
                      disabled={respondingRequestId === req.requestId}
                      onClick={() => handleRespond(req.requestId, "decline")}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                    >
                      <X className="w-4 h-4" />
                      거부
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loadingFriends ? (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h2 className="mb-3">내가 보낸 요청 (불러오는 중)</h2>
          <div className="text-center py-8 text-gray-500">불러오는 중...</div>
        </div>
      ) : outgoingRequests.length > 0 ? (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h2 className="mb-3">내가 보낸 요청 ({outgoingRequests.length})</h2>
          <div className="space-y-2">
            {outgoingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 border-2 border-gray-200 rounded-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>
                      {req.toUser.name}
                      {req.toUser.username ? (
                        <span className="text-sm text-gray-600"> (#{req.toUser.username})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-gray-600">{req.toUser.email}</p>
                  </div>
                  <button
                    type="button"
                    disabled={respondingRequestId === req.requestId}
                    onClick={() => handleCancel(req.requestId)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                  >
                    <X className="w-4 h-4" />
                    취소
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h2 className="mb-3">친구 요청 보내기</h2>
        <form onSubmit={handleSendFriendRequest} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            placeholder="친구 아이디(Username) 입력"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            <UserPlus className="w-5 h-5" />
            요청
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h2 className="mb-3">친구 목록 ({loadingFriends ? "불러오는 중" : friends.length})</h2>
        {loadingFriends ? (
          <div className="text-center py-8 text-gray-500">불러오는 중...</div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-gray-500">아직 추가된 친구가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.userId}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>{friend.name}</p>
                    <p className="text-sm text-gray-600">
                      {friend.username ? `#${friend.username} · ` : ""}
                      {friend.email}
                    </p>
                  </div>
                  <div className="flex flex-row flex-wrap sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleViewStatus(friend)}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors w-auto"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {expandedFriendIds.has(friend.userId) ? "닫기" : "보기"}
                    </button>
                    <button
                      type="button"
                      disabled={deletingFriendId === friend.userId}
                      onClick={() => handleDeleteFriend(friend)}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-auto"
                      title="친구 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </button>
                  </div>
                </div>

                {expandedFriendIds.has(friend.userId) && (
                  <div className="mt-4 bg-white border-2 border-purple-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2>{friend.name}님</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedFriendIds((prev) => {
                            const next = new Set(prev);
                            next.delete(friend.userId);
                            return next;
                          });
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        닫기
                      </button>
                    </div>

                    {friendStatusById[friend.userId] ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">계획</p>
                          <p>{friendStatusById[friend.userId].plan?.name ?? "공유된 계획이 없습니다"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">달성률</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-purple-500 h-3 rounded-full transition-all"
                                style={{
                                  width: `${Math.max(0, Math.min(100, friendStatusById[friend.userId].achievementRate))}%`,
                                }}
                              />
                            </div>
                            <span>
                              {friendStatusById[friend.userId].totalDays > 0
                                ? `${friendStatusById[friend.userId].completedDays}/${friendStatusById[friend.userId].totalDays}`
                                : "0/0"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">불러오는 중...</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
