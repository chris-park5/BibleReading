import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../app/utils/api';
import type { Plan } from '../types/domain';

export function usePlans() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['plans'],
    queryFn: api.getPlans,
  });
  
  const createPlanMutation = useMutation({
    mutationFn: api.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: api.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
  
  return {
    plans: data?.plans || [],
    isLoading,
    error,
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
