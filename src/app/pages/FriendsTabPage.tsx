import { useState } from "react";
import { Check, Trash2, TrendingUp, UserPlus, UsersRound, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../services/friendService";
import { useAuthStore } from "../../stores/auth.store";

export function FriendsTabPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();
  const [friendUsername, setFriendUsername] = useState("");
  const [error, setError] = useState("");
  const [expandedFriendIds, setExpandedFriendIds] = useState<Set<string>>(() => new Set());
  const [friendStatusById, setFriendStatusById] = useState<Record<string, friendService.FriendStatus>>({});

  // 친구 목록 및 요청 쿼리 (Polling 추가)
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends", userId],
    queryFn: friendService.getFriends,
    enabled: !!userId,
    refetchInterval: 15000, // 15초마다 자동 갱신
  });

  const friends = friendsData?.friends || [];
  const incomingRequests = friendsData?.incomingRequests || [];
  const outgoingRequests = friendsData?.outgoingRequests || [];

  // 친구 추가 Mutation
  const addFriendMutation = useMutation({
    mutationFn: (username: string) => friendService.addFriend(username),
    onSuccess: () => {
      setFriendUsername("");
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
    onError: (err: any) => {
      setError(err.message || "친구 추가에 실패했습니다");
    },
  });

  // 친구 삭제 Mutation
  const deleteFriendMutation = useMutation({
    mutationFn: (friendId: string) => friendService.deleteFriend(friendId),
    onSuccess: (_, friendId) => {
      setExpandedFriendIds((prev) => {
        const next = new Set(prev);
        next.delete(friendId);
        return next;
      });
      setFriendStatusById((prev) => {
        const { [friendId]: _removed, ...rest } = prev;
        return rest;
      });
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
    onError: (err: any) => {
      setError(err.message || "친구 삭제에 실패했습니다");
    },
  });

  // 요청 수락/거부 Mutation
  const respondMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: "accept" | "decline" }) =>
      friendService.respondFriendRequest(requestId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
    onError: (err: any) => {
      setError(err.message || "요청 처리에 실패했습니다");
    },
  });

  // 요청 취소 Mutation
  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => friendService.cancelFriendRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
    onError: (err: any) => {
      setError(err.message || "요청 취소에 실패했습니다");
    },
  });

  const handleSendFriendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    addFriendMutation.mutate(friendUsername.trim());
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

  const handleDeleteFriend = (friend: friendService.Friend) => {
    if (!window.confirm("친구를 삭제할까요?")) return;
    setError("");
    deleteFriendMutation.mutate(friend.userId);
  };

  const handleRespond = (requestId: string, action: "accept" | "decline") => {
    setError("");
    respondMutation.mutate({ requestId, action });
  };

  const handleCancel = (requestId: string) => {
    setError("");
    cancelMutation.mutate(requestId);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <UsersRound className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1>친구</h1>
          <p className="text-muted-foreground">친구를 추가하고 진도 현황을 확인하세요</p>
        </div>
      </div>

      {loadingFriends ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
          <h2 className="mb-3">받은 친구 요청 (불러오는 중)</h2>
          <div className="text-center py-8 text-muted-foreground">불러오는 중...</div>
        </div>
      ) : incomingRequests.length > 0 ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
          <h2 className="mb-3">받은 친구 요청 ({incomingRequests.length})</h2>
          <div className="space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 border border-border rounded-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>
                      {req.fromUser.name}
                      {req.fromUser.username ? (
                        <span className="text-sm text-muted-foreground"> (#{req.fromUser.username})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{req.fromUser.email}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={respondMutation.isPending}
                      onClick={() => handleRespond(req.requestId, "accept")}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                    >
                      <Check className="w-4 h-4" />
                      수락
                    </button>
                    <button
                      type="button"
                      disabled={respondMutation.isPending}
                      onClick={() => handleRespond(req.requestId, "decline")}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-card text-muted-foreground border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
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
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
          <h2 className="mb-3">내가 보낸 요청 (불러오는 중)</h2>
          <div className="text-center py-8 text-muted-foreground">불러오는 중...</div>
        </div>
      ) : outgoingRequests.length > 0 ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
          <h2 className="mb-3">내가 보낸 요청 ({outgoingRequests.length})</h2>
          <div className="space-y-2">
            {outgoingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 border border-border rounded-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>
                      {req.toUser.name}
                      {req.toUser.username ? (
                        <span className="text-sm text-muted-foreground"> (#{req.toUser.username})</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{req.toUser.email}</p>
                  </div>
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    onClick={() => handleCancel(req.requestId)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-card text-muted-foreground border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
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

      <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
        <h2 className="mb-3">친구 추가</h2>
        <form onSubmit={handleSendFriendRequest} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            className="flex-1 px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="친구 아이디(Username) 입력"
            required
          />
          <button
            type="submit"
            disabled={addFriendMutation.isPending}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            <UserPlus className="w-5 h-5" />
            요청
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-xl p-6">
        <h2 className="mb-3">친구 목록 ({loadingFriends ? "불러오는 중" : friends.length})</h2>
        {loadingFriends ? (
          <div className="text-center py-8 text-muted-foreground">불러오는 중...</div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">아직 추가된 친구가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.userId}
                className="p-4 border border-border rounded-lg hover:bg-accent/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p>{friend.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {friend.username ? `#${friend.username} · ` : ""}
                      {friend.email}
                    </p>
                  </div>
                  <div className="flex flex-row flex-wrap sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleViewStatus(friend)}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/15 transition-colors w-auto"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {expandedFriendIds.has(friend.userId) ? "닫기" : "보기"}
                    </button>
                    <button
                      type="button"
                      disabled={deleteFriendMutation.isPending}
                      onClick={() => handleDeleteFriend(friend)}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-auto"
                      title="친구 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </button>
                  </div>
                </div>

                {expandedFriendIds.has(friend.userId) && (
                  <div className="mt-4 bg-card border border-border rounded-xl p-4">
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
                        className="px-3 py-1.5 text-sm bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/60 transition-colors"
                      >
                        닫기
                      </button>
                    </div>

                    {friendStatusById[friend.userId] ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">계획</p>
                          <p>{friendStatusById[friend.userId].plan?.name ?? "공유된 계획이 없습니다"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">진행률</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted rounded-full h-3">
                              <div
                                className="bg-primary h-3 rounded-full transition-all"
                                style={{
                                  width: `${Math.max(0, Math.min(100, friendStatusById[friend.userId].achievementRate))}%`,
                                }}
                              />
                            </div>
                            <span>
                              {friendStatusById[friend.userId].totalDays > 0
                                ? `${Math.round(friendStatusById[friend.userId].achievementRate)}%`
                                : "0%"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">불러오는 중...</p>
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
