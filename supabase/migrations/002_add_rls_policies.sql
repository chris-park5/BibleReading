-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can only read their own data
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Plans table policies
-- Users can view their own plans
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own plans
CREATE POLICY "Users can create own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own plans
CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);

-- Plan schedules table policies
-- Users can view schedules of their own plans
CREATE POLICY "Users can view own plan schedules"
  ON plan_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_schedules.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Users can insert schedules for their own plans
CREATE POLICY "Users can create own plan schedules"
  ON plan_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_schedules.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Users can update schedules of their own plans
CREATE POLICY "Users can update own plan schedules"
  ON plan_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_schedules.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Users can delete schedules of their own plans
CREATE POLICY "Users can delete own plan schedules"
  ON plan_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_schedules.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Progress table policies
-- Users can view their own progress
CREATE POLICY "Users can view own progress"
  ON progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view friends' progress
CREATE POLICY "Users can view friends progress"
  ON progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = progress.user_id
    )
  );

-- Users can insert their own progress
CREATE POLICY "Users can create own progress"
  ON progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own progress"
  ON progress FOR DELETE
  USING (auth.uid() = user_id);

-- Friendships table policies
-- Users can view their own friendships
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create their own friendships
CREATE POLICY "Users can create own friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id);

-- Notification settings table policies
-- Users can view their own notification settings
CREATE POLICY "Users can view own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notification settings
CREATE POLICY "Users can create own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification settings
CREATE POLICY "Users can update own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notification settings
CREATE POLICY "Users can delete own notification settings"
  ON notification_settings FOR DELETE
  USING (auth.uid() = user_id);
