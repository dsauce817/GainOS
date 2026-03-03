-- GainOS Initial Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  age INT CHECK (age BETWEEN 13 AND 100),
  sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm DECIMAL(5,1),
  weight_kg DECIMAL(5,1),
  training_age_months INT DEFAULT 0,
  goal TEXT CHECK (goal IN ('cut', 'bulk', 'recomp', 'maintain')) DEFAULT 'maintain',
  schedule TEXT[] DEFAULT '{}',         -- ['Monday', 'Wednesday', 'Friday']
  equipment TEXT[] DEFAULT '{}',        -- ['barbell', 'dumbbell', 'bodyweight']
  unit_system TEXT CHECK (unit_system IN ('metric', 'imperial')) DEFAULT 'metric',
  push_token TEXT,
  onboarding_complete BOOL DEFAULT false,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_workout_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXERCISES
-- ============================================================
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (LOWER(name)) STORED,
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',   -- ['chest', 'triceps']
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT 'bodyweight',  -- 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other'
  category TEXT DEFAULT 'compound',              -- 'compound' | 'isolation' | 'cardio'
  force TEXT,                                    -- 'push' | 'pull' | 'static'
  mechanics TEXT,                                -- 'compound' | 'isolation'
  instructions TEXT,
  tips TEXT,
  is_custom BOOL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX idx_exercises_name_lower ON exercises(name_lower);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);

-- ============================================================
-- ROUTINES / TEMPLATES
-- ============================================================
CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  days TEXT[] DEFAULT '{}',    -- ['Monday', 'Thursday']
  color TEXT DEFAULT '#6366f1', -- hex color for UI
  icon TEXT DEFAULT 'dumbbell',
  is_active BOOL DEFAULT true,
  workout_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routine_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  target_sets INT DEFAULT 3,
  target_reps TEXT DEFAULT '8-12',   -- can be a range or single number
  target_weight_kg DECIMAL(6,2),
  target_rpe DECIMAL(3,1),
  rest_seconds INT DEFAULT 90,
  notes TEXT,
  UNIQUE(routine_id, order_index)
);

-- ============================================================
-- LOGGED WORKOUTS
-- ============================================================
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  total_volume_kg DECIMAL(10,2) DEFAULT 0,
  total_sets INT DEFAULT 0,
  notes TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),  -- user's session rating
  is_complete BOOL DEFAULT false,
  -- offline sync support
  local_id TEXT,   -- client-side UUID for offline-first
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workouts_user_completed ON workouts(user_id, completed_at DESC);
CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at DESC);

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL DEFAULT 1,
  reps INT,
  weight_kg DECIMAL(6,2) DEFAULT 0,
  rpe DECIMAL(3,1) CHECK (rpe BETWEEN 5 AND 10),
  estimated_1rm DECIMAL(6,2),   -- Epley formula: weight * (1 + reps/30)
  volume_kg DECIMAL(8,2),        -- weight_kg * reps
  is_warmup BOOL DEFAULT false,
  is_dropset BOOL DEFAULT false,
  is_pr BOOL DEFAULT false,
  pr_types TEXT[] DEFAULT '{}',  -- ['weight', 'estimated_1rm']
  rest_seconds INT,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  -- offline sync
  local_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise_user ON workout_sets(exercise_id);

-- ============================================================
-- PERSONAL RECORDS
-- ============================================================
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  workout_set_id UUID REFERENCES workout_sets(id) ON DELETE SET NULL,
  pr_type TEXT NOT NULL CHECK (pr_type IN ('weight', 'reps', 'estimated_1rm', 'volume')),
  value DECIMAL(10,2) NOT NULL,
  previous_value DECIMAL(10,2),
  improvement_pct DECIMAL(5,2),   -- percentage improvement
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOL DEFAULT true,   -- only one current=true per user+exercise+pr_type
  UNIQUE(user_id, exercise_id, pr_type, achieved_at)
);

CREATE INDEX idx_prs_user_exercise ON personal_records(user_id, exercise_id);
CREATE INDEX idx_prs_user_current ON personal_records(user_id, is_current) WHERE is_current = true;

-- ============================================================
-- ACHIEVEMENTS / TROPHIES
-- ============================================================
CREATE TABLE achievement_definitions (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,           -- lucide icon name or emoji
  color TEXT DEFAULT '#6366f1',
  category TEXT NOT NULL,       -- 'milestone' | 'streak' | 'strength' | 'volume' | 'consistency'
  xp_value INT DEFAULT 100,
  is_hidden BOOL DEFAULT false  -- secret achievements
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_slug TEXT NOT NULL REFERENCES achievement_definitions(slug),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',  -- { exercise_name, value, etc }
  notified BOOL DEFAULT false,
  UNIQUE(user_id, achievement_slug)
);

CREATE INDEX idx_achievements_user ON user_achievements(user_id, achieved_at DESC);

-- ============================================================
-- BODY CHECK-INS
-- ============================================================
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg DECIMAL(5,1),
  body_fat_pct DECIMAL(4,1),
  measurements JSONB DEFAULT '{}',  -- { chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_leg_cm, right_leg_cm }
  photo_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  mood INT CHECK (mood BETWEEN 1 AND 5),
  energy INT CHECK (energy BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_checkins_user_date ON check_ins(user_id, date DESC);

-- ============================================================
-- DAILY HEALTH LOGS (nutrition, cardio, sleep)
-- ============================================================
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INT DEFAULT 0,
  sleep_hours DECIMAL(3,1),
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 5),
  calories INT,
  protein_g DECIMAL(6,1),
  carbs_g DECIMAL(6,1),
  fats_g DECIMAL(6,1),
  water_ml INT,
  cardio_minutes INT DEFAULT 0,
  cardio_sessions INT DEFAULT 0,
  cardio_type TEXT,              -- 'running' | 'cycling' | 'rowing' | 'hiit' | 'other'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date DESC);

-- ============================================================
-- USER GOALS
-- ============================================================
CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,  -- 'daily_steps' | 'weekly_cardio_sessions' | 'daily_protein_g' | 'target_weight_kg' | 'weekly_workouts' | 'daily_calories'
  target_value DECIMAL(10,2) NOT NULL,
  current_value DECIMAL(10,2) DEFAULT 0,
  period TEXT DEFAULT 'weekly', -- 'daily' | 'weekly'
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_user_active ON user_goals(user_id, is_active) WHERE is_active = true;

-- ============================================================
-- AI COACH CONVERSATIONS
-- ============================================================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,               -- auto-generated from first message
  is_pinned BOOL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  workout_reminders BOOL DEFAULT true,
  reminder_days TEXT[] DEFAULT '{"Monday","Wednesday","Friday"}',
  reminder_time TIME DEFAULT '09:00:00',
  pr_celebrations BOOL DEFAULT true,
  weekly_goal_nudges BOOL DEFAULT true,
  checkin_reminders BOOL DEFAULT true,
  checkin_day TEXT DEFAULT 'Sunday',
  checkin_time TIME DEFAULT '10:00:00',
  streak_reminders BOOL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKOUT VOLUME CACHE (for fast analytics)
-- ============================================================
CREATE TABLE weekly_volume_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,       -- Monday of the week
  muscle_group TEXT NOT NULL,
  total_sets INT DEFAULT 0,
  total_volume_kg DECIMAL(10,2) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start, muscle_group)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_volume_cache ENABLE ROW LEVEL SECURITY;

-- PROFILE POLICIES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- EXERCISE POLICIES (public library + own custom)
CREATE POLICY "Anyone can view public exercises" ON exercises FOR SELECT USING (NOT is_custom OR created_by = auth.uid());
CREATE POLICY "Users can create custom exercises" ON exercises FOR INSERT WITH CHECK (auth.uid() = created_by AND is_custom = true);
CREATE POLICY "Users can update own custom exercises" ON exercises FOR UPDATE USING (auth.uid() = created_by);

-- ROUTINE POLICIES
CREATE POLICY "Users can manage own routines" ON routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own routine exercises" ON routine_exercises FOR ALL
  USING (routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid()));

-- WORKOUT POLICIES
CREATE POLICY "Users can manage own workouts" ON workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own workout sets" ON workout_sets FOR ALL
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- PR POLICIES
CREATE POLICY "Users can manage own PRs" ON personal_records FOR ALL USING (auth.uid() = user_id);

-- ACHIEVEMENT POLICIES
CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- OTHER USER-SCOPED POLICIES
CREATE POLICY "Users own their check-ins" ON check_ins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their daily logs" ON daily_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their goals" ON user_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their AI conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their AI messages" ON ai_messages FOR ALL
  USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users own their notification prefs" ON notification_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their volume cache" ON weekly_volume_cache FOR ALL USING (auth.uid() = user_id);

-- Achievement definitions are public read
CREATE POLICY "Achievement definitions are public" ON achievement_definitions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO notification_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER routines_updated_at BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER daily_logs_updated_at BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Compute estimated 1RM on set insert/update (Epley formula)
CREATE OR REPLACE FUNCTION compute_set_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Epley: weight * (1 + reps/30)
  IF NEW.reps IS NOT NULL AND NEW.weight_kg IS NOT NULL AND NEW.reps > 0 THEN
    NEW.estimated_1rm = ROUND((NEW.weight_kg * (1 + NEW.reps::DECIMAL / 30))::DECIMAL, 1);
  END IF;
  NEW.volume_kg = COALESCE(NEW.weight_kg, 0) * COALESCE(NEW.reps, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_set_metrics
  BEFORE INSERT OR UPDATE ON workout_sets
  FOR EACH ROW EXECUTE FUNCTION compute_set_metrics();

-- Update workout totals when sets change
CREATE OR REPLACE FUNCTION update_workout_totals()
RETURNS TRIGGER AS $$
DECLARE
  wid UUID;
BEGIN
  wid = COALESCE(NEW.workout_id, OLD.workout_id);
  UPDATE workouts
  SET
    total_volume_kg = (
      SELECT COALESCE(SUM(volume_kg), 0)
      FROM workout_sets
      WHERE workout_id = wid AND NOT is_warmup
    ),
    total_sets = (
      SELECT COUNT(*)
      FROM workout_sets
      WHERE workout_id = wid AND NOT is_warmup
    )
  WHERE id = wid;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_workout_totals
  AFTER INSERT OR UPDATE OR DELETE ON workout_sets
  FOR EACH ROW EXECUTE FUNCTION update_workout_totals();

-- Update streak when workout completed
CREATE OR REPLACE FUNCTION update_streak_on_workout()
RETURNS TRIGGER AS $$
DECLARE
  last_date DATE;
  today DATE;
BEGIN
  IF NEW.is_complete = true AND OLD.is_complete = false THEN
    today = DATE(NEW.completed_at AT TIME ZONE 'UTC');
    SELECT last_workout_date INTO last_date FROM profiles WHERE id = NEW.user_id;

    IF last_date = today - 1 THEN
      -- Consecutive day
      UPDATE profiles SET
        current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_workout_date = today
      WHERE id = NEW.user_id;
    ELSIF last_date < today - 1 OR last_date IS NULL THEN
      -- Streak broken or first workout
      UPDATE profiles SET
        current_streak = 1,
        last_workout_date = today
      WHERE id = NEW.user_id;
    END IF;
    -- Same day workout - don't increment streak
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_streak_trigger
  AFTER UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION update_streak_on_workout();
