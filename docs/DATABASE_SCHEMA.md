# 🗄️ 데이터베이스 구조 (Database Schema)

## 📊 개요

Bible Reading Plan App의 PostgreSQL 데이터베이스 스키마는 Supabase에서 호스팅되며, Row Level Security (RLS)를 통해 데이터 보안이 구현되어 있습니다.

**마이그레이션 파일**:
- `001_initial_schema.sql` - 초기 테이블 스키마
- `002_add_rls_policies.sql` - RLS 보안 정책

---

## 📋 테이블 구조

### 1. **`users`** - 사용자 정보

사용자 계정 정보를 저장하는 테이블입니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 사용자 고유 ID |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | 사용자 이메일 |
| `name` | VARCHAR(255) | NOT NULL | 사용자 이름 |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성일시 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 수정일시 |

**RLS 정책**:
- ✅ 사용자는 자신의 프로필만 조회 가능
- ✅ 사용자는 자신의 프로필만 수정 가능

---

### 2. **`plans`** - 읽기 계획

사용자가 생성한 성경 읽기 계획을 저장합니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 계획 고유 ID |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | 계획 소유자 ID |
| `name` | VARCHAR(255) | NOT NULL | 계획 이름 |
| `start_date` | DATE | NOT NULL | 시작 날짜 |
| `end_date` | DATE | - | 종료 날짜 (선택) |
| `total_days` | INTEGER | NOT NULL | 총 일수 |
| `is_custom` | BOOLEAN | DEFAULT FALSE | 사용자 지정 계획 여부 |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성일시 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 수정일시 |

**인덱스**:
- `idx_plans_user_id` - user_id 기준 조회 최적화
- `idx_plans_created_at` - 생성일시 정렬 최적화

**RLS 정책**:
- ✅ 사용자는 자신의 계획만 조회/생성/수정/삭제 가능

---

### 3. **`plan_schedules`** - 계획 일정

각 계획의 일별 읽기 일정(성경 구절)을 저장합니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 일정 고유 ID |
| `plan_id` | UUID | NOT NULL, REFERENCES plans(id) ON DELETE CASCADE | 계획 ID |
| `day` | INTEGER | NOT NULL | 날짜 (1일차, 2일차...) |
| `book` | VARCHAR(100) | NOT NULL | 성경 책 이름 |
| `chapters` | VARCHAR(50) | NOT NULL | 읽을 장 (예: "1-3장") |

**인덱스**:
- `idx_plan_schedules_plan_id` - plan_id 기준 조회 최적화
- `idx_plan_schedules_day` - day 기준 조회 최적화
- `uq_plan_schedules_unique` - (plan_id, day, book) 조합 중복 방지

**RLS 정책**:
- ✅ 사용자는 자신의 계획에 속한 일정만 조회/생성/수정/삭제 가능

**참고**: 프론트엔드의 `Plan.schedule` 배열 구조는 이 테이블의 정규화된 형태입니다.
- 프론트: `schedule: [{ day: 1, readings: [{ book, chapters }] }]`
- DB: 각 reading이 별도 행으로 저장

---

### 4. **`progress`** - 진도 기록

사용자의 읽기 진도(완료한 날짜)를 저장합니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 진도 고유 ID |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | 사용자 ID |
| `plan_id` | UUID | NOT NULL, REFERENCES plans(id) ON DELETE CASCADE | 계획 ID |
| `day` | INTEGER | NOT NULL | 완료한 날짜 |
| `completed_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 완료 일시 |

**인덱스**:
- `uq_progress_user_plan_day` - (user_id, plan_id, day) 조합 중복 방지 (UNIQUE)
- `idx_progress_user_plan` - (user_id, plan_id) 조회 최적화
- `idx_progress_completed_at` - 완료일시 정렬 최적화

**RLS 정책**:
- ✅ 사용자는 자신의 진도 조회/생성/수정/삭제 가능
- ✅ 사용자는 친구의 진도 조회 가능 (friendships 테이블 확인)

**참고**: 
- 프론트엔드의 `Progress.completedDays: number[]`는 이 테이블의 day 값들을 배열로 모은 것입니다.
- `completedReadingsByDay` (항목별 체크)는 아직 DB 스키마에 반영되지 않았으며, 현재는 애플리케이션 레벨에서만 관리됩니다.

---

### 5. **`friendships`** - 친구 관계

사용자 간 친구 관계를 저장합니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 관계 고유 ID |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | 사용자 ID |
| `friend_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | 친구 ID |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 친구 추가 일시 |

**제약조건**:
- `chk_friendship_self` - 자기 자신을 친구로 추가할 수 없음

**인덱스**:
- `uq_friendships_pair` - (user_id, friend_id) 중복 방지 (UNIQUE)
- `idx_friendships_user_id` - user_id 조회 최적화
- `idx_friendships_friend_id` - friend_id 조회 최적화

**RLS 정책**:
- ✅ 사용자는 자신이 포함된 친구 관계 조회 가능
- ✅ 사용자는 자신이 시작한 친구 관계만 생성/삭제 가능

**참고**: 양방향 친구 관계를 위해서는 두 개의 행이 필요합니다.
- A → B: (user_id: A, friend_id: B)
- B → A: (user_id: B, friend_id: A)

---

### 6. **`notification_settings`** - 알림 설정

계획별 읽기 알림 설정을 저장합니다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 설정 고유 ID |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | 사용자 ID |
| `plan_id` | UUID | NOT NULL, REFERENCES plans(id) ON DELETE CASCADE | 계획 ID |
| `time` | TIME | NOT NULL | 알림 시간 |
| `enabled` | BOOLEAN | DEFAULT TRUE | 알림 활성화 여부 |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | 생성일시 |

**인덱스**:
- `uq_notification_user_plan` - (user_id, plan_id) 중복 방지 (UNIQUE)

**RLS 정책**:
- ✅ 사용자는 자신의 알림 설정만 조회/생성/수정/삭제 가능

---

## 🔗 테이블 관계 (ERD)

```
users (1) ─────┬─────────> (*) plans
               │            │
               │            └──────> (*) plan_schedules
               │            │
               │            └──────> (*) notification_settings
               │
               ├─────────> (*) progress
               │
               └─────────> (*) friendships (as user_id)
                           (*) friendships (as friend_id)
```

### 관계 설명

1. **users → plans** (1:N)
   - 한 사용자는 여러 계획을 가질 수 있음
   - `ON DELETE CASCADE`: 사용자 삭제 시 모든 계획 삭제

2. **plans → plan_schedules** (1:N)
   - 한 계획은 여러 일정을 가질 수 있음
   - `ON DELETE CASCADE`: 계획 삭제 시 모든 일정 삭제

3. **users + plans → progress** (N:M)
   - 한 사용자는 여러 계획의 진도를 가질 수 있음
   - 한 계획은 여러 사용자의 진도 기록을 가질 수 있음
   - `ON DELETE CASCADE`: 사용자/계획 삭제 시 진도 삭제

4. **users → friendships** (N:M 자기참조)
   - 사용자 간 친구 관계 (양방향)
   - `ON DELETE CASCADE`: 사용자 삭제 시 관련 친구 관계 삭제

5. **users + plans → notification_settings** (1:1)
   - 사용자-계획 조합당 하나의 알림 설정
   - `ON DELETE CASCADE`: 사용자/계획 삭제 시 알림 설정 삭제

---

## 🔐 Row Level Security (RLS)

모든 테이블에 RLS가 활성화되어 있으며, Supabase Auth의 `auth.uid()`를 사용하여 사용자 본인만 자신의 데이터에 접근할 수 있도록 보장합니다.

### 핵심 보안 규칙

| 테이블 | 조회(SELECT) | 생성(INSERT) | 수정(UPDATE) | 삭제(DELETE) |
|--------|-------------|-------------|-------------|-------------|
| **users** | 본인만 | - | 본인만 | - |
| **plans** | 본인만 | 본인만 | 본인만 | 본인만 |
| **plan_schedules** | 본인 계획만 | 본인 계획만 | 본인 계획만 | 본인 계획만 |
| **progress** | 본인 + 친구 | 본인만 | 본인만 | 본인만 |
| **friendships** | 본인 관련 | 본인만 | - | 본인만 |
| **notification_settings** | 본인만 | 본인만 | 본인만 | 본인만 |

**특별 정책**:
- `progress` 테이블은 친구의 진도도 조회 가능 (소셜 기능)
- `friendships` 테이블은 양쪽 모두 조회 가능하지만 생성/삭제는 요청자만

---

## 📊 인덱스 전략

### 성능 최적화를 위한 인덱스

1. **Foreign Key 인덱스**
   - `idx_plans_user_id` - 사용자별 계획 조회
   - `idx_plan_schedules_plan_id` - 계획별 일정 조회
   - `idx_progress_user_plan` - 사용자+계획별 진도 조회
   - `idx_friendships_user_id` / `idx_friendships_friend_id` - 친구 관계 조회

2. **검색 최적화 인덱스**
   - `idx_plan_schedules_day` - 날짜별 일정 조회
   - `idx_plans_created_at` - 최신 계획 정렬
   - `idx_progress_completed_at` - 최근 완료 기록 정렬

3. **유니크 제약 인덱스**
   - `uq_progress_user_plan_day` - 중복 진도 방지
   - `uq_plan_schedules_unique` - 중복 일정 방지
   - `uq_friendships_pair` - 중복 친구 관계 방지
   - `uq_notification_user_plan` - 중복 알림 설정 방지

---

## 🚨 현재 스키마와 애플리케이션 코드 간 차이점

### ⚠️ 항목별 체크 기능 (`completedReadingsByDay`)

**현재 상태**:
- ✅ **프론트엔드**: `Progress.completedReadingsByDay?: Record<string, number[]>` 구현됨
- ✅ **Mock API**: localStorage에 저장/조회 구현됨
- ✅ **Edge Functions**: `/progress` 엔드포인트에서 처리 구현됨
- ❌ **데이터베이스**: 아직 스키마에 반영 안 됨

**해결 방법**:
1. `progress` 테이블에 JSON 컬럼 추가
2. 별도 `reading_progress` 테이블 생성 (정규화)

### 옵션 1: JSON 컬럼 추가 (간단)
```sql
ALTER TABLE progress
ADD COLUMN completed_readings_by_day JSONB DEFAULT '{}'::jsonb;

-- 인덱스 추가 (선택)
CREATE INDEX idx_progress_readings ON progress USING gin(completed_readings_by_day);
```

### 옵션 2: 별도 테이블 (정규화)
```sql
CREATE TABLE reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  reading_index INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, plan_id, day, reading_index)
);
```

---

## 🔄 마이그레이션 파일

### `001_initial_schema.sql`
- 기본 테이블 구조 정의
- 인덱스 생성
- 외래키 제약조건 설정

### `002_add_rls_policies.sql`
- RLS 활성화
- 모든 테이블에 대한 보안 정책 정의
- `auth.uid()` 기반 접근 제어

---

## 📝 데이터 타입 매핑 (TypeScript ↔ PostgreSQL)

| TypeScript | PostgreSQL | 설명 |
|------------|-----------|------|
| `string` | `UUID` | 고유 식별자 |
| `string` | `VARCHAR` | 문자열 |
| `number` | `INTEGER` | 정수 |
| `boolean` | `BOOLEAN` | 참/거짓 |
| `string` | `DATE` | 날짜 (YYYY-MM-DD) |
| `string` | `TIME` | 시간 (HH:MM:SS) |
| `string` | `TIMESTAMP WITH TIME ZONE` | 날짜+시간 (ISO 8601) |
| `Record<string, number[]>` | `JSONB` | JSON 객체 (제안) |

---

## 🎯 다음 단계 제안

### 1. 항목별 체크 데이터 영속화
- 현재는 프론트엔드/Mock에만 구현됨
- DB 스키마 업데이트 필요 (위 옵션 중 선택)

### 2. 마이그레이션 파일 추가
```sql
-- 003_add_reading_progress.sql
-- 항목별 체크 기능을 위한 스키마 추가
```

### 3. Edge Functions 업데이트
- 새 스키마에 맞춰 저장/조회 로직 수정

### 4. 성능 모니터링
- 쿼리 성능 측정
- 필요시 추가 인덱스 생성

---

## 🔧 개발/운영 팁

### 로컬 개발
```bash
# Supabase CLI로 마이그레이션 적용
supabase migration up

# 마이그레이션 롤백
supabase migration down
```

### 프로덕션 배포
```bash
# Supabase 대시보드에서 마이그레이션 실행
# 또는 CLI로 원격 적용
supabase db push
```

### 데이터 백업
```bash
# 데이터 덤프
pg_dump -h <host> -U <user> <database> > backup.sql

# 데이터 복원
psql -h <host> -U <user> <database> < backup.sql
```

---

이 스키마는 사용자 데이터를 안전하게 격리하고, 친구 간 진도 공유를 허용하며, 확장 가능한 구조를 제공합니다! 🎉
