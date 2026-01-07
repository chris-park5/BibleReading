-- ============================================
-- 0. 초기 설정 및 확장 기능
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 친구 상태 타입 정의 (pending: 요청중, accepted: 친구완료)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_status') THEN
    CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');
  END IF;
END $$;

-- ============================================
-- 1. 테이블 설계
-- ============================================

-- [Users] Supabase Auth와 동기화되는 유저 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [Preset Plans] 공용 읽기 계획 마스터
CREATE TABLE IF NOT EXISTS preset_plans (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_days INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [Preset Schedules] 공용 계획의 상세 일정
CREATE TABLE IF NOT EXISTS preset_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id VARCHAR(100) NOT NULL REFERENCES preset_plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  book VARCHAR(100) NOT NULL,
  chapters VARCHAR(50) NOT NULL
);

-- [Plans] 유저가 생성한 읽기 계획 인스턴스
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preset_id VARCHAR(100) REFERENCES preset_plans(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE, -- 트리거에 의해 자동 계산됨
  total_days INTEGER NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_plan_type CHECK (
    (is_custom = TRUE AND preset_id IS NULL) OR
    (is_custom = FALSE AND preset_id IS NOT NULL)
  )
);

-- [Plan Schedules] 커스텀 계획용 상세 일정
CREATE TABLE IF NOT EXISTS plan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  book VARCHAR(100) NOT NULL,
  chapters VARCHAR(50) NOT NULL
);

-- [Reading Progress] 개별 읽기 체크 기록
CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  reading_index INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [Friendships] 친구 관계 (정규화 트리거 적용)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_friendship_self CHECK (user_id <> friend_id)
);

-- [Notification Settings] 알림 설정
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 인덱스 설정 (성능 최적화)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_schedules_plan_id ON plan_schedules(plan_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_preset_schedules_unique ON preset_schedules(preset_id, day, book, chapters);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_schedules_unique ON plan_schedules(plan_id, day, book, chapters);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reading_progress_unique ON reading_progress(user_id, plan_id, day, reading_index);
CREATE UNIQUE INDEX IF NOT EXISTS uq_friendships_pair ON friendships(user_id, friend_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_user_plan ON notification_settings(user_id, plan_id);

-- ============================================
-- 3. 핵심 함수 (Logic)
-- ============================================

-- RLS 보안 헬퍼: 커스텀 계획 소유주 확인
CREATE OR REPLACE FUNCTION public.is_custom_plan_owner(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM plans
    WHERE id = p_plan_id
      AND user_id = auth.uid()
      AND is_custom = TRUE
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_custom_plan_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_custom_plan_owner(UUID) TO authenticated;

-- 계획 종료일 자동 계산 함수 (1번에서 복구)
CREATE OR REPLACE FUNCTION public.calculate_plan_end_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.end_date IS NULL THEN
    NEW.end_date := NEW.start_date + (NEW.total_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

-- Auth 회원가입 동기화 함수 (2번의 고도화된 username 로직 적용)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  display_name TEXT;
BEGIN
  display_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'name', ''),
    NULLIF(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  base_username := COALESCE(
    NULLIF(new.raw_user_meta_data->>'username', ''),
    regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]+', '', 'g')
  );

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := left(base_username, 100);
  IF EXISTS (SELECT 1 FROM users WHERE username = final_username) THEN
    final_username := left(final_username || '_' || substring(new.id::text, 1, 8), 100);
  END IF;

  INSERT INTO public.users (id, email, name, username)
  VALUES (new.id, new.email, display_name, final_username)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name;

  RETURN new;
END;
$$;

-- 친구 검색용: 이메일 없이 프로필만 노출
CREATE OR REPLACE FUNCTION public.search_user_profiles(p_query TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT u.id, u.username::text, u.name::text
  FROM users u
  WHERE (
    u.username ILIKE '%' || p_query || '%'
    OR u.name ILIKE '%' || p_query || '%'
  )
  ORDER BY u.username
  LIMIT 20;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_user_profiles(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_user_profiles(TEXT) TO authenticated;

-- 친구 관계 정규화 (작은 UUID를 항상 user_id로 배치하여 중복 방지)
CREATE OR REPLACE FUNCTION public.normalize_friendship_pair()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  initiator UUID;
BEGIN
  initiator := COALESCE(NEW.requested_by, auth.uid());
  IF NEW.user_id > NEW.friend_id THEN
    DECLARE
      temp_id UUID := NEW.user_id;
    BEGIN
      NEW.user_id := NEW.friend_id;
      NEW.friend_id := temp_id;
    END;
  END IF;
  NEW.requested_by := initiator;
  RETURN NEW;
END;
$$;

-- 친구 관계 무결성 강제: 쌍/요청자는 변경 불가, 상태는 pending->accepted만 허용
CREATE OR REPLACE FUNCTION public.enforce_friendship_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.user_id <> OLD.user_id) OR (NEW.friend_id <> OLD.friend_id) OR (NEW.requested_by <> OLD.requested_by) THEN
    RAISE EXCEPTION 'friendship pair/requested_by cannot be changed';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status <> 'accepted' THEN
    RAISE EXCEPTION 'accepted friendship cannot be reverted';
  END IF;

  IF OLD.status = 'pending' AND NEW.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'invalid friendship status';
  END IF;

  RETURN NEW;
END;
$$;

-- 공용 타임스탬프 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

-- ============================================
-- 4. 트리거 연결
-- ============================================

-- Auth 계정 생성/삭제 동기화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- 종료일 계산
DROP TRIGGER IF EXISTS tr_calculate_plan_end_date ON plans;
CREATE TRIGGER tr_calculate_plan_end_date
BEFORE INSERT ON plans
FOR EACH ROW
EXECUTE FUNCTION public.calculate_plan_end_date();

-- 친구 관계 정규화
DROP TRIGGER IF EXISTS tr_normalize_friendships ON friendships;
CREATE TRIGGER tr_normalize_friendships
BEFORE INSERT OR UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION public.normalize_friendship_pair();

DROP TRIGGER IF EXISTS tr_enforce_friendship_update ON friendships;
CREATE TRIGGER tr_enforce_friendship_update
BEFORE UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_friendship_update();

-- 업데이트 시각 자동 갱신
DROP TRIGGER IF EXISTS tr_update_users_at ON users;
CREATE TRIGGER tr_update_users_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_update_plans_at ON plans;
CREATE TRIGGER tr_update_plans_at
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_update_friendships_at ON friendships;
CREATE TRIGGER tr_update_friendships_at
BEFORE UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. RLS 정책 (보안)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 유저 정책
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- 계획 정책
DROP POLICY IF EXISTS "Users can manage own plans" ON plans;
CREATE POLICY "Users can manage own plans" ON plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 커스텀 plan_schedules 정책 (owner만)
DROP POLICY IF EXISTS "Users can view own plan schedules" ON plan_schedules;
DROP POLICY IF EXISTS "Users can create own plan schedules" ON plan_schedules;
DROP POLICY IF EXISTS "Users can delete own plan schedules" ON plan_schedules;
CREATE POLICY "Users can view own plan schedules" ON plan_schedules
  FOR SELECT USING (public.is_custom_plan_owner(plan_schedules.plan_id));
CREATE POLICY "Users can create own plan schedules" ON plan_schedules
  FOR INSERT WITH CHECK (public.is_custom_plan_owner(plan_id));
CREATE POLICY "Users can delete own plan schedules" ON plan_schedules
  FOR DELETE USING (public.is_custom_plan_owner(plan_schedules.plan_id));

-- 친구 정책
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can send requests" ON friendships;
DROP POLICY IF EXISTS "Users can respond to requests" ON friendships;
DROP POLICY IF EXISTS "Users can delete friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can send requests" ON friendships
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by
    AND status = 'pending'
    AND (auth.uid() = user_id OR auth.uid() = friend_id)
  );
CREATE POLICY "Users can respond to requests" ON friendships
  FOR UPDATE
  USING (
    (auth.uid() = user_id OR auth.uid() = friend_id)
    AND auth.uid() <> requested_by
  )
  WITH CHECK (
    (auth.uid() = user_id OR auth.uid() = friend_id)
    AND auth.uid() <> requested_by
  );
CREATE POLICY "Users can delete friendships" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 읽기 기록 정책
DROP POLICY IF EXISTS "Users can manage own progress" ON reading_progress;
CREATE POLICY "Users can manage own progress" ON reading_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 알림 설정 정책 (본인 것만)
DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 프리셋 정책 (모든 인증된 사용자 읽기 가능)
CREATE POLICY "Anyone can view preset plans" ON preset_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can view preset schedules" ON preset_schedules FOR SELECT USING (true);

-- ============================================
-- 6. 초기 데이터 (Seed)
-- ============================================
INSERT INTO preset_plans (id, name, description, total_days) VALUES
  ('one-year', '1년 1독 계획', '365일 동안 성경 전체를 읽는 계획', 365),
  ('ninety-day', '90일 계획', '90일 동안 성경 전체를 읽는 계획', 90),
  ('new-testament', '신약 통독', '신약 성경 전체를 읽는 계획', 260),
  ('psalms-proverbs', '시편과 잠언', '시편과 잠언을 집중적으로 읽는 계획', 150),
  ('one-year-psalm-ot-nt', '성경 1년 1독 계획', '시편, 구약, 신약을 병행하여 읽는 365일 계획표', 365)
ON CONFLICT (id) DO NOTHING;