// GainOS Edge Function: complete-workout
// Runs when a workout is marked complete:
// 1. Detects PRs across all sets
// 2. Unlocks achievements
// 3. Updates weekly volume cache
// 4. Returns celebration data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PRResult {
  exerciseId: string;
  exerciseName: string;
  prType: "weight" | "reps" | "estimated_1rm" | "volume";
  newValue: number;
  previousValue: number | null;
  improvementPct: number | null;
  setId: string;
}

interface AchievementUnlock {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xpValue: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { workoutId } = await req.json();

    // Fetch workout + all sets
    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .select(`
        *,
        workout_sets (
          *,
          exercises (id, name, muscle_groups)
        )
      `)
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .single();

    if (workoutError || !workout) throw new Error("Workout not found");

    const sets = workout.workout_sets.filter((s: any) => !s.is_warmup);
    const prs: PRResult[] = [];
    const newAchievements: AchievementUnlock[] = [];

    // --- PR DETECTION ---
    for (const set of sets) {
      const exerciseId = set.exercise_id;
      const exerciseName = set.exercises?.name || "Unknown";

      // Fetch current PRs for this exercise
      const { data: currentPRs } = await supabase
        .from("personal_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("exercise_id", exerciseId)
        .eq("is_current", true);

      const prMap = new Map((currentPRs || []).map((pr: any) => [pr.pr_type, pr]));

      const checks: Array<{
        type: "weight" | "reps" | "estimated_1rm" | "volume";
        value: number | null;
      }> = [
        { type: "weight", value: set.weight_kg },
        { type: "reps", value: set.reps },
        { type: "estimated_1rm", value: set.estimated_1rm },
      ];

      // Calculate session volume for this exercise
      const exerciseSets = sets.filter((s: any) => s.exercise_id === exerciseId);
      const sessionVolume = exerciseSets.reduce(
        (sum: number, s: any) => sum + (s.volume_kg || 0), 0
      );
      checks.push({ type: "volume", value: sessionVolume });

      for (const check of checks) {
        if (check.value === null || check.value <= 0) continue;

        const existing = prMap.get(check.type);
        const isNewPR = !existing || check.value > existing.value;

        if (isNewPR) {
          // Invalidate old PR
          if (existing) {
            await supabase
              .from("personal_records")
              .update({ is_current: false })
              .eq("id", existing.id);
          }

          const improvementPct = existing
            ? Math.round(((check.value - existing.value) / existing.value) * 1000) / 10
            : null;

          // Insert new PR
          await supabase.from("personal_records").insert({
            user_id: user.id,
            exercise_id: exerciseId,
            workout_id: workoutId,
            workout_set_id: check.type !== "volume" ? set.id : null,
            pr_type: check.type,
            value: check.value,
            previous_value: existing?.value || null,
            improvement_pct: improvementPct,
            is_current: true,
          });

          // Flag set as PR
          if (check.type !== "volume") {
            await supabase
              .from("workout_sets")
              .update({
                is_pr: true,
                pr_types: [...(set.pr_types || []), check.type],
              })
              .eq("id", set.id);
          }

          prs.push({
            exerciseId,
            exerciseName,
            prType: check.type,
            newValue: check.value,
            previousValue: existing?.value || null,
            improvementPct,
            setId: set.id,
          });
        }
      }
    }

    // Mark workout complete
    await supabase
      .from("workouts")
      .update({ is_complete: true, completed_at: new Date().toISOString() })
      .eq("id", workoutId);

    // --- ACHIEVEMENT DETECTION ---
    // Fetch user stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak")
      .eq("id", user.id)
      .single();

    const { count: totalWorkouts } = await supabase
      .from("workouts")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("is_complete", true);

    const { count: totalPRs } = await supabase
      .from("personal_records")
      .select("id", { count: "exact" })
      .eq("user_id", user.id);

    const { data: existingAchievements } = await supabase
      .from("user_achievements")
      .select("achievement_slug")
      .eq("user_id", user.id);

    const earned = new Set((existingAchievements || []).map((a: any) => a.achievement_slug));

    const toUnlock: Array<{ slug: string; condition: boolean; metadata?: object }> = [
      { slug: "first_workout", condition: (totalWorkouts || 0) >= 1 },
      { slug: "workouts_10", condition: (totalWorkouts || 0) >= 10 },
      { slug: "workouts_25", condition: (totalWorkouts || 0) >= 25 },
      { slug: "workouts_50", condition: (totalWorkouts || 0) >= 50 },
      { slug: "workouts_100", condition: (totalWorkouts || 0) >= 100 },
      { slug: "workouts_365", condition: (totalWorkouts || 0) >= 365 },
      { slug: "first_pr", condition: (totalPRs || 0) >= 1 },
      { slug: "pr_5", condition: (totalPRs || 0) >= 5 },
      { slug: "pr_25", condition: (totalPRs || 0) >= 25 },
      { slug: "pr_100", condition: (totalPRs || 0) >= 100 },
      { slug: "streak_3", condition: (profile?.current_streak || 0) >= 3 },
      { slug: "streak_7", condition: (profile?.current_streak || 0) >= 7 },
      { slug: "streak_14", condition: (profile?.current_streak || 0) >= 14 },
      { slug: "streak_30", condition: (profile?.current_streak || 0) >= 30 },
      { slug: "streak_100", condition: (profile?.current_streak || 0) >= 100 },
      { slug: "volume_1000", condition: (workout.total_volume_kg || 0) >= 1000 },
      { slug: "volume_5000", condition: (workout.total_volume_kg || 0) >= 5000 },
      // Time-based
      {
        slug: "early_bird",
        condition: new Date(workout.started_at).getHours() < 6,
      },
      {
        slug: "night_owl",
        condition: new Date(workout.started_at).getHours() >= 22,
      },
    ];

    for (const item of toUnlock) {
      if (item.condition && !earned.has(item.slug)) {
        const { data: def } = await supabase
          .from("achievement_definitions")
          .select("*")
          .eq("slug", item.slug)
          .single();

        if (def) {
          await supabase.from("user_achievements").insert({
            user_id: user.id,
            achievement_slug: item.slug,
            metadata: item.metadata || {},
          });

          newAchievements.push({
            slug: def.slug,
            name: def.name,
            description: def.description,
            icon: def.icon,
            color: def.color,
            xpValue: def.xp_value,
          });
        }
      }
    }

    // --- UPDATE WEEKLY VOLUME CACHE ---
    const weekStart = getWeekStart(new Date());
    const muscleVolumeMap = new Map<string, { sets: number; volume: number }>();

    for (const set of sets) {
      const muscles = set.exercises?.muscle_groups || [];
      for (const muscle of muscles) {
        const existing = muscleVolumeMap.get(muscle) || { sets: 0, volume: 0 };
        muscleVolumeMap.set(muscle, {
          sets: existing.sets + 1,
          volume: existing.volume + (set.volume_kg || 0),
        });
      }
    }

    for (const [muscle, data] of muscleVolumeMap) {
      await supabase
        .from("weekly_volume_cache")
        .upsert({
          user_id: user.id,
          week_start: weekStart,
          muscle_group: muscle,
          total_sets: data.sets,
          total_volume_kg: data.volume,
          computed_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,week_start,muscle_group",
          ignoreDuplicates: false,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        prs,
        newAchievements,
        hasCelebration: prs.length > 0 || newAchievements.length > 0,
        workout: {
          id: workoutId,
          totalVolume: workout.total_volume_kg,
          totalSets: workout.total_sets,
          duration: workout.duration_seconds,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}
