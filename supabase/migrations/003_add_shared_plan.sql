-- Add per-user shared plan setting
-- Friends can view progress only for the plan the user explicitly shares.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS shared_plan_id UUID NULL REFERENCES public.plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_shared_plan_id ON public.users(shared_plan_id);
