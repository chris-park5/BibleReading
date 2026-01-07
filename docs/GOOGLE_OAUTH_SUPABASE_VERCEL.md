# Google OAuth (Supabase + Vercel) 설정 체크리스트

이 문서는 **Vercel에 배포된 웹앱**에서 **Supabase Auth + Google OAuth** 로그인이 정상 동작하도록 설정하는 체크리스트입니다.

## 1) Google Cloud Console (OAuth Client)

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

### Authorized JavaScript origins

- `https://bible-reading-flame.vercel.app`

> Preview 배포 도메인(`*-<random>.vercel.app`)으로 테스트하면 도메인이 계속 바뀌어서 문제가 재발하기 쉽습니다. 가능하면 **Production 도메인만** 사용하세요.

### Authorized redirect URIs (중요)

- `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

예:

- `https://okginpltwhwtjsqdrlfo.supabase.co/auth/v1/callback`

> Redirect URI는 **Vercel 도메인**이 아니라 **Supabase 콜백 URL**이어야 합니다.

## 2) Supabase Dashboard

Supabase Dashboard → Authentication

### Providers → Google

- Google Provider: Enabled
- Client ID / Client Secret: Google Cloud Console 값과 동일하게 입력

### URL Configuration

- **Site URL**
  - `https://bible-reading-flame.vercel.app`
- **Redirect URLs**
  - `https://bible-reading-flame.vercel.app`
  - `https://bible-reading-flame.vercel.app/`

## 3) Vercel 배포/테스트 주의사항

### 반드시 Production 도메인으로 테스트

- `https://bible-reading-flame.vercel.app` 같이 고정된 도메인으로 테스트
- Preview 도메인으로 테스트 시 Redirect allowlist가 계속 어긋날 수 있음

### PWA/서비스 워커 캐시로 인해 “배포했는데도 옛 코드”가 뜨는 경우

- 시크릿 창에서 테스트하거나,
- DevTools → Application → Service Workers → Unregister
- DevTools → Application → Storage → Clear site data

## 4) 자주 나오는 오류 패턴

### `request path is invalid` / `requestpath is unvalid`

- 거의 항상 **Redirect URLs allowlist 불일치** 또는 **redirectTo가 잘못된 값(https 없음 등)**

### 이상한 404 패턴

예:

- `GET https://<project>.supabase.co/<vercel-domain> 404`

의미:

- 정상이라면 `/auth/v1/authorize?...` 로 가야 하는데, redirectTo 등이 꼬여서 **도메인이 path처럼 붙어 요청됨**

대응:

- Google/Supabase 설정 재확인
- Production 도메인으로 테스트
- 서비스워커 캐시 제거 후 재시도
