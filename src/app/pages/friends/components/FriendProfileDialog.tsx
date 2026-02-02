import { Trash2, TrendingUp, Medal, BookOpen, Flame, Loader2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";
import {
  Dialog,
  DialogContent,
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

  const currentDayNum = status?.plan?.startDate 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(status.plan.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  return (
    <Dialog open={!!friendId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[360px] sm:max-w-[400px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[32px] ring-1 ring-black/5">
        
        {/* A. Header - More compact */}
        <div className="px-5 pt-6 pb-1">
          <h2 className="text-center text-base font-bold text-[#0F172A]">
            {isMe ? "내 프로필" : "친구 프로필"}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
            <p className="text-[#94A3B8] text-xs font-medium">정보를 불러오는 중입니다...</p>
          </div>
        ) : status ? (
          <div className="px-5 pb-6 space-y-6">
            
            {/* B. Profile Identity - Simpler circular avatar */}
            <div className="flex flex-col items-center pt-1">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-600 border border-slate-200">
                {status.user.name[0]}
              </div>
              <div className="mt-3 text-center">
                <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
                  {status.user.name}
                </h3>
                <p className="text-xs text-[#94A3B8] font-medium mt-0.5">
                  @{status.user.username || "user"}
                </p>
              </div>
              
              {!isMe && (
                <button
                  onClick={handleDelete}
                  className="mt-2 text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 px-3 py-1 rounded-full transition-all flex items-center gap-1 opacity-60"
                >
                  <Trash2 className="w-2.5 h-2.5" /> 친구 삭제
                </button>
              )}
            </div>

            {/* C. Metrics Grid - Compact heights */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#EFF6FF]/50 p-4 rounded-[24px] flex flex-col justify-between h-[90px] border border-blue-50/50">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-[#2563EB] opacity-70" />
                  <span className="text-[10px] font-bold text-[#94A3B8]">진행률</span>
                </div>
                <div className="text-2xl font-black text-[#0F172A]">
                  {Math.round(status.progressRate ?? 0)}<span className="text-xs text-[#94A3B8] ml-0.5 font-bold">%</span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-[24px] flex flex-col justify-between h-[90px] border border-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <Medal className="w-3 h-3 text-[#94A3B8] opacity-70" />
                  <span className="text-[10px] font-bold text-[#94A3B8]">달성률</span>
                </div>
                <div className="text-2xl font-black text-[#0F172A]">
                  {Math.round(status.achievementRate)}<span className="text-xs text-[#94A3B8] ml-0.5 font-bold">%</span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-[24px] flex flex-col justify-between h-[90px] border border-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-[#94A3B8] opacity-70" />
                  <span className="text-[10px] font-bold text-[#94A3B8]">읽은 장수</span>
                </div>
                <div className="text-xl font-black text-[#0F172A] truncate">
                  {Math.floor(status.completedDays)}<span className="text-xs text-[#94A3B8] ml-0.5 font-bold">장</span>
                </div>
              </div>

              <div className="bg-[#FFF7ED] p-4 rounded-[24px] flex flex-col justify-between h-[90px] border border-orange-50">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-orange-500 fill-orange-500 opacity-70" />
                  <span className="text-[10px] font-bold text-orange-400">연속 접속</span>
                </div>
                <div className="text-2xl font-black text-[#0F172A]">
                  {(status as any).currentStreak ?? 0}<span className="text-xs text-[#94A3B8] ml-0.5 font-bold">일</span>
                </div>
              </div>
            </div>

            {/* D. Active Plan - Refined */}
            <div className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 bg-[#F8FAFC] rounded-full text-[9px] font-bold text-[#94A3B8] uppercase tracking-wide border border-slate-100/50">
                  Active Plan
                </span>
                {status.plan && (
                  <span className="text-[10px] font-bold text-[#2563EB]">
                    Day {currentDayNum}
                  </span>
                )}
              </div>
              
              <h4 className="text-sm font-bold text-[#0F172A] mb-4 leading-tight truncate">
                {status.plan?.name ?? "진행 중인 계획 없음"}
              </h4>

              {status.plan && (
                <div className="space-y-4">
                  <div className="relative h-2 bg-[#F8FAFC] rounded-full overflow-hidden border border-slate-100/50">
                    <div 
                      className="absolute top-0 left-0 h-full bg-[#2563EB] rounded-full shadow-[0_0_8px_rgba(37,99,235,0.3)] transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, Math.round(status.progressRate ?? 0))}%` }}
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#94A3B8]">오늘의 목표</span>
                    <span className="text-xs font-bold text-[#0F172A]">
                      {currentDayNum}일차 읽기
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-[#94A3B8] font-medium text-xs">
            정보를 불러올 수 없습니다.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
