-- ============================================
-- Social 기능 확장을 위한 Users 테이블 RLS 정책 변경
-- ============================================

-- 설명:
-- 기존의 "내 프로필은 나만 볼 수 있다"는 정책은 친구 목록, 리더보드, 사용자 검색 등
-- 타인의 정보를 조회해야 하는 소셜 기능 구현을 불가능하게 만듭니다.
-- 따라서 인증된(로그인한) 모든 사용자가 users 테이블을 조회(SELECT)할 수 있도록 정책을 완화합니다.
-- 주의: 이 정책을 적용하면 로그인한 사용자는 다른 사용자의 이메일, 이름을 조회할 수 있게 됩니다.

-- 1. 기존의 엄격한 조회 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- 2. 새로운 "모든 인증된 사용자는 프로필 조회 가능" 정책 생성
-- auth.role() = 'authenticated' 조건은 '로그인한 사용자'를 의미합니다.
CREATE POLICY "Authenticated users can view all profiles" ON public.users
FOR SELECT
USING (auth.role() = 'authenticated');

-- 참고: 쓰기(UPDATE) 권한은 여전히 본인에게만 있어야 하므로
-- "Users can update own profile" 정책(기존 000_unified_schema.sql에 정의됨)은 그대로 유지되거나
-- 필요 시 아래와 같이 명시적으로 본인만 수정 가능하도록 해야 합니다.
-- (이미 000번 파일에 있다면 생략 가능하지만 안전을 위해 확인 차원)

-- DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
-- CREATE POLICY "Users can update own profile" ON public.users
-- FOR UPDATE
-- USING (auth.uid() = id);
