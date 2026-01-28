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

  // Track the timestamp of the latest server response we've applied.
  // This ensures we don't overwrite the cache with stale data from out-of-order responses.
  const latestServerTimestamp = useRef<number>(0);

  // Serial queue to ensure network requests fire in order
  const mutationQueue = useRef<Promise<any>>(Promise.resolve());
  
  // Explicitly track pending mutations to handle optimistic update rollbacks/overwrites
  const pendingMutations = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => progressService.getProgress(planId!),
    enabled: !!userId && !!planId,
  });
  
  const toggleCompleteMutation = useMutation({
    mutationKey: ['progress-update', planId],
    mutationFn: async ({ day, completed }: { day: number; completed: boolean }) => {
      // Chain requests to ensure serial execution
      const previous = mutationQueue.current;
      
      const task = async () => {
        // Wait for previous request to settle (success or fail)
        await previous.catch(() => {});
        
        if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
          throw new OfflineError();
        }
        return progressService.updateProgress(planId!, day, completed);
      };

      const nextPromise = task();
      mutationQueue.current = nextPromise;
      return nextPromise;
    },
    onMutate: async ({ day, completed }) => {
      pendingMutations.current += 1;

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
            // We do NOT update lastUpdated here for comparison purposes, 
            // or we use a client-side marker. But simpler to just leave it 
            // and trust the server response logic to eventually sync.
            // However, to avoid "flicker" if a query finishes *before* this mutation,
            // we'll just let the server response handle the authoritative update.
            lastUpdated: new Date().toISOString(),
          },
        };
      });

      return { previous };
    },
    onError: (err, vars, ctx) => {
      // 오프라인/네트워크 문제면 롤백하지 않고 큐에 저장 (온라인 복구 시 자동 동기화)
      if (isOfflineLikeError(err)) {
        void enqueueDayToggle({ planId: planId!, day: vars.day, completed: vars.completed });
        return;
      }

      // If there are other pending mutations, do NOT rollback.
      // Rolling back would overwrite the optimistic updates of subsequent mutations.
      if (pendingMutations.current > 1) {
        return;
      }

      if (ctx?.previous) {
        queryClient.setQueryData(progressQueryKey, ctx.previous);
      }
    },
    onSuccess: (data) => {
      // If there are other pending mutations, do NOT overwrite the cache with this server response.
      // The subsequent mutations have applied optimistic updates that this response (likely) doesn't know about.
      // We wait for the final mutation to sync the authoritative state.
      if (pendingMutations.current > 1) {
        return;
      }

      const serverTime = new Date(data.progress.lastUpdated).getTime();
      if (serverTime > latestServerTimestamp.current) {
        latestServerTimestamp.current = serverTime;
        queryClient.setQueryData(progressQueryKey, data);
      }
    },
    onSettled: () => {
      pendingMutations.current = Math.max(0, pendingMutations.current - 1);
    }
  });

  const toggleReadingMutation = useMutation({
    mutationKey: ['progress-update', planId],
    mutationFn: async ({
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
      // Chain requests to ensure serial execution
      const previous = mutationQueue.current;

      const task = async () => {
        // Wait for previous request to settle
        await previous.catch(() => {});

        if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
          throw new OfflineError();
        }
        return progressService.updateReadingProgress(planId!, day, readingIndex, completed, readingCount, completedChapters);
      };

      const nextPromise = task();
      mutationQueue.current = nextPromise;
      return nextPromise;
    },
    onMutate: async ({ day, readingIndex, completed, readingCount, completedChapters }) => {
      pendingMutations.current += 1;

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

      return { previous };
    },
    onError: (err, vars, ctx) => {
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

      // If there are other pending mutations, do NOT rollback.
      if (pendingMutations.current > 1) {
        return;
      }

      if (ctx?.previous) {
        queryClient.setQueryData(progressQueryKey, ctx.previous);
      }
    },
    onSuccess: (data) => {
      // If there are other pending mutations, do NOT overwrite the cache with this server response.
      if (pendingMutations.current > 1) {
        return;
      }

      const serverTime = new Date(data.progress.lastUpdated).getTime();
      if (serverTime > latestServerTimestamp.current) {
        latestServerTimestamp.current = serverTime;
        queryClient.setQueryData(progressQueryKey, data);
      }
    },
    onSettled: () => {
      pendingMutations.current = Math.max(0, pendingMutations.current - 1);
    }
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
