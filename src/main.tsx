
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./app/App";
import { removeFatalErrorOverlay } from "./utils/fatalErrorOverlay";
import "./styles/index.css";

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
  