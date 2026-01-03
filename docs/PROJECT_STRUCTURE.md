# 📊 Bible Reading Plan App - 전체 프로젝트 구조 분석

## 🎯 프로젝트 개요

**성경 읽기 계획 관리 PWA (Progressive Web App)**

- React 18 + TypeScript + Vite 기반 모바일 최적화 웹 앱
- Supabase Auth + Edge Functions 백엔드
- Mock API 모드 지원으로 로컬 개발/테스트 가능

---

## 📁 폴더별 상세 분석

### 1. **루트 디렉토리**

#### 설정 파일들

- **`package.json`**: 프로젝트 메타데이터 및 의존성

  - React 18.3, Vite 6.3, TypeScript
  - Radix UI (shadcn/ui 컴포넌트)
  - Supabase, React Query, Zustand
  - PWA 플러그인 (`vite-plugin-pwa`)

- **`vite.config.ts`**: Vite 빌드 설정

  - React + Tailwind 플러그인
  - PWA 설정 (manifest, service worker, 아이콘)
  - 경로 alias (`@` → `./src`)

- **`tsconfig.json`**: TypeScript 컴파일러 설정

  - ES 모듈, JSX 지원
  - Supabase 폴더 제외

- **`index.html`**: HTML 엔트리포인트
  - `<div id="root">` 마운트 포인트
  - `/src/main.tsx` 로드

#### 문서 파일들

- **`README.md`**: 프로젝트 소개, 기능 설명, 사용법
- **`ARCHITECTURE_IMPROVEMENTS.md`**: 아키텍처 개선 내역
- **`REFACTORING_COMPLETE.md`**: 리팩터링 완료 내역
- **`ATTRIBUTIONS.md`**: 라이선스 및 출처

#### 환경 설정

- **`.env.local`**: 로컬 환경변수
  - `VITE_USE_MOCK_API`: Mock 모드 스위치 (true/false)
  - `VITE_ENABLE_DEV_PAGE`: 개발자 페이지 활성화

---

### 2. **`src/` - 프론트엔드 소스 코드**

#### **`src/main.tsx`** ⭐ 앱 진입점

```tsx
- createRoot로 React 앱 마운트
- QueryClientProvider로 React Query 전역 설정
  - staleTime: 5분
  - refetchOnWindowFocus: false
- <App /> 렌더링
```

#### **`src/app/` - 애플리케이션 로직**

##### **`App.tsx`** - 메인 앱 컴포넌트

- 인증 상태 확인 (`useAuthStore`)
- 세션 체크 (`api.getSession()`)
- 라우팅 로직:
  - 미인증 → `AuthPage`
  - 개발자 모드 (`#/dev`) → `DeveloperPlansPage`
  - 인증됨 → `MainTabsPage` (메인 탭 UI)

---

#### **`src/app/pages/` - 페이지 컴포넌트들**

| 파일                         | 역할                                                 |
| ---------------------------- | ---------------------------------------------------- |
| **`AuthPage.tsx`**           | 로그인/회원가입 화면                                 |
| **`MainTabsPage.tsx`**       | 🔥 메인 화면 - 5개 탭 (홈/진도율/계획추가/친구/설정) |
| **`PlanSelectorPage.tsx`**   | 계획 선택/생성 (프리셋 + 커스텀)                     |
| **`DashboardPage.tsx`**      | (구 버전) 단일 페이지 대시보드                       |
| **`DeveloperPlansPage.tsx`** | 개발자용 프리셋 JSON 등록 페이지                     |
| **`FriendsTabPage.tsx`**     | 친구 추가 + 진도 조회                                |
| **`SettingsTabPage.tsx`**    | 알림 설정 + 로그아웃                                 |

**핵심: `MainTabsPage.tsx`**

- 하단 고정 탭 네비게이션 (모바일 UX)
- **홈 탭**: 오늘 날짜 + 모든 계획의 "오늘 읽기" 집계 표시, 항목별 체크
- **진도율 탭**: 선택 계획의 차트 + 달성률(오늘까지 경과일 기준) + 메시지
- **계획 추가 탭**: `PlanSelectorPage` 임베드
- **친구/설정 탭**: 각각 전용 페이지

---

#### **`src/app/components/` - 재사용 UI 컴포넌트**

| 파일                           | 역할                                                 |
| ------------------------------ | ---------------------------------------------------- |
| **`Auth.tsx`**                 | 로그인/회원가입 폼                                   |
| **`TodayReading.tsx`**         | 오늘의 읽기 항목 표시 + 항목별 체크                  |
| **`ProgressChart.tsx`**        | Recharts 기반 진도 차트                              |
| **`ReadingHistory.tsx`**       | 완료한 날짜 기록 (접기/펼치기)                       |
| **`ReadingPlanCard.tsx`**      | 계획 선택 카드                                       |
| **`CustomPlanCreator.tsx`**    | 커스텀 계획 생성 폼 (OT/NT 책 선택 + 일수 자동 분배) |
| **`FriendsPanel.tsx`**         | 친구 목록/진도                                       |
| **`NotificationSettings.tsx`** | 알림 시간 설정                                       |

##### **`components/ui/` - Radix UI 기반 공통 컴포넌트**

- `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx` 등
- shadcn/ui 스타일의 재사용 가능한 원자 컴포넌트들

##### **`components/figma/` - Figma 자산**

- `ImageWithFallback.tsx`: 이미지 로드 실패 시 폴백

---

#### **`src/app/plans/` - 프리셋 읽기 계획 (JSON)**

| 파일                              | 설명                |
| --------------------------------- | ------------------- |
| **`one-year.json`**               | 1년 365일 계획      |
| **`ninety-day.json`**             | 90일 단기 계획      |
| **`new-testament.json`**          | 신약 집중           |
| **`psalms-proverbs.json`**        | 시편/잠언 31일      |
| **`one-year_newtwo_oldone.json`** | 신약 2회 + 구약 1회 |

**JSON 구조**:

```json
{
  "id": "계획ID",
  "title": "표시 이름",
  "duration": "기간 설명",
  "totalDays": 숫자,
  "schedule": [
    {
      "day": 1,
      "readings": [
        { "book": "창세기", "chapters": "1-3장" }
      ]
    }
  ]
}
```

---

#### **`src/app/utils/` - 유틸리티**

##### **`api.ts`** ⭐ 핵심 API 클라이언트

- **Mock 모드 / Real 모드 분기** (`VITE_USE_MOCK_API`)
- **Mock 모드**: localStorage 기반 (auth, plans, progress)
- **Real 모드**: Supabase Auth + Edge Functions 호출
- **주요 함수**:
  - `signUp`, `signIn`, `signOut`, `getSession`
  - `createPlan`, `getPlans`, `deletePlan`
  - `getProgress`, `updateProgress`, `updateReadingProgress`
  - `getFriends`, `addFriend`, `getFriendProgress`
  - 개발자 프리셋: `getDeveloperPresetPlans`, `addDeveloperPresetPlan`

---

### 3. **`src/hooks/` - React 커스텀 훅**

| 파일                 | 역할                                                           |
| -------------------- | -------------------------------------------------------------- |
| **`usePlans.ts`**    | React Query로 계획 목록 관리 (fetch, create, delete)           |
| **`useProgress.ts`** | React Query로 진도 관리 (fetch, toggleComplete, toggleReading) |

---

### 4. **`src/stores/` - Zustand 상태 관리**

| 파일                | 관리 상태                                           |
| ------------------- | --------------------------------------------------- |
| **`auth.store.ts`** | 인증 상태 (user, isAuthenticated) + zustand persist |
| **`plan.store.ts`** | 선택된 계획 ID, currentDay, 모달 상태               |

---

### 5. **`src/types/` - TypeScript 타입 정의**

##### **`domain.ts`**

```typescript
interface Plan {
  id;
  userId;
  name;
  startDate;
  endDate;
  totalDays;
  schedule;
  isCustom;
  createdAt;
}

interface Progress {
  userId;
  planId;
  completedDays: number[];
  completedReadingsByDay?: Record<string, number[]>; // 항목별 체크
  lastUpdated;
}
```

---

### 6. **`src/styles/` - CSS 스타일**

| 파일               | 역할                           |
| ------------------ | ------------------------------ |
| **`index.css`**    | 전역 스타일 + Tailwind imports |
| **`tailwind.css`** | Tailwind 유틸리티              |
| **`fonts.css`**    | 웹 폰트                        |
| **`theme.css`**    | 테마 변수 (shadcn/ui 색상)     |

---

### 7. **`supabase/` - 백엔드 (Serverless)**

#### **`supabase/functions/server/`** - Deno Edge Functions

| 파일               | 역할                                         |
| ------------------ | -------------------------------------------- |
| **`index.tsx`**    | Hono 서버 진입점 + CORS 설정                 |
| **`routes.tsx`**   | API 라우트 핸들러 (plans, progress, friends) |
| **`auth.tsx`**     | JWT 토큰 검증 미들웨어                       |
| **`kv_store.tsx`** | Supabase KV를 이용한 임시 저장 (RLS 대안)    |

**주요 엔드포인트**:

- `POST /signup`, `POST /signin`
- `GET /plans`, `POST /plans`, `DELETE /plans/:id`
- `GET /progress/:planId`, `PUT /progress` (항목별 체크 지원)
- `GET /friends`, `POST /friends`, `GET /friends/:id/progress`

#### **`supabase/migrations/`**

- PostgreSQL 스키마 마이그레이션 (RLS 정책 포함)

---

### 8. **`utils/supabase/` - Supabase 설정**

##### **`info.tsx`**

```typescript
export const projectId = "...";
export const publicAnonKey = "...";
```

- Supabase 프로젝트 연결 정보

---

### 9. **`public/` - 정적 자산**

| 파일                    | 역할                |
| ----------------------- | ------------------- |
| **`icon.svg`**          | PWA 아이콘          |
| **`maskable-icon.svg`** | PWA 마스커블 아이콘 |

---

### 10. **`dist/` - 빌드 산출물**

- `npm run build` 결과물
- `sw.js` (서비스 워커), `manifest.webmanifest` (PWA)
- 정적 파일 호스팅용

---

### 11. **`docs/` - 프로젝트 문서**

- 프로젝트 구조, 아키텍처, 개발 가이드 등 문서 저장

---

## 🔄 데이터 흐름 (아키텍처)

```
사용자
  ↓
[MainTabsPage] ← 홈/진도율/계획/친구/설정
  ↓
[React Query Hooks] (usePlans, useProgress)
  ↓
[api.ts] ← Mock/Real 분기
  ↓
┌─────────────────┬─────────────────┐
│   Mock 모드      │   Real 모드      │
│  localStorage    │  Supabase       │
│  (UI 테스트용)   │  Auth + Edge Fn │
└─────────────────┴─────────────────┘
```

---

## 🚀 핵심 워크플로우

### 1️⃣ 앱 시작

1. `main.tsx` → React Query Provider 설정
2. `App.tsx` → `api.getSession()` 호출
3. 세션 없으면 → `AuthPage` (로그인)
4. 세션 있으면 → `MainTabsPage` (홈 탭 기본)

### 2️⃣ 계획 생성/선택

1. 홈/계획추가 탭 → `PlanSelectorPage`
2. 프리셋 선택 or 커스텀 생성
3. `usePlans.createPlan` mutation → `api.createPlan()`
4. Mock: localStorage / Real: Edge Function → DB 저장
5. 홈으로 이동 → 오늘 읽기 표시

### 3️⃣ 진도 체크 (항목별)

1. 홈 탭 → `TodayReading` 컴포넌트
2. 항목 클릭 → `onToggleReading(readingIndex, completed)`
3. `useProgress.toggleReading` mutation
4. `api.updateReadingProgress(planId, day, readingIndex, completed, readingCount)`
5. Mock: localStorage 업데이트 / Real: Edge Function → DB 저장
6. `completedReadingsByDay[day]` 배열에 저장
7. 전체 항목 완료 시 `completedDays`에 day 추가

### 4️⃣ 진도율 확인

1. 진도율 탭 → `ProgressTab`
2. `useProgress(planId)` 훅으로 progress 데이터 로드
3. "오늘까지 경과한 날짜" 대비 완료 날짜 계산
4. `ProgressChart` + 달성률 카드 + 메시지 표시

---

## 🎨 UI/UX 특징

- **모바일 최적화**: 하단 고정 탭 네비게이션
- **PWA**: 오프라인 지원, 홈 화면 추가 가능
- **반응형**: Tailwind로 데스크탑/모바일 대응
- **접근성**: Radix UI로 키보드/스크린 리더 지원
- **사용자 경험**:
  - 기본 탭은 항상 홈
  - 계획 없어도 홈에서 추가 유도
  - 여러 계획 병행 가능
  - 항목별 세밀한 체크

---

## 🔧 개발/배포 모드

### Mock 모드 (`.env.local`: `VITE_USE_MOCK_API=true`)

- localStorage 기반 로컬 데이터
- 백엔드 없이 UI 개발/테스트
- 로그인 필요 (mock user 생성)

### Real 모드 (`.env.local`: `VITE_USE_MOCK_API=false`)

- Supabase Auth + Edge Functions 연결
- 실제 DB 저장
- 프로덕션 환경

---

## 📦 주요 의존성

### 프론트엔드

- **React 18.3** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Vite 6.3** - 빌드 도구
- **Tailwind CSS 4.1** - 스타일링
- **Radix UI** - 접근성 컴포넌트
- **React Query 5.59** - 서버 상태 관리
- **Zustand 4.5** - 클라이언트 상태 관리
- **Recharts 2.15** - 차트 시각화
- **Lucide React** - 아이콘
- **date-fns 3.6** - 날짜 유틸리티

### 백엔드

- **Supabase** - BaaS (Auth, DB, Edge Functions)
- **Hono** - 웹 프레임워크
- **Deno** - 서버리스 런타임

### PWA

- **vite-plugin-pwa 0.21** - PWA 생성

---

## 🎯 프로젝트 특징

이 프로젝트는 **프론트엔드(React/Vite) + 백엔드(Supabase Edge Functions) + Mock 레이어**를 깔끔하게 분리해, 개발 시에는 Mock으로 빠르게 반복하고 배포 시에는 Real 백엔드로 전환 가능한 유연한 아키텍처를 갖추고 있습니다.

주요 장점:

- ✅ Mock 모드로 백엔드 없이 프론트엔드 개발 가능
- ✅ 모바일 우선 PWA로 앱처럼 사용 가능
- ✅ 항목별 세밀한 진도 관리
- ✅ 여러 계획 동시 진행 지원
- ✅ 깔끔한 컴포넌트 분리로 유지보수 용이
