-- 1. Enable extensions (이미 되어 있다면 무시됨)
create extension if not exists pg_cron with schema "extensions";
create extension if not exists pg_net with schema "extensions";

-- 2. Grant permissions
grant usage on schema cron to postgres;
grant usage on schema net to postgres;

-- 3. Create the function (이 부분은 에러 없이 덮어씌워집니다)
create or replace function public.send_scheduled_notifications()
returns text
language plpgsql
security definer
set search_path to public, extensions, vault, net
as $$
declare
  project_url text := 'https://okginpltwhwtjsqdrlfo.supabase.co';
  function_url text := project_url || '/functions/v1/make-server-7fb946f4/cron/send-notifications';
  cron_secret text;
  response_id bigint;
begin
  -- Vault에서 시크릿 가져오기
  select decrypted_secret into cron_secret 
  from vault.decrypted_secrets 
  where name = 'CRON_SECRET';

  if cron_secret is null then
    raise exception 'CRON_SECRET not found in vault.secrets';
  end if;

  -- Edge Function 호출
  select
    net.http_post(
        url := function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', cron_secret
        ),
        body := jsonb_build_object('triggered_at', now())
    )
  into response_id;

  return 'Notification request sent, request ID: ' || response_id;
end;
$$;

-- 4. Grant execute permissions
grant execute on function public.send_scheduled_notifications to postgres;

-- 5. Schedule the cron job (매 분 실행)
-- 안전한 재등록 방법: 기존 작업이 있으면 삭제하고 새로 만듭니다.
do $$
begin
    -- 기존에 'send-notifications'라는 작업이 있는지 확인 후 있으면 삭제
    if exists (select 1 from cron.job where jobname = 'send-notifications') then
        perform cron.unschedule('send-notifications');
    end if;
end $$;

-- 이제 안전하게 등록합니다.
select cron.schedule(
  'send-notifications',
  '* * * * *',
  'select public.send_scheduled_notifications()'
);