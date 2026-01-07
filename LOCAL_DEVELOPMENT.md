# 로컬 Docker 개발 환경 설정 가이드

## 문제 해결

### 인증 문제 수정 사항

1. **공개 엔드포인트 처리**

   - `signup`, `get-username-email`은 인증이 필요 없는 공개 엔드포인트
   - Anon Key만으로 접근 가능하도록 수정

2. **로컬 환경 URL 설정**

   - Supabase 로컬: `http://127.0.0.1:54321`
   - Functions: `http://127.0.0.1:54321/functions/v1/make-server-7fb946f4`
   - 로컬 Anon Key: Supabase 로컬 개발 환경 기본값 사용

3. **CORS 설정 개선**
   - 로컬 개발 서버(`localhost:5173`) 명시적 허용
   - `credentials: true` 추가

## 로컬 환경 실행 방법

### 1. Supabase 로컬 시작

```powershell
# Docker가 실행 중인지 확인
docker --version

# Supabase 로컬 시작
npx supabase start
```

실행 후 다음 정보가 출력됩니다:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 데이터베이스 스키마 적용

```powershell
# 마이그레이션 적용
npx supabase db reset

# 또는
npx supabase db push
```

### 3. Edge Functions 배포 (로컬)

```powershell
# Functions를 로컬 환경에 배포
npx supabase functions serve make-server-7fb946f4
```

또는 별도 터미널에서:

```powershell
npx supabase functions serve
```

### 4. 프론트엔드 실행

```powershell
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 구글 회원가입/로그인(OAuth) 설정

이 프로젝트는 프론트에서 `supabase.auth.signInWithOAuth({ provider: 'google' })`를 사용합니다.
따라서 **Google Cloud Console 설정**과 **Supabase Dashboard 설정**을 둘 다 해줘야 합니다.

### 1) Google Cloud Console

1. Google Cloud Console에서 OAuth 클라이언트를 생성합니다.
2. **승인된 리디렉션 URI(Authorized redirect URIs)**에 아래를 추가합니다.

   - 프로덕션 Supabase: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   - 로컬 Supabase(로컬에서 OAuth까지 테스트할 때만): `http://127.0.0.1:54321/auth/v1/callback`

> 여기서 `<PROJECT_REF>`는 Supabase 프로젝트 ref 입니다. 현재 워크스페이스는 `supabase/.temp/project-ref`에 저장되어 있습니다.

### 2) Supabase Dashboard

1. Authentication → Providers에서 Google을 Enable 합니다.
2. Google Cloud Console에서 발급받은 **Client ID / Client Secret**을 입력합니다.
3. Authentication → URL Configuration에서 다음을 확인/추가합니다.

   - **Site URL**: 로컬 개발은 보통 `http://localhost:5173`
   - **Additional Redirect URLs**: 로컬/배포 URL들을 추가

이 프로젝트는 현재 `redirectTo: window.location.origin`을 사용하므로,
로컬은 `http://localhost:5173`(또는 `http://127.0.0.1:5173`)를 Redirect URL 목록에 포함해야 합니다.

### 3) 동작 방식 참고

- Google로 로그인 버튼은 **가입/로그인을 동일한 흐름**으로 처리합니다.
  - Supabase Auth에서 신규면 자동으로 회원이 생성됩니다.
  - `public.users`는 DB 트리거(`handle_new_auth_user`)로 자동 생성됩니다.
- 앱 시작 시 세션을 확인해 자동 로그인 상태를 복구합니다.

## 환경 자동 감지

프론트엔드 코드가 자동으로 로컬/프로덕션 환경을 감지합니다:

```typescript
// src/app/utils/api.ts
const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// 로컬: http://127.0.0.1:54321
// 프로덕션: https://[project-id].supabase.co
```

## 트러블슈팅

### 1. "Unauthorized" 에러 (signup 시)

**원인**:

- Anon Key가 설정되지 않았거나 잘못됨
- 공개 엔드포인트에서 인증 요구

**해결**:

```typescript
// api.ts에서 자동으로 처리됨
// 로컬 환경 감지 → 로컬 Anon Key 사용
// 공개 엔드포인트 → useAuth = false
```

### 2. CORS 에러

**원인**: 로컬 개발 서버 URL이 허용되지 않음

**해결**: 이미 수정됨

```typescript
// index.ts
cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "*"],
  credentials: true,
});
```

### 3. 함수가 실행되지 않음

**확인 사항**:

```powershell
# Functions 로그 확인
npx supabase functions serve --debug

# Docker 컨테이너 상태 확인
docker ps

# Supabase 상태 확인
npx supabase status
```

### 4. 데이터베이스 연결 실패

```powershell
# Supabase 재시작
npx supabase stop
npx supabase start

# 또는
npx supabase db reset
```

## 주요 엔드포인트

### 공개 엔드포인트 (인증 불필요)

- `POST /make-server-7fb946f4/signup`
- `POST /make-server-7fb946f4/get-username-email`
- `GET /make-server-7fb946f4/health`

### 보호된 엔드포인트 (인증 필요)

- `POST /make-server-7fb946f4/plans`
- `GET /make-server-7fb946f4/plans`
- `DELETE /make-server-7fb946f4/plans/:planId`
- `PATCH /make-server-7fb946f4/plans/order`
- `POST /make-server-7fb946f4/progress`
- `GET /make-server-7fb946f4/progress`
- `POST /make-server-7fb946f4/friends`
- `GET /make-server-7fb946f4/friends`
- `DELETE /make-server-7fb946f4/account`

## 테스트 방법

### 1. Signup 테스트

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/make-server-7fb946f4/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "username": "testuser"
  }'
```

### 2. Health Check

```bash
curl http://127.0.0.1:54321/functions/v1/make-server-7fb946f4/health
```

## 로컬 Supabase Studio

데이터베이스를 GUI로 관리:

```
http://127.0.0.1:54323
```

- 테이블 조회/수정
- SQL 쿼리 실행
- 사용자 관리
- 스토리지 관리

## 프로덕션 배포 전 확인

1. **환경 변수 확인**

   ```powershell
   # .env 파일이 없어야 함 (utils/supabase/info.tsx 사용)
   ```

2. **Functions 배포**

   ```powershell
   npx supabase functions deploy make-server-7fb946f4
   ```

3. **마이그레이션 적용**
   ```powershell
   npx supabase db push
   ```

## 참고 사항

- 로컬 환경은 메일 발송이 불가능 (Inbucket 사용)
- 로컬 Anon Key는 공개되어도 안전 (로컬 전용)
- 프로덕션 배포 시 자동으로 프로덕션 URL/Key 사용
