# Push Notifications (앱 종료 후에도 알림) 셋업 가이드

이 프로젝트의 “앱이 실행 중이 아니어도 알림”은 **Web Push + Service Worker** 기반입니다.

구성 요소는 다음 3가지가 모두 필요합니다.

1. DB: `push_subscriptions` 테이블 + `notification_settings.last_sent_at`
2. 서버: Edge Function에서 Web Push 전송 (VAPID 필요)
3. 스케줄러: 하루 1회(또는 원하는 주기) 서버의 cron 엔드포인트 호출

> 참고: Web Push는 브라우저/OS 제약이 있습니다. 특히 iOS는 버전/설치 형태(PWA 설치 여부)에 따라 동작이 달라질 수 있습니다.

---

## 1) VAPID 키 생성

Windows 기준 가장 쉬운 방법은 `web-push` CLI를 `npx`로 실행하는 것입니다.

```bash
npx --yes web-push generate-vapid-keys
```

출력되는 `Public Key`, `Private Key`를 각각 저장하세요.

- `VITE_VAPID_PUBLIC_KEY` (프론트)
- `VAPID_PUBLIC_KEY` (서버)
- `VAPID_PRIVATE_KEY` (서버)

`VAPID_SUBJECT`는 보통 `mailto:you@example.com` 형식을 권장합니다.

---

## 2) 프론트엔드 환경변수 설정

로컬 개발에서 `.env`(또는 `.env.local`)에 아래를 설정합니다.

- `VITE_VAPID_PUBLIC_KEY=<Public Key>`

예시는 [.env.example](../.env.example)를 참고하세요.

> 배포 환경(Vercel 등)에서도 동일하게 `VITE_VAPID_PUBLIC_KEY`가 필요합니다.

---

## 3) Supabase DB 마이그레이션 적용

리포지토리에 마이그레이션 파일이 추가돼 있습니다.

- `supabase/migrations/004_push_notifications.sql`

Supabase CLI를 사용한다면(프로젝트에 devDependency로 포함):

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

> 팀/환경에 따라 `db push` 대신 `migration up`을 쓰는 워크플로우일 수 있습니다. 핵심은 원격 DB에 `004_push_notifications.sql`이 반영되는 것입니다.

---

## 4) Edge Function 시크릿(환경변수) 설정

서버(Edge Function)에서 필요한 값들입니다. **프론트의 `VITE_`와 다릅니다.**

필수:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

CLI로 설정(권장):

```bash
npx supabase secrets set --project-ref <project-ref> \
  VAPID_PUBLIC_KEY="<Public Key>" \
  VAPID_PRIVATE_KEY="<Private Key>" \
  VAPID_SUBJECT="mailto:you@example.com" \
  CRON_SECRET="<long-random-secret>"
```

또는 Supabase Dashboard → Edge Functions → Secrets에서 동일 값을 설정해도 됩니다.

---

## 5) Edge Function 배포

프로젝트에 스크립트가 준비돼 있습니다.

```bash
npm run deploy:functions
```

배포 후 Functions base URL은 보통 아래 형태입니다.

- `https://<project-ref>.supabase.co/functions/v1/make-server-7fb946f4`

---

## 6) 스케줄러(크론) 설정

앱이 꺼져 있어도 알림이 오려면, 서버가 주기적으로 “오늘 알림 보내기”를 실행해야 합니다.

서버 엔드포인트:

- `POST /cron/send-notifications`
- 헤더: `x-cron-secret: <CRON_SECRET>`

예시(curl):

```bash
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/make-server-7fb946f4/cron/send-notifications" \
  -H "x-cron-secret: <CRON_SECRET>"
```

### GitHub Actions 예시

GitHub Actions로 1분마다 호출하려면, 아래 형태의 워크플로우를 사용할 수 있습니다.

- GitHub Repo Secrets에 다음을 추가:
  - `CRON_URL`: 위 curl URL
  - `CRON_SECRET`: 위 헤더 값

예시 워크플로우는 `.github/workflows/push-cron.yml`로 추가해둘 수 있습니다.

---

## 7) 동작 확인 체크리스트

1. 배포 환경이 HTTPS인지 확인
2. 설정 탭에서 알림 활성화 → 구독 저장이 성공하는지 확인
3. “테스트 알림” 버튼으로 서버 푸시가 도착하는지 확인
4. 앱을 완전히 닫은 뒤에도 푸시가 오는지 확인

> iOS는 특히 “홈 화면에 추가된 PWA” 여부, iOS 버전에 따라 차이가 큽니다.
