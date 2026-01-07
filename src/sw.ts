/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 클라이언트에서 즉시 업데이트 적용을 요청할 수 있도록 합니다.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data: any = (event as any).data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 배포 후 하얀 화면(구버전 index.html 캐시로 인해 새 hashed asset을 못 찾는 문제)을 줄이기 위해
// HTML(navigation) 요청은 네트워크 우선으로 가져오고, 오프라인 시에만 캐시를 사용합니다.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'html',
    networkTimeoutSeconds: 3,
  })
);

self.addEventListener('push', (event: PushEvent) => {
  const fallback = {
    title: '성경 읽기 알림',
    body: '오늘 말씀을 읽을 시간이에요. 앱을 열어 오늘의 읽기를 확인하세요.',
    url: '/',
  };

  let payload: any = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    try {
      payload = event.data ? event.data.text() : null;
    } catch {
      payload = null;
    }
  }

  const title = (payload && payload.title) || fallback.title;
  const body = (payload && payload.body) || fallback.body;
  const url = (payload && payload.url) || fallback.url;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data && (event.notification.data as any).url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        const windowClient = client as WindowClient;
        if ('focus' in windowClient) {
          await windowClient.focus();
          if ('navigate' in windowClient) {
            try {
              await windowClient.navigate(url);
            } catch {
              // ignore
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
