import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";

export function RequestsView({
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
