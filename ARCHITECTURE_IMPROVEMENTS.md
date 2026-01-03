# 🏗️ 프로젝트 구조 개선 가이드

## 📋 현재 구조의 문제점

### 1. 백엔드 아키텍처 문제 ⚠️

#### 문제 1-1: Key-Value 저장소 남용

```typescript
// 현재: KV 저장소로 모든 데이터 관리
await kv.set(`plan:${planId}`, plan);
await kv.set(`progress:${userId}:${planId}`, progress);
```

**문제점:**

- ❌ 관계형 데이터를 JSON으로 저장 (PostgreSQL의 장점 미활용)
- ❌ 복잡한 쿼리 불가능 (JOIN, 집계, 인덱싱)
- ❌ 데이터 무결성 보장 어려움
- ❌ 트랜잭션 관리 복잡
- ❌ 확장성 제한 (대량 데이터 처리 어려움)

#### 문제 1-2: 타입 안정성 부족

```typescript
// kv_store.tsx
export const get = async (key: string): Promise<any> => {  // any 타입!
```

**문제점:**

- ❌ 런타임 에러 가능성
- ❌ 자동완성 및 타입 체크 불가
- ❌ 리팩토링 어려움

#### 문제 1-3: 데이터 검증 레이어 부재

```typescript
// routes.tsx - 검증 로직 부족
const { name, startDate, totalDays, schedule, isCustom } = await c.req.json();
// 바로 저장 - 데이터 유효성 검증 없음
```

---

### 2. 프론트엔드 아키텍처 문제 ⚠️

#### 문제 2-1: God Component (App.tsx)

```typescript
// App.tsx - 500줄 가까운 거대 컴포넌트
export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  // ... 10개 이상의 state

  // 모든 비즈니스 로직이 여기에...
}
```

**문제점:**

- ❌ 단일 책임 원칙 위반
- ❌ 테스트 어려움
- ❌ 재사용 불가능
- ❌ 성능 최적화 어려움 (불필요한 리렌더링)

#### 문제 2-2: 전역 상태 관리 부재

```typescript
// 상태를 Props Drilling으로 전달
<FriendsPanel currentPlanId={selectedPlanId} />
<NotificationSettings planId={selectedPlanId} />
```

**문제점:**

- ❌ Props 지옥 (Props Drilling)
- ❌ 컴포넌트 간 상태 공유 어려움
- ❌ 상태 동기화 문제

#### 문제 2-3: 타입 정의 분산

```typescript
// App.tsx에 인터페이스 정의
interface Plan { ... }
interface Progress { ... }

// api.ts에도 중복된 타입 사용
// 다른 컴포넌트에서도 재정의
```

---

### 3. 데이터베이스 설계 문제 ⚠️

#### 현재 구조

```
kv_store_7fb946f4
- key: TEXT
- value: JSONB  ← 모든 데이터가 JSON으로 저장됨
```

**문제점:**

- ❌ 관계형 쿼리 불가
- ❌ 외래 키 제약 조건 없음
- ❌ 인덱싱 제한적
- ❌ 데이터 정규화 불가

---

## ✅ 개선 방안

### 1. 백엔드 리팩토링

#### 1-1: 적절한 데이터베이스 스키마 설계

```sql
-- ✅ 정규화된 테이블 구조

-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 읽기 계획 테이블
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  total_days INTEGER NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- 읽기 일정 테이블 (정규화)
CREATE TABLE plan_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  book VARCHAR(100) NOT NULL,
  chapters VARCHAR(50) NOT NULL,

  INDEX idx_plan_id (plan_id),
  INDEX idx_day (day),
  UNIQUE(plan_id, day, book)  -- 중복 방지
);

-- 진도 테이블
CREATE TABLE progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_plan (user_id, plan_id),
  INDEX idx_completed_at (completed_at),
  UNIQUE(user_id, plan_id, day)  -- 같은 날 중복 완료 방지
);

-- 친구 관계 테이블
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_id (user_id),
  INDEX idx_friend_id (friend_id),
  UNIQUE(user_id, friend_id),
  CHECK(user_id != friend_id)  -- 자기 자신과 친구 불가
);

-- 알림 설정 테이블
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, plan_id)
);
```

**장점:**

- ✅ 데이터 무결성 보장 (외래 키 제약)
- ✅ 복잡한 쿼리 가능 (JOIN, 집계)
- ✅ 성능 최적화 (인덱스)
- ✅ 트랜잭션 지원
- ✅ 확장성 우수

#### 1-2: 타입 안전성 강화

```typescript
// 📁 types/database.types.ts
// Supabase CLI로 자동 생성 가능: supabase gen types typescript

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string | null;
          total_days: number;
          is_custom: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date?: string | null;
          total_days: number;
          is_custom?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          start_date?: string;
          end_date?: string | null;
          total_days?: number;
          updated_at?: string;
        };
      };
      // ... 다른 테이블들
    };
  };
}

// 📁 types/api.types.ts
import type { Database } from "./database.types";

export type User = Database["public"]["Tables"]["users"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type PlanInsert = Database["public"]["Tables"]["plans"]["Insert"];
export type PlanUpdate = Database["public"]["Tables"]["plans"]["Update"];

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

#### 1-3: 데이터 검증 레이어 추가

```typescript
// 📁 supabase/functions/server/validators/plan.validator.ts
import { z } from "npm:zod";

export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  totalDays: z.number().int().positive().max(365),
  schedule: z.array(
    z.object({
      day: z.number().int().positive(),
      readings: z.array(
        z.object({
          book: z.string().min(1),
          chapters: z.string().min(1),
        })
      ),
    })
  ),
  isCustom: z.boolean().default(false),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

// 사용 예시
export async function validateCreatePlan(
  data: unknown
): Promise<CreatePlanInput> {
  return createPlanSchema.parse(data);
}
```

```typescript
// 📁 supabase/functions/server/routes/plans.ts
import { validateCreatePlan } from "../validators/plan.validator.ts";

export async function createPlan(c: Context) {
  try {
    const body = await c.req.json();

    // ✅ 데이터 검증
    const validatedData = await validateCreatePlan(body);

    const userId = c.get("userId");

    // ✅ 타입 안전한 DB 작업
    const { data, error } = await supabase
      .from("plans")
      .insert({
        user_id: userId,
        name: validatedData.name,
        start_date: validatedData.startDate,
        total_days: validatedData.totalDays,
        is_custom: validatedData.isCustom,
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        400
      );
    }
    return c.json({ success: false, error: error.message }, 500);
  }
}
```

#### 1-4: Repository 패턴 도입

```typescript
// 📁 supabase/functions/server/repositories/plan.repository.ts
import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Plan, PlanInsert } from "../../types/database.types.ts";

export class PlanRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: PlanInsert): Promise<Plan> {
    const { data: plan, error } = await this.supabase
      .from("plans")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return plan;
  }

  async findByUserId(userId: string): Promise<Plan[]> {
    const { data, error } = await this.supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from("plans")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }
    return data;
  }

  async update(id: string, data: Partial<PlanInsert>): Promise<Plan> {
    const { data: plan, error } = await this.supabase
      .from("plans")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return plan;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("plans").delete().eq("id", id);

    if (error) throw error;
  }

  // 복잡한 쿼리 예시
  async findWithProgress(userId: string, planId: string) {
    const { data, error } = await this.supabase
      .from("plans")
      .select(
        `
        *,
        schedules:plan_schedules(*),
        progress:progress(*)
      `
      )
      .eq("id", planId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  }
}
```

---

### 2. 프론트엔드 리팩토링

#### 2-1: 전역 상태 관리 (Zustand 사용)

```typescript
// 📁 src/stores/auth.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/api.types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
    }
  )
);
```

```typescript
// 📁 src/stores/plan.store.ts
import { create } from "zustand";
import type { Plan, Progress } from "../types/api.types";

interface PlanState {
  plans: Plan[];
  selectedPlanId: string | null;
  currentDay: number;
  progress: Progress | null;

  // Actions
  setPlans: (plans: Plan[]) => void;
  selectPlan: (planId: string) => void;
  setCurrentDay: (day: number) => void;
  setProgress: (progress: Progress) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  plans: [],
  selectedPlanId: null,
  currentDay: 1,
  progress: null,

  setPlans: (plans) => set({ plans }),
  selectPlan: (planId) => set({ selectedPlanId: planId }),
  setCurrentDay: (day) => set({ currentDay: day }),
  setProgress: (progress) => set({ progress }),
}));
```

#### 2-2: Custom Hooks로 비즈니스 로직 분리

```typescript
// 📁 src/hooks/usePlans.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/plans.api";
import { usePlanStore } from "../stores/plan.store";

export function usePlans() {
  const queryClient = useQueryClient();
  const setPlans = usePlanStore((state) => state.setPlans);

  const { data, isLoading, error } = useQuery({
    queryKey: ["plans"],
    queryFn: api.getPlans,
    onSuccess: (data) => setPlans(data.plans),
  });

  const createPlanMutation = useMutation({
    mutationFn: api.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries(["plans"]);
    },
  });

  return {
    plans: data?.plans || [],
    isLoading,
    error,
    createPlan: createPlanMutation.mutate,
    isCreating: createPlanMutation.isLoading,
  };
}
```

```typescript
// 📁 src/hooks/useProgress.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/progress.api";
import { usePlanStore } from "../stores/plan.store";

export function useProgress(planId: string | null) {
  const queryClient = useQueryClient();
  const setProgress = usePlanStore((state) => state.setProgress);

  const { data, isLoading } = useQuery({
    queryKey: ["progress", planId],
    queryFn: () => api.getProgress(planId!),
    enabled: !!planId,
    onSuccess: (data) => setProgress(data.progress),
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ day, completed }: { day: number; completed: boolean }) =>
      api.updateProgress(planId!, day, completed),
    onSuccess: () => {
      queryClient.invalidateQueries(["progress", planId]);
    },
  });

  return {
    progress: data?.progress,
    isLoading,
    toggleComplete: toggleCompleteMutation.mutate,
    isUpdating: toggleCompleteMutation.isLoading,
  };
}
```

#### 2-3: 컴포넌트 분해

```typescript
// 📁 src/app/App.tsx - 리팩토링 후
import { useAuthStore } from "../stores/auth.store";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlanSelectorPage } from "./pages/PlanSelectorPage";

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const selectedPlanId = usePlanStore((state) => state.selectedPlanId);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (!selectedPlanId) {
    return <PlanSelectorPage />;
  }

  return <DashboardPage />;
}
```

```typescript
// 📁 src/app/pages/DashboardPage.tsx
import { usePlanStore } from "../../stores/plan.store";
import { useProgress } from "../../hooks/useProgress";
import { TodayReading } from "../components/TodayReading";
import { ProgressChart } from "../components/ProgressChart";

export function DashboardPage() {
  const { selectedPlanId, currentDay } = usePlanStore();
  const { progress, toggleComplete } = useProgress(selectedPlanId);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto">
        <TodayReading
          day={currentDay}
          onComplete={() =>
            toggleComplete({ day: currentDay, completed: true })
          }
        />
        <ProgressChart progress={progress} />
      </main>
    </div>
  );
}
```

#### 2-4: API 레이어 개선

```typescript
// 📁 src/api/client.ts
import { supabase } from "./supabase";
import type { ApiResponse } from "../types/api.types";

class ApiClient {
  async get<T>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      headers: await this.getHeaders(),
    });
    return response.json();
  }

  async post<T>(url: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  private async getHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
    };
  }
}

export const apiClient = new ApiClient();
```

```typescript
// 📁 src/api/plans.api.ts
import { apiClient } from "./client";
import type { Plan, PlanInsert, ApiResponse } from "../types/api.types";

export async function getPlans(): Promise<ApiResponse<Plan[]>> {
  return apiClient.get("/plans");
}

export async function createPlan(data: PlanInsert): Promise<ApiResponse<Plan>> {
  return apiClient.post("/plans", data);
}

export async function updatePlan(
  id: string,
  data: Partial<PlanInsert>
): Promise<ApiResponse<Plan>> {
  return apiClient.put(`/plans/${id}`, data);
}

export async function deletePlan(id: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/plans/${id}`);
}
```

---

### 3. 개선된 프로젝트 구조

```
Bible Reading Plan App/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx                    # ✅ 라우팅만 담당 (간결)
│   │   ├── pages/                     # ✅ 페이지 컴포넌트
│   │   │   ├── AuthPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── PlanSelectorPage.tsx
│   │   │   └── FriendsPage.tsx
│   │   └── components/                # ✅ 재사용 컴포넌트
│   │       ├── TodayReading/
│   │       │   ├── TodayReading.tsx
│   │       │   ├── TodayReading.test.tsx
│   │       │   └── index.ts
│   │       └── ...
│   │
│   ├── hooks/                         # ✅ Custom Hooks
│   │   ├── usePlans.ts
│   │   ├── useProgress.ts
│   │   ├── useFriends.ts
│   │   └── useAuth.ts
│   │
│   ├── stores/                        # ✅ 전역 상태 관리
│   │   ├── auth.store.ts
│   │   ├── plan.store.ts
│   │   └── ui.store.ts
│   │
│   ├── api/                           # ✅ API 클라이언트
│   │   ├── client.ts
│   │   ├── plans.api.ts
│   │   ├── progress.api.ts
│   │   └── friends.api.ts
│   │
│   ├── types/                         # ✅ 타입 정의 중앙화
│   │   ├── database.types.ts         # Supabase 생성
│   │   ├── api.types.ts
│   │   └── domain.types.ts
│   │
│   └── utils/                         # ✅ 유틸리티 함수
│       ├── date.utils.ts
│       ├── validation.utils.ts
│       └── format.utils.ts
│
├── supabase/
│   ├── migrations/                    # ✅ DB 마이그레이션
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_indexes.sql
│   │   └── 003_add_rls.sql
│   │
│   └── functions/
│       └── server/
│           ├── index.tsx
│           ├── middleware/            # ✅ 미들웨어 분리
│           │   ├── auth.middleware.ts
│           │   └── error.middleware.ts
│           ├── routes/                # ✅ 라우트별 분리
│           │   ├── plans.routes.ts
│           │   ├── progress.routes.ts
│           │   └── friends.routes.ts
│           ├── repositories/          # ✅ Repository 패턴
│           │   ├── plan.repository.ts
│           │   ├── progress.repository.ts
│           │   └── user.repository.ts
│           ├── services/              # ✅ 비즈니스 로직
│           │   ├── plan.service.ts
│           │   └── progress.service.ts
│           └── validators/            # ✅ 데이터 검증
│               ├── plan.validator.ts
│               └── progress.validator.ts
│
└── tests/                             # ✅ 테스트 코드
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 🎯 마이그레이션 로드맵

### Phase 1: 데이터베이스 리팩토링 (우선순위: 높음)

1. ✅ 정규화된 테이블 스키마 작성
2. ✅ 마이그레이션 스크립트 작성
3. ✅ KV → 관계형 DB 데이터 마이그레이션
4. ✅ RLS (Row Level Security) 정책 설정

### Phase 2: 백엔드 리팩토링 (우선순위: 높음)

1. ✅ 타입 정의 추가 (database.types.ts)
2. ✅ Repository 패턴 도입
3. ✅ 검증 레이어 추가 (Zod)
4. ✅ 에러 핸들링 개선

### Phase 3: 프론트엔드 리팩토링 (우선순위: 중간)

1. ✅ Zustand 상태 관리 도입
2. ✅ React Query 캐싱 도입
3. ✅ Custom Hooks 분리
4. ✅ 컴포넌트 분해 (페이지/컴포넌트 분리)

### Phase 4: 최적화 및 테스트 (우선순위: 낮음)

1. ✅ 단위 테스트 작성
2. ✅ E2E 테스트 (Playwright)
3. ✅ 성능 최적화
4. ✅ 문서화

---

## 📦 필요한 패키지

```json
{
  "dependencies": {
    // 상태 관리
    "zustand": "^4.4.0",

    // 서버 상태 관리
    "@tanstack/react-query": "^5.0.0",

    // 폼 검증
    "zod": "^3.22.0",
    "react-hook-form": "^7.48.0", // 이미 있음
    "@hookform/resolvers": "^3.3.0"
  },
  "devDependencies": {
    // 테스팅
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@playwright/test": "^1.40.0",

    // 타입 생성
    "supabase": "^1.110.0" // CLI
  }
}
```

---

## 🚀 즉시 적용 가능한 개선사항

### 1. 타입 정의 중앙화 (난이도: ⭐)

```bash
# types 폴더 생성 및 타입 이동
mkdir src/types
# App.tsx의 interface를 src/types/domain.types.ts로 이동
```

### 2. Custom Hook 추출 (난이도: ⭐⭐)

```typescript
// hooks/usePlans.ts 생성
// App.tsx의 loadPlans, createPlan 로직 이동
```

### 3. Zustand 도입 (난이도: ⭐⭐)

```bash
npm install zustand
# stores/plan.store.ts 생성
# useState를 zustand로 점진적 마이그레이션
```

### 4. 데이터베이스 마이그레이션 (난이도: ⭐⭐⭐)

```sql
-- migrations/001_create_tables.sql 작성
-- Supabase Dashboard에서 실행
```

---

## 📊 개선 효과

| 항목              | 현재            | 개선 후                 |
| ----------------- | --------------- | ----------------------- |
| **코드 복잡도**   | App.tsx 500줄   | 페이지당 100줄 이하     |
| **타입 안정성**   | `any` 남용      | 완전 타입 안전          |
| **테스트 가능성** | 낮음            | 높음 (단위 테스트 가능) |
| **성능**          | 불필요한 리렌더 | 최적화된 렌더링         |
| **확장성**        | 제한적          | 무한 확장 가능          |
| **유지보수성**    | 어려움          | 쉬움 (단일 책임)        |
| **DB 쿼리**       | KV 조회만       | JOIN, 인덱스 활용       |

---

## 💡 결론

현재 구조는 **프로토타입이나 소규모 프로젝트에는 적합**하지만, 다음 이유로 **확장성과 유지보수성이 제한적**입니다:

1. ❌ Key-Value 저장소로 관계형 데이터 관리
2. ❌ God Component 패턴
3. ❌ 타입 안정성 부족
4. ❌ 비즈니스 로직과 UI 로직 혼재

제안한 개선사항을 **단계적으로 적용**하면:

- ✅ **확장 가능한 아키텍처**
- ✅ **유지보수하기 쉬운 코드**
- ✅ **타입 안전성 보장**
- ✅ **성능 최적화**

를 달성할 수 있습니다! 🎉
