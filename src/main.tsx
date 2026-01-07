
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
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

  void navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;

    // 최신 SW 체크
    void reg.update();

    // 이미 waiting이면 즉시 교체
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // updatefound 이후 waiting이 생기면 즉시 교체
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
  