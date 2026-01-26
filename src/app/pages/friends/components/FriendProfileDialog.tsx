import { Trash2, TrendingUp, Medal, BookOpen, Flame, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

export function FriendProfileDialog({ friendId, onClose }: { friendId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["friendStatus", friendId],
    queryFn: () => friendService.getFriendStatus(friendId!),
    enabled: !!friendId,
  });

  const deleteFriendMutation = useMutation({
    mutationFn: (id: string) => friendService.deleteFriend(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard", userId] });
      onClose();
    },
  });

  const handleDelete = () => {
    if (confirm("정말 이 친구를 삭제하시겠습니까?")) {
      deleteFriendMutation.mutate(friendId!);
    }
  };

  const status = data?.friendStatus;
  const isMe = status?.user.id === userId;

  return (
    <Dialog open={!!friendId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isMe ? "내 프로필" : "친구 프로필"}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">정보를 불러오는 중입니다...</p>
          </div>
        ) : status ? (
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {status.user.name[0]}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{status.user.name}{isMe && " (나)"}</h3>
              </div>
              {!isMe && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                  title="친구 삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>진행률</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {Math.round(status.progressRate ?? 0)}%
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Medal className="w-4 h-4" />
                  <span>달성률</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {Math.round(status.achievementRate)}%
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>읽은 장수</span>
                </div>
                <div className="text-xl font-bold text-primary">
                  {Math.floor(status.completedDays)} 장
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>연속 접속</span>
                </div>
                <div className="text-xl font-bold text-primary">
                  {(status as any).currentStreak ?? 0}일
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl">
              <div className="text-sm text-muted-foreground mb-1">현재 진행 중인 계획</div>
              <div className="font-medium">
                {status.plan?.name ?? "계획 없음"}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            정보를 불러올 수 없습니다.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
