# Capacitor 네이티브 전환 (Service Worker → SQLite)

이 문서는 현재 Vite/React 기반 웹앱(PWA)을 Capacitor로 네이티브 앱(Android)으로 전환하고, 오프라인 저장을 서비스워커/브라우저 스토리지 대신 SQLite로 처리하는 방법을 정리합니다.

## 1) 변경 요약

- PWA/Service Worker 제거
  - `vite-plugin-pwa` 플러그인 비활성화
  - `src/main.tsx`에서 SW 등록 코드 제거
  - `src/sw.ts`, `src/pwa/setupServiceWorker.ts` 제거
- SQLite 적용
  - 오프라인 진도 큐: 네이티브에서는 SQLite(`progress_actions`) 사용
  - 읽기 계획/진도 조회 캐시: 네이티브에서는 SQLite(`kv_cache`)에 저장 후 오프라인 fallback

## 2) 현재 구현된 SQLite 스키마

- `progress_actions`
  - 오프라인에서 발생한 진도 토글(일일/읽기)을 저장했다가 온라인 시 flush
  - key는 last-write-wins(동일 key는 덮어쓰기)
- `kv_cache`
  - 최근 `plans`, `progress` 조회 결과 JSON 저장

## 3) Android 빌드/실행 흐름

1. 웹 빌드
   - `npm run build`

2. Capacitor sync
   - `npm run cap:sync`

3. Android Studio 열기
   - `npm run cap:open:android`

4. Android Studio에서 Run

## 4) 처음 1회 Android 프로젝트 생성(아직 android 폴더가 없을 때)

- 아래 명령은 android 프로젝트 폴더를 생성합니다.
  - `npx cap add android`

(Windows에서는 iOS를 생성/빌드할 수 없습니다. iOS는 macOS에서 `npx cap add ios` 후 Xcode로 실행합니다.)

## 5) 주의사항

- 웹(PWA) 푸시 알림은 Service Worker 기반이었으므로, 네이티브 푸시는 `@capacitor/push-notifications` 기반으로 별도 설정(FCM/APNS)이 필요합니다.
- 네이티브에서 오프라인 읽기/진도 조회는 `kv_cache`에 저장된 최근 데이터 기준으로 fallback됩니다(첫 실행부터 완전 오프라인이면 로그인/초기 데이터는 필요).
