import { queryClient } from "../../queryClient";
import { useAuthStore } from "../../stores/auth.store";
import * as progressService from "../../services/progressService";

export class OfflineError extends Error {
  constructor(message = "OFFLINE") {
    super(message);
    this.name = "OfflineError";
  }
}

type ReadingAction = {
  key: string;
  userId: string;
  type: "reading";
  planId: string;
  day: number;
  readingIndex: number;
  completed: boolean;
  readingCount: number;
  createdAt: number;
};

type DayAction = {
  key: string;
  userId: string;
  type: "day";
  planId: string;
  day: number;
  completed: boolean;
  createdAt: number;
};

export type OfflineProgressAction = ReadingAction | DayAction;

const DB_NAME = "bible-reading-offline";
const DB_VERSION = 1;
const STORE = "progress_actions";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      // tx error will also surface via req.onerror
      try {
        db.close();
      } catch {
        // ignore
      }
    };
  });
}

async function putAction(action: OfflineProgressAction): Promise<void> {
  await withStore("readwrite", (store) => store.put(action) as any);
}

async function getAllActions(): Promise<OfflineProgressAction[]> {
  return withStore("readonly", (store) => store.getAll() as any);
}

async function deleteAction(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key) as any);
}

function getUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function readingKey(userId: string, planId: string, day: number, readingIndex: number) {
  return `${userId}:reading:${planId}:${day}:${readingIndex}`;
}

function dayKey(userId: string, planId: string, day: number) {
  return `${userId}:day:${planId}:${day}`;
}

export function isOfflineLikeError(err: unknown): boolean {
  // 브라우저가 오프라인 상태인 경우
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return true;
  
  // 명시적 오프라인 에러
  if (err instanceof OfflineError) return true;
  
  // TypeError는 네트워크 에러일 수도 있지만, 다른 원인(코드 버그 등)일 수도 있음
  // 메시지를 확인해서 네트워크 관련인 경우에만 오프라인으로 판단
  if (err instanceof TypeError) {
    const msg = err.message?.toLowerCase() ?? "";
    // fetch 실패 관련 메시지만 오프라인으로 처리
    if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) {
      return true;
    }
    // 그 외 TypeError는 오프라인이 아닌 실제 에러로 처리
    return false;
  }

  const msg = (err as any)?.message;
  if (typeof msg === "string" && /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) return true;
  
  // AbortError(타임아웃)는 네트워크 불안정으로 간주
  if ((err as any)?.name === "AbortError") return true;
  
  return false;
}

export async function enqueueReadingToggle(vars: {
  planId: string;
  day: number;
  readingIndex: number;
  completed: boolean;
  readingCount: number;
}): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const userId = getUserId();
  if (!userId) return;

  const action: ReadingAction = {
    key: readingKey(userId, vars.planId, vars.day, vars.readingIndex),
    userId,
    type: "reading",
    planId: vars.planId,
    day: vars.day,
    readingIndex: vars.readingIndex,
    completed: vars.completed,
    readingCount: vars.readingCount,
    createdAt: Date.now(),
  };

  // 압축(last-write-wins): 동일 key는 덮어쓰기
  await putAction(action);
}

export async function enqueueDayToggle(vars: {
  planId: string;
  day: number;
  completed: boolean;
}): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const userId = getUserId();
  if (!userId) return;

  const action: DayAction = {
    key: dayKey(userId, vars.planId, vars.day),
    userId,
    type: "day",
    planId: vars.planId,
    day: vars.day,
    completed: vars.completed,
    createdAt: Date.now(),
  };

  await putAction(action);
}

let flushing = false;
let pendingFlush: Promise<void> | null = null;

export async function flushOfflineProgressQueue(): Promise<void> {
  if (flushing) return pendingFlush ?? Promise.resolve();

  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return;

  const userId = getUserId();
  if (!userId) return;

  flushing = true;
  pendingFlush = (async () => {
    try {
      const all = await getAllActions();
      const actions = all
        .filter((a) => a.userId === userId)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

      for (const action of actions) {
        if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) break;

        try {
          if (action.type === "reading") {
            const res = await progressService.updateReadingProgress(
              action.planId,
              action.day,
              action.readingIndex,
              action.completed,
              action.readingCount
            );
            queryClient.setQueryData(["progress", userId, action.planId], res);
          } else {
            const res = await progressService.updateProgress(action.planId, action.day, action.completed);
            queryClient.setQueryData(["progress", userId, action.planId], res);
          }

          await deleteAction(action.key);
        } catch (err) {
          // 네트워크 문제면 다음 online 시점에 재시도
          if (isOfflineLikeError(err)) break;

          // 인증/권한/기타 서버 오류는 무한 루프 방지: 일단 중단
          break;
        }
      }
    } finally {
      flushing = false;
      pendingFlush = null;
    }
  })();

  return pendingFlush;
}

export async function clearOfflineQueueForUser(targetUserId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const all = await getAllActions();
  const toDelete = all.filter((a) => a.userId === targetUserId).map((a) => a.key);
  for (const key of toDelete) {
    await deleteAction(key);
  }
}
