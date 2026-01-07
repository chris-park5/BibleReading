import * as api from './api';

type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensurePushSubscriptionRegistered(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!('serviceWorker' in navigator)) {
    alert('이 브라우저는 서비스 워커를 지원하지 않습니다');
    return false;
  }

  if (!('PushManager' in window)) {
    alert('이 브라우저는 푸시 알림을 지원하지 않습니다');
    return false;
  }

  // Push requires a secure context (HTTPS) except localhost.
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (!window.isSecureContext && !isLocalhost) {
    alert('푸시 알림은 HTTPS 환경에서만 동작합니다');
    return false;
  }

  let vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    try {
      const res = await api.getVapidPublicKey();
      vapidPublicKey = res.publicKey;
    } catch {
      // ignore
    }
  }

  if (!vapidPublicKey) {
    alert(
      `푸시 알림 키가 설정되지 않았습니다.\n\n` +
        `- 로컬 개발: .env.local의 VITE_VAPID_PUBLIC_KEY 확인\n` +
        `- 배포 환경: Vercel 등에 VITE_VAPID_PUBLIC_KEY 설정 후 재배포\n` +
        `- 또는: 서버(Edge Function) VAPID_PUBLIC_KEY 설정 확인\n\n` +
        `현재 접속: ${window.location.origin}`
    );
    return false;
  }

  const reg = await navigator.serviceWorker.ready;

  // Reuse existing subscription if present.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON() as PushSubscriptionJSON;
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    alert('푸시 구독 정보를 가져오지 못했습니다');
    return false;
  }

  await api.savePushSubscription({
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    userAgent: navigator.userAgent,
  });

  return true;
}
