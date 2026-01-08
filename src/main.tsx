
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./app/App";
import "./styles/index.css";

let hasReloadedForSwUpdate = false;

// PWA: 배포 후 구버전 SW/캐시가 남아 흰 화면이 되는 케이스를 줄이기 위해
// 앱 시작 시 SW 업데이트를 시도하고, waiting 상태면 즉시 활성화합니다.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // 새 서비스 워커가 활성화되어 컨트롤러가 바뀌는 순간(=새 캐시/자산이 준비됨)
  // 딱 1회 리로드해서 구버전 HTML/JS 캐시 섞임을 줄입니다.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForSwUpdate) return;
    hasReloadedForSwUpdate = true;
    window.location.reload();
  });

  const tryUpdate = async (reg: ServiceWorkerRegistration) => {
    // 오프라인일 때 update()가 실패하며 전역 unhandledrejection을 유발할 수 있어
    // 온라인일 때만 갱신을 시도합니다.
    if (!navigator.onLine) return;
    try {
      await reg.update();
    } catch {
      // ignore: offline/일시 네트워크 오류는 치명적이지 않음
    }
  };

  void navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (!reg) return;

      // 최신 SW 체크(온라인일 때만)
      void tryUpdate(reg);

      // 온라인으로 돌아오면 다시 한번 갱신 시도
      const onOnline = () => void tryUpdate(reg);
      window.addEventListener('online', onOnline);

      // 이미 waiting이면 즉시 교체
      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore
        }
      }

      // updatefound 이후 waiting이 생기면 즉시 교체
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && reg.waiting) {
            try {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } catch {
              // ignore
            }
          }
        });
      });

      // cleanup
      window.addEventListener('beforeunload', () => {
        window.removeEventListener('online', onOnline);
      });
    })
    .catch(() => {
      // ignore
    });
}

const rootEl = document.getElementById("root")!;
// index.html의 전역 에러 핸들러가 React DOM을 덮어쓰지 않도록 표시
rootEl.setAttribute('data-react-mounted', '1');

createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <SpeedInsights />
  </QueryClientProvider>
);
  