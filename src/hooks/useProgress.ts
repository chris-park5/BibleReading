import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import * as progressService from '../services/progressService';
import type { Progress } from '../types/domain';
import { useAuthStore } from '../stores/auth.store';
import {
  enqueueDayToggle,
  enqueueReadingToggle,
  isOfflineLikeError,
  OfflineError,
} from '../app/utils/offlineProgressQueue';

export function useProgress(planId: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const progressQueryKey = ['progress', userId, planId] as const;

  const toggleCompleteSeqRef = useRef(0);
  const toggleReadingSeqRef = useRef(0);
  
  const { data, isLoading } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => progressService.getProgress(planId!),
    enabled: !!userId && !!planId,
  });
  
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ day, completed }: { day: number; completed: boolean }) => {
      if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        throw new OfflineError();
      }
      return progressService.updateProgress(planId!, day, completed);
    },
    onMutate: async ({ day, completed }) => {
      toggleCompleteSeqRef.current += 1;
      const seq = toggleCompleteSeqRef.current;

      // Await cancellation to ensure no in-flight queries overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: progressQueryKey });

      const previous = queryClient.getQueryData<{ success: boolean; progress: Progress }>(progressQueryKey);

      queryClient.setQueryData<{ success: boolean; progress: Progress }>(progressQueryKey, (current) => {
        if (!current?.progress) return current as any;

        const prevProgress = current.progress;
        const nextCompletedDays = new Set(prevProgress.completedDays ?? []);
        if (completed) nextCompletedDays.add(day);
        else nextCompletedDays.delete(day);

        return {
          ...current,
          progress: {
            ...prevProgress,
            completedDays: Array.from(nextCompletedDays),
            lastUpdated: new Date().toISOString(),
          },
        };
      });

      return { previous, seq };
    },
    onError: (err, vars, ctx) => {
      if (!ctx) return;
      if (ctx.seq !== toggleCompleteSeqRef.current) return;

      // 오프라인/네트워크 문제면 롤백하지 않고 큐에 저장 (온라인 복구 시 자동 동기화)
      if (isOfflineLikeError(err)) {
        void enqueueDayToggle({ planId: planId!, day: vars.day, completed: vars.completed });
        return;
      }

      if (ctx.previous) {
        queryClient.setQueryData(progressQueryKey, ctx.previous);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      if (!ctx) return;
      if (ctx.seq !== toggleCompleteSeqRef.current) return;
      queryClient.setQueryData(progressQueryKey, data);
    },
  });

  const toggleReadingMutation = useMutation({
    mutationFn: ({
      day,
      readingIndex,
      completed,
      readingCount,
      completedChapters,
    }: {
      day: number;
      readingIndex: number;
      completed: boolean;
      readingCount: number;
      completedChapters?: string[];
    }) => {
      if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        throw new OfflineError();
      }
      return progressService.updateReadingProgress(planId!, day, readingIndex, completed, readingCount, completedChapters);
    },
    onMutate: async ({ day, readingIndex, completed, readingCount, completedChapters }) => {
      toggleReadingSeqRef.current += 1;
      const seq = toggleReadingSeqRef.current;

      // Await cancellation to ensure no in-flight queries overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: progressQueryKey });

      const previous = queryClient.getQueryData<{ success: boolean; progress: Progress }>(progressQueryKey);

      queryClient.setQueryData<{ success: boolean; progress: Progress }>(progressQueryKey, (current) => {
        if (!current?.progress) return current as any;

        const prevProgress = current.progress;
        const key = String(day);
        
        // Update Completed Readings (Full Completion)
        const prevMap = prevProgress.completedReadingsByDay ?? {};
        const prevList = Array.isArray(prevMap[key]) ? prevMap[key] : [];
        const nextSet = new Set(prevList);
        
        if (completed) nextSet.add(readingIndex);
        else nextSet.delete(readingIndex);

        const nextList = Array.from(nextSet).sort((a, b) => a - b);
        const nextCompletedReadingsByDay: Record<string, number[]> = {
          ...prevMap,
          [key]: nextList,
        };

        // Update Detailed Chapters (Partial Completion)
        const prevChaptersMap = prevProgress.completedChaptersByDay ?? {};
        const prevDayChapters = prevChaptersMap[key] ?? {};
        const nextDayChapters = { ...prevDayChapters };

        if (completed) {
          // If fully completed, we can remove the partial record (or keep it sync? backend sets it to null)
          // Let's remove it to keep it clean.
          delete nextDayChapters[readingIndex];
        } else if (completedChapters && completedChapters.length > 0) {
          nextDayChapters[readingIndex] = completedChapters;
        } else {
          // Cancelled (no full, no partial)
          delete nextDayChapters[readingIndex];
        }

        const nextCompletedChaptersByDay = {
            ...prevChaptersMap,
            [key]: nextDayChapters,
        };


        const nextCompletedDays = new Set(prevProgress.completedDays ?? []);
        const isDayCompleted = readingCount > 0 && nextList.length >= readingCount;
        if (isDayCompleted) nextCompletedDays.add(day);
        else nextCompletedDays.delete(day);

        return {
          ...current,
          progress: {
            ...prevProgress,
            completedReadingsByDay: nextCompletedReadingsByDay,
            completedChaptersByDay: nextCompletedChaptersByDay,
            completedDays: Array.from(nextCompletedDays),
            lastUpdated: new Date().toISOString(),
          },
        };
      });

      return { previous, seq };
    },
    onError: (err, vars, ctx) => {
      if (!ctx) return;
      if (ctx.seq !== toggleReadingSeqRef.current) return;

      // 오프라인/네트워크 문제면 롤백하지 않고 큐에 저장 (온라인 복구 시 자동 동기화)
      if (isOfflineLikeError(err)) {
        void enqueueReadingToggle({
          planId: planId!,
          day: vars.day,
          readingIndex: vars.readingIndex,
          completed: vars.completed,
          readingCount: vars.readingCount,
        });
        return;
      }

      if (ctx.previous) {
        queryClient.setQueryData(progressQueryKey, ctx.previous);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      if (!ctx) return;
      if (ctx.seq !== toggleReadingSeqRef.current) return;
      // 서버 응답으로 캐시를 확정 (invalidate 없이도 UI 안정)
      queryClient.setQueryData(progressQueryKey, data);
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
