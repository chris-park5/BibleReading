import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../app/utils/api';
import type { Progress } from '../types/domain';

export function useProgress(planId: string | null) {
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['progress', planId],
    queryFn: () => api.getProgress(planId!),
    enabled: !!planId,
  });
  
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ day, completed }: { day: number; completed: boolean }) =>
      api.updateProgress(planId!, day, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', planId] });
    },
  });

  const toggleReadingMutation = useMutation({
    mutationFn: ({
      day,
      readingIndex,
      completed,
      readingCount,
    }: {
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number;
    }) => api.updateReadingProgress(planId!, day, readingIndex, completed, readingCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', planId] });
    },
  });
  
  return {
    progress: data?.progress as Progress | null,
    isLoading,
    toggleComplete: toggleCompleteMutation.mutate,
    toggleReading: toggleReadingMutation.mutate,
    isUpdating: toggleCompleteMutation.isPending,
    isUpdatingReading: toggleReadingMutation.isPending,
  };
}
