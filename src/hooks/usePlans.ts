import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as planService from '../services/planService';
import type { Plan } from '../types/domain';
import { getBundledPresetSchedule } from '../app/plans/bundledPresets';
import { useAuthStore } from '../stores/auth.store';

export function usePlans() {
  const queryClient = useQueryClient();
  const seededPresetIdsRef = useRef<Set<string>>(new Set());
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const plansQueryKey = ['plans', userId] as const;

  const makeOptimisticId = () => {
    const g: any = globalThis as any;
    const uuid = g?.crypto?.randomUUID?.();
    if (typeof uuid === 'string' && uuid.length > 0) return uuid;
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: plansQueryKey,
    queryFn: planService.getPlans,
    enabled: !!userId,
  });

  useEffect(() => {
    const plans = data?.plans ?? [];
    const candidates = plans
      .filter((p: Plan) => !p.isCustom && !!p.presetId && (p.schedule?.length ?? 0) === 0)
      .map((p: Plan) => p.presetId!)
      .filter((presetId) => !seededPresetIdsRef.current.has(presetId));

    if (candidates.length === 0) return;

    void (async () => {
      for (const presetId of candidates) {
        const schedule = getBundledPresetSchedule(presetId);
        if (!schedule?.length) continue;

        seededPresetIdsRef.current.add(presetId);
        try {
          await planService.seedPresetSchedules(presetId, schedule);
        } catch {
          // ignore: user can still recreate plan or run populate script
        }
      }

      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    })();
  }, [data?.plans, queryClient, plansQueryKey]);
  
  const createPlanMutation = useMutation({
    mutationFn: planService.createPlan,
    onMutate: async (vars: any) => {
      if (!userId) return;

      // Do not await; keep UI snappy.
      void queryClient.cancelQueries({ queryKey: plansQueryKey });

      const previous = queryClient.getQueryData<any>(plansQueryKey);

      const optimisticPlan: Plan = {
        id: `optimistic-${makeOptimisticId()}`,
        name: vars?.name ?? '새 계획',
        startDate: vars?.startDate ?? new Date().toISOString().split('T')[0],
        totalDays: Number(vars?.totalDays ?? 0),
        schedule: Array.isArray(vars?.schedule) ? vars.schedule : [],
        isCustom: Boolean(vars?.isCustom ?? true),
        presetId: vars?.presetId ?? null,
        displayOrder: undefined,
      } as any;

      queryClient.setQueryData<any>(plansQueryKey, (current) => {
        const currentPlans = current?.plans ?? [];
        return { ...(current ?? {}), plans: [optimisticPlan, ...currentPlans] };
      });

      return { previous, optimisticId: optimisticPlan.id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(plansQueryKey, ctx.previous);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      const created = data?.plan;
      if (!created) {
        queryClient.invalidateQueries({ queryKey: plansQueryKey });
        return;
      }

      // Replace optimistic placeholder with real plan.
      queryClient.setQueryData<any>(plansQueryKey, (current) => {
        const currentPlans: Plan[] = current?.plans ?? [];
        const nextPlans = ctx?.optimisticId
          ? currentPlans.map((p) => (p.id === ctx.optimisticId ? created : p))
          : [created, ...currentPlans];
        return { ...(current ?? {}), plans: nextPlans };
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: planService.deletePlan,
    onMutate: async (planId: string) => {
      if (!userId) return;

      void queryClient.cancelQueries({ queryKey: plansQueryKey });

      const previous = queryClient.getQueryData<any>(plansQueryKey);
      queryClient.setQueryData<any>(plansQueryKey, (current) => {
        const currentPlans: Plan[] = current?.plans ?? [];
        return {
          ...(current ?? {}),
          plans: currentPlans.filter((p) => p.id !== planId),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(plansQueryKey, ctx.previous);
      }
    },
  });
  
  return {
    plans: data?.plans || [],
    isLoading,
    error,
    refetch,
    createPlan: createPlanMutation.mutate,
    createPlanAsync: createPlanMutation.mutateAsync,
    isCreating: createPlanMutation.isPending,
    deletePlan: deletePlanMutation.mutate,
    deletePlanAsync: deletePlanMutation.mutateAsync,
    isDeleting: deletePlanMutation.isPending,
  };
}

export function usePlan(planId: string | null) {
  const plans = usePlans().plans;
  return plans.find((p: Plan) => p.id === planId) || null;
}
