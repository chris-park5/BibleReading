import { useState } from "react";
import { Search } from "lucide-react";
import { useAuthStore } from "../../../../stores/auth.store";
import * as friendService from "../../../../services/friendService";

export function FriendsListView({
  friends,
  leaderboard,
  loading,
  onSelectFriend,
}: {
  friends: friendService.Friend[];
  leaderboard: any[];
  loading: boolean;
  onSelectFriend: (friendId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const userId = useAuthStore((s) => s.user?.id);

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
              onClick={() => onSelectFriend(friend.userId)}
              className="bg-card border border-border p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{friend.name}</span>
                  {friend.username && (
                    <span className="text-xs text-muted-foreground">@{friend.username}</span>
                  )}
                </div>
                
                {/* Simplified view - no progress bar, just plan name */}
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {friend.planName}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
