import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as friendService from "../../../../services/friendService";
import { useAuthStore } from "../../../../stores/auth.store";
import { usePlans } from "../../../../hooks/usePlans";

export function SharedPlanSettings() {
  const { plans } = usePlans();
  const [sharedPlanId, setSharedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  // Initial fetch
  useQuery({
    queryKey: ["sharedPlan", userId],
    queryFn: async () => {
      const res = await friendService.getSharePlan();
      setSharedPlanId(res.sharedPlanId);
      return res;
    },
    enabled: !!userId,
  });

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value || null;
    setLoading(true);
    try {
      await friendService.setSharePlan(newVal);
      setSharedPlanId(newVal);
    } catch (err) {
      console.error(err);
      alert("공유 계획 설정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (plans.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            공유할 계획
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            친구들에게 보여질 나의 진행 중인 계획을 선택하세요.
          </p>
        </div>
        <div className="min-w-[200px]">
          <select
            value={sharedPlanId ?? ""}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">공유 안 함</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
