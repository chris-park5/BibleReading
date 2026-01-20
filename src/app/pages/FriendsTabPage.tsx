import { useState } from "react";
import {
  Check,
  Trash2,
  TrendingUp,
  UserPlus,
  UsersRound,
  X,
  Trophy,
  Medal,
  Search,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../services/friendService";
import { useAuthStore } from "../../stores/auth.store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { cn } from "../components/ui/utils";

export function FriendsTabPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("leaderboard");

  // 1. Fetch Friends & Requests
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends", userId],
    queryFn: friendService.getFriends,
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // 2. Fetch Leaderboard (includes progress for all friends + self)
  const { data: leaderboardData, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["leaderboard", userId],
    queryFn: friendService.getLeaderboard,
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const friends = friendsData?.friends || [];
  const incomingRequests = friendsData?.incomingRequests || [];
  const outgoingRequests = friendsData?.outgoingRequests || [];
  const leaderboard = leaderboardData?.leaderboard || [];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <UsersRound className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">친구</h1>
            <p className="text-muted-foreground text-sm">함께 읽으며 격려하세요</p>
          </div>
        </div>

        {/* Add Friend Button */}
        <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-colors shadow-sm">
              <UserPlus className="w-5 h-5" />
              <span className="hidden sm:inline">친구 추가</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>친구 추가</DialogTitle>
            </DialogHeader>
            <AddFriendForm onSuccess={() => setIsAddFriendOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="leaderboard">랭킹</TabsTrigger>
          <TabsTrigger value="friends">친구 목록</TabsTrigger>
          <TabsTrigger value="requests">
            요청
            {(incomingRequests.length > 0) && (
              <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                {incomingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-0">
          <LeaderboardView
            leaderboard={leaderboard}
            loading={loadingLeaderboard}
            currentUserId={userId}
          />
        </TabsContent>

        <TabsContent value="friends" className="mt-0">
          <FriendsListView
            friends={friends}
            leaderboard={leaderboard}
            loading={loadingFriends || loadingLeaderboard}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <RequestsView
            incoming={incomingRequests}
            outgoing={outgoingRequests}
            loading={loadingFriends}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function AddFriendForm({ onSuccess }: { onSuccess: () => void }) {
  const [friendUsername, setFriendUsername] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const addFriendMutation = useMutation({
    mutationFn: (username: string) => friendService.addFriend(username),
    onSuccess: () => {
      setFriendUsername("");
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard", userId] });
      onSuccess();
      alert("친구 요청을 보냈습니다!");
    },
    onError: (err: any) => {
      setError(err.message || "친구 추가에 실패했습니다");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    addFriendMutation.mutate(friendUsername.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <input
          type="text"
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="이메일 또는 아이디 입력"
          required
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={addFriendMutation.isPending}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
      >
        {addFriendMutation.isPending ? "요청 중..." : "요청 보내기"}
      </button>
    </form>
  );
}

function LeaderboardView({
  leaderboard,
  loading,
  currentUserId,
}: {
  leaderboard: any[];
  loading: boolean;
  currentUserId: string | null;
}) {
  const [metric, setMetric] = useState<"rate" | "count">("rate");

  // Sort based on metric
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (metric === "rate") return b.achievementRate - a.achievementRate;
    return b.completedDays - a.completedDays;
  });

  const top10 = sortedLeaderboard.slice(0, 10);
  const myRankIndex = sortedLeaderboard.findIndex(
    (item) => item.user.id === currentUserId
  );
  const me = myRankIndex !== -1 ? sortedLeaderboard[myRankIndex] : null;
  const amIOffChart = myRankIndex >= 10;

  if (loading) return <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      {/* Sub-tabs for Leaderboard */}
      <div className="flex justify-center mb-6">
        <div className="bg-muted rounded-full p-1 flex items-center">
          <button
            onClick={() => setMetric("rate")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              metric === "rate"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            달성률
          </button>
          <button
            onClick={() => setMetric("count")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              metric === "count"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            읽은 장수
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {top10.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            데이터가 없습니다
          </div>
        ) : (
          top10.map((item, index) => (
            <LeaderboardItem
              key={item.user.id}
              item={item}
              rank={index + 1}
              metric={metric}
              isMe={item.user.id === currentUserId}
            />
          ))
        )}
      </div>

      {/* Sticky My Rank if not in top 10 */}
      {amIOffChart && me && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-auto sm:max-w-4xl sm:w-full mx-auto z-10">
          <div className="bg-primary/90 backdrop-blur text-primary-foreground p-4 rounded-xl shadow-lg border border-primary/20 animate-in slide-in-from-bottom-5">
            <LeaderboardItem
              item={me}
              rank={myRankIndex + 1}
              metric={metric}
              isMe={true}
              isSticky
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardItem({
  item,
  rank,
  metric,
  isMe,
  isSticky = false,
}: {
  item: any;
  rank: number;
  metric: "rate" | "count";
  isMe?: boolean;
  isSticky?: boolean;
}) {
  const isTop3 = rank <= 3;
  
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl transition-colors",
        isSticky
          ? "text-primary-foreground"
          : isMe
          ? "bg-primary/5 border border-primary/20"
          : "bg-card border border-border"
      )}
    >
      <div className="flex-shrink-0 w-8 text-center font-bold text-lg">
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isSticky ? "text-white" : "")}>
            {item.user.name}
            {isMe && " (나)"}
          </span>
          {isTop3 && !isSticky && (
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
              TOP {rank}
            </Badge>
          )}
        </div>
        <p className={cn("text-xs truncate", isSticky ? "text-white/80" : "text-muted-foreground")}>
           {item.plan?.name ?? "계획 없음"}
        </p>
      </div>

      <div className="text-right">
        <div className={cn("font-bold text-lg", isSticky ? "text-white" : "text-primary")}>
          {metric === "rate"
            ? `${Math.round(item.achievementRate)}%`
            : `${item.completedDays}장`}
        </div>
        <p className={cn("text-xs", isSticky ? "text-white/80" : "text-muted-foreground")}>
          {metric === "rate" ? "달성률" : "읽은 장수"}
        </p>
      </div>
    </div>
  );
}

function FriendsListView({
  friends,
  leaderboard,
  loading,
}: {
  friends: friendService.Friend[];
  leaderboard: any[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const deleteFriendMutation = useMutation({
    mutationFn: (friendId: string) => friendService.deleteFriend(friendId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard", userId] });
    },
  });

  const handleDelete = (friendId: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteFriendMutation.mutate(friendId);
    }
  };

  // Merge friend basic info with leaderboard progress
  const friendsWithProgress = friends.map((f) => {
    const status = leaderboard.find((l) => l.user.id === f.userId);
    return {
      ...f,
      achievementRate: status?.achievementRate ?? 0,
      progressRate: status?.progressRate ?? 0,
      completedDays: status?.completedDays ?? 0,
      planName: status?.plan?.name ?? "계획 없음",
    };
  });

  const filteredFriends = friendsWithProgress.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.username && f.username.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="친구 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        {filteredFriends.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">친구가 없습니다</div>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend.userId}
              className="bg-card border border-border p-4 rounded-xl flex items-center justify-between group"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{friend.name}</span>
                  {friend.username && (
                    <span className="text-xs text-muted-foreground">@{friend.username}</span>
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="flex items-center gap-2">
                  <Progress value={friend.progressRate} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-10 text-right">
                    {Math.round(friend.progressRate)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {friend.planName}
                </p>
              </div>

              <button
                onClick={() => handleDelete(friend.userId)}
                className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                title="친구 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RequestsView({
  incoming,
  outgoing,
  loading,
}: {
  incoming: friendService.IncomingFriendRequest[];
  outgoing: friendService.OutgoingFriendRequest[];
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const respondMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: "accept" | "decline" }) =>
      friendService.respondFriendRequest(requestId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard", userId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => friendService.cancelFriendRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });

  if (loading) return <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="space-y-8">
      {/* Incoming */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          받은 요청
          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {incoming.length}
          </span>
        </h3>
        {incoming.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
            받은 요청이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {incoming.map((req) => (
              <div key={req.requestId} className="bg-card border border-border p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                  <div className="font-medium">{req.fromUser.name}</div>
                  <div className="text-xs text-muted-foreground">{req.fromUser.email}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondMutation.mutate({ requestId: req.requestId, action: "accept" })}
                    disabled={respondMutation.isPending}
                    className="flex-1 sm:flex-none bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => respondMutation.mutate({ requestId: req.requestId, action: "decline" })}
                    disabled={respondMutation.isPending}
                    className="flex-1 sm:flex-none bg-muted text-muted-foreground text-sm px-4 py-2 rounded-lg hover:bg-muted/80"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Outgoing */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          보낸 요청
          <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
            {outgoing.length}
          </span>
        </h3>
        {outgoing.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
            보낸 요청이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {outgoing.map((req) => (
              <div key={req.requestId} className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium">{req.toUser.name}</div>
                  <div className="text-xs text-muted-foreground">{req.toUser.email}</div>
                </div>
                <button
                  onClick={() => cancelMutation.mutate(req.requestId)}
                  disabled={cancelMutation.isPending}
                  className="text-muted-foreground hover:bg-muted p-2 rounded-lg"
                  title="요청 취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}