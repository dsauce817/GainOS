// GainOS Database Types
// Generated from Supabase schema — keep in sync with migrations

export type Goal = "cut" | "bulk" | "recomp" | "maintain";
export type Sex = "male" | "female" | "other" | "prefer_not_to_say";
export type UnitSystem = "metric" | "imperial";
export type PRType = "weight" | "reps" | "estimated_1rm" | "volume";
export type AchievementCategory = "milestone" | "streak" | "strength" | "volume" | "consistency";
export type MessageRole = "user" | "assistant" | "system";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_age_months: number;
  goal: Goal;
  schedule: string[];
  equipment: string[];
  unit_system: UnitSystem;
  push_token: string | null;
  onboarding_complete: boolean;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_groups: string[];
  secondary_muscles: string[];
  equipment: string;
  category: string;
  force: string | null;
  instructions: string | null;
  tips: string | null;
  is_custom: boolean;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  days: string[];
  color: string;
  icon: string;
  is_active: boolean;
  workout_count: number;
  created_at: string;
  updated_at: string;
  routine_exercises?: RoutineExercise[];
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: string;
  target_weight_kg: number | null;
  target_rpe: number | null;
  rest_seconds: number;
  notes: string | null;
  exercises?: Exercise;
}

export interface Workout {
  id: string;
  user_id: string;
  routine_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_volume_kg: number;
  total_sets: number;
  notes: string | null;
  rating: number | null;
  is_complete: boolean;
  local_id: string | null;
  synced_at: string | null;
  created_at: string;
  workout_sets?: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number;
  rpe: number | null;
  estimated_1rm: number | null;
  volume_kg: number | null;
  is_warmup: boolean;
  is_dropset: boolean;
  is_pr: boolean;
  pr_types: PRType[];
  rest_seconds: number | null;
  notes: string | null;
  completed_at: string;
  local_id: string | null;
  created_at: string;
  exercises?: Exercise;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  workout_id: string | null;
  workout_set_id: string | null;
  pr_type: PRType;
  value: number;
  previous_value: number | null;
  improvement_pct: number | null;
  achieved_at: string;
  is_current: boolean;
  exercises?: Exercise;
}

export interface AchievementDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: AchievementCategory;
  xp_value: number;
  is_hidden: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_slug: string;
  achieved_at: string;
  metadata: Record<string, unknown>;
  notified: boolean;
  achievement_definitions?: AchievementDefinition;
}

export interface CheckIn {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  measurements: {
    chest_cm?: number;
    waist_cm?: number;
    hips_cm?: number;
    left_arm_cm?: number;
    right_arm_cm?: number;
    left_leg_cm?: number;
    right_leg_cm?: number;
  };
  photo_urls: string[];
  notes: string | null;
  mood: number | null;
  energy: number | null;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  steps: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fats_g: number | null;
  water_ml: number | null;
  cardio_minutes: number;
  cardio_sessions: number;
  cardio_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  period: "daily" | "weekly";
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  ai_messages?: AIMessage[];
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tokens_used: number | null;
  created_at: string;
}

export interface WeeklyVolumeCache {
  id: string;
  user_id: string;
  week_start: string;
  muscle_group: string;
  total_sets: number;
  total_volume_kg: number;
  computed_at: string;
}

// Celebration data from complete-workout edge function
export interface WorkoutCelebration {
  prs: PRResult[];
  newAchievements: AchievementUnlock[];
  hasCelebration: boolean;
  workout: {
    id: string;
    totalVolume: number;
    totalSets: number;
    duration: number | null;
  };
}

export interface PRResult {
  exerciseId: string;
  exerciseName: string;
  prType: PRType;
  newValue: number;
  previousValue: number | null;
  improvementPct: number | null;
  setId: string;
}

export interface AchievementUnlock {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xpValue: number;
}

// Active workout state (used in workout logging flow)
export interface ActiveWorkout {
  id: string;
  name: string;
  routineId: string | null;
  startedAt: Date;
  exercises: ActiveExercise[];
}

export interface ActiveExercise {
  exerciseId: string;
  exercise: Exercise;
  sets: ActiveSet[];
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes: string | null;
}

export interface ActiveSet {
  localId: string;
  setNumber: number;
  weight: string;        // string for input handling
  reps: string;          // string for input handling
  rpe: string | null;
  isWarmup: boolean;
  isComplete: boolean;
  completedAt: Date | null;
}
