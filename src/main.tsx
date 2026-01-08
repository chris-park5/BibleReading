
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App";
import { removeFatalErrorOverlay } from "./utils/fatalErrorOverlay";
import { setupPwaServiceWorker } from "./pwa/setupServiceWorker";
import "./styles/index.css";

// PWA: 배포 후 구버전 SW/캐시가 남아 흰 화면이 되는 케이스를 줄이기 위해
// 앱 시작 시 SW 업데이트를 시도하고, waiting 상태면 즉시 활성화합니다.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  setupPwaServiceWorker({
    registerSW,
    navigatorObj: navigator as any,
    windowObj: window as any,
  })
}

const rootEl = document.getElementById("root")!;
// index.html의 전역 에러 핸들러가 React DOM을 덮어쓰지 않도록 표시
rootEl.setAttribute('data-react-mounted', '1');

// 초기 로딩 중 전역 오류 오버레이가 떴다가(일시 네트워크/캐시 이슈)
// 이후 정상적으로 앱이 마운트되는 경우, 오버레이가 화면을 가리지 않도록 제거합니다.
removeFatalErrorOverlay();

createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <SpeedInsights />
  </QueryClientProvider>
);
  