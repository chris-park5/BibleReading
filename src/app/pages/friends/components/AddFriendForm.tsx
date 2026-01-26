import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";

export function AddFriendForm({ onSuccess }: { onSuccess: () => void }) {
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
