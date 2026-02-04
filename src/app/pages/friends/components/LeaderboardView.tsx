import { useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../components/ui/utils";

export function LeaderboardView({
  leaderboard,
  loading,
  currentUserId,
  onSelectFriend,
}: {
  leaderboard: any[];
  loading: boolean;
  currentUserId: string | null;
  onSelectFriend: (friendId: string) => void;
}) {
  const [metric, setMetric] = useState<"rate" | "count">("rate");

  // Sort based on metric
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (metric === "rate") return b.achievementRate - a.achievementRate;
    const bCount = typeof b.completedChapters === "number" ? b.completedChapters : b.completedDays;
    const aCount = typeof a.completedChapters === "number" ? a.completedChapters : a.completedDays;
    return (bCount ?? 0) - (aCount ?? 0);
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
              onClick={() => onSelectFriend(item.user.id)}
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
              onClick={() => onSelectFriend(me.user.id)}
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
  onClick,
}: {
  item: any;
  rank: number;
  metric: "rate" | "count";
  isMe?: boolean;
  isSticky?: boolean;
  onClick: () => void;
}) {
  const isTop3 = rank <= 3;
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer hover:opacity-80",
        isSticky
          ? "text-primary-foreground"
          : isMe
          ? "bg-primary/5 border-none shadow-sm ring-1 ring-primary/20"
          : "bg-card border-none shadow-sm"
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
            ? `${item.achievementRate.toFixed(1)}%`
            : `${Math.round(((typeof item.completedChapters === "number" ? item.completedChapters : item.completedDays) ?? 0) * 10) / 10}장`}
        </div>
        <p className={cn("text-xs", isSticky ? "text-white/80" : "text-muted-foreground")}>
          {metric === "rate" ? "달성률" : "읽은 장수"}
        </p>
      </div>
    </div>
  );
}
