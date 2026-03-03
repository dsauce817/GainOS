// GainOS Edge Function: analytics
// Returns aggregated analytics for the web dashboard + mobile screens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "overview";

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

    switch (type) {
      case "overview": return handleOverview(supabase, user.id, corsHeaders);
      case "volume": return handleVolumeByMuscle(supabase, user.id, url, corsHeaders);
      case "exercise": return handleExerciseHistory(supabase, user.id, url, corsHeaders);
      case "pr-timeline": return handlePRTimeline(supabase, user.id, corsHeaders);
      case "weekly-report": return handleWeeklyReport(supabase, user.id, corsHeaders);
      default: throw new Error("Unknown analytics type");
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleOverview(supabase: any, userId: string, corsHeaders: any) {
  const [
    profileResult,
    totalWorkoutsResult,
    totalVolumeResult,
    totalPRsResult,
    achievementsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("current_streak, longest_streak, last_workout_date").eq("id", userId).single(),
    supabase.from("workouts").select("id", { count: "exact" }).eq("user_id", userId).eq("is_complete", true),
    supabase.from("workouts").select("total_volume_kg").eq("user_id", userId).eq("is_complete", true),
    supabase.from("personal_records").select("id", { count: "exact" }).eq("user_id", userId),
    supabase.from("user_achievements").select("id", { count: "exact" }).eq("user_id", userId),
  ]);

  const totalVolumeKg = (totalVolumeResult.data || []).reduce(
    (sum: number, w: any) => sum + (w.total_volume_kg || 0), 0
  );

  return new Response(JSON.stringify({
    streak: profileResult.data?.current_streak || 0,
    longestStreak: profileResult.data?.longest_streak || 0,
    lastWorkoutDate: profileResult.data?.last_workout_date,
    totalWorkouts: totalWorkoutsResult.count || 0,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalPRs: totalPRsResult.count || 0,
    totalAchievements: achievementsResult.count || 0,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleVolumeByMuscle(supabase: any, userId: string, url: URL, corsHeaders: any) {
  const weeks = parseInt(url.searchParams.get("weeks") || "4");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weeks * 7));

  const { data } = await supabase
    .from("weekly_volume_cache")
    .select("*")
    .eq("user_id", userId)
    .gte("week_start", weekStart.toISOString().split("T")[0])
    .order("week_start", { ascending: true });

  // Group by muscle_group across weeks
  const grouped: Record<string, Array<{ week: string; sets: number; volume: number }>> = {};
  for (const row of data || []) {
    if (!grouped[row.muscle_group]) grouped[row.muscle_group] = [];
    grouped[row.muscle_group]!.push({
      week: row.week_start,
      sets: row.total_sets,
      volume: row.total_volume_kg,
    });
  }

  return new Response(JSON.stringify({ muscleVolume: grouped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleExerciseHistory(supabase: any, userId: string, url: URL, corsHeaders: any) {
  const exerciseId = url.searchParams.get("exerciseId");
  if (!exerciseId) throw new Error("exerciseId required");

  const { data: sets } = await supabase
    .from("workout_sets")
    .select(`
      *,
      workouts!inner(user_id, completed_at, name)
    `)
    .eq("workouts.user_id", userId)
    .eq("exercise_id", exerciseId)
    .eq("is_warmup", false)
    .order("completed_at", { foreignTable: "workouts", ascending: false })
    .limit(100);

  const { data: prs } = await supabase
    .from("personal_records")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .order("achieved_at", { ascending: false });

  // Group by session (workout)
  const sessions: Record<string, any> = {};
  for (const set of sets || []) {
    const wId = set.workout_id;
    if (!sessions[wId]) {
      sessions[wId] = {
        workoutId: wId,
        workoutName: set.workouts.name,
        date: set.workouts.completed_at,
        sets: [],
        maxWeight: 0,
        maxE1RM: 0,
        totalVolume: 0,
      };
    }
    sessions[wId].sets.push(set);
    sessions[wId].maxWeight = Math.max(sessions[wId].maxWeight, set.weight_kg || 0);
    sessions[wId].maxE1RM = Math.max(sessions[wId].maxE1RM, set.estimated_1rm || 0);
    sessions[wId].totalVolume += set.volume_kg || 0;
  }

  const sortedSessions = Object.values(sessions)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return new Response(JSON.stringify({
    sessions: sortedSessions,
    prs: prs || [],
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handlePRTimeline(supabase: any, userId: string, corsHeaders: any) {
  const { data } = await supabase
    .from("personal_records")
    .select("*, exercises(name, muscle_groups)")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: false })
    .limit(50);

  return new Response(JSON.stringify({ prs: data || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleWeeklyReport(supabase: any, userId: string, corsHeaders: any) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [workoutsResult, prsResult, volumeResult, goalsResult] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, name, total_volume_kg, total_sets, duration_seconds, completed_at")
      .eq("user_id", userId)
      .eq("is_complete", true)
      .gte("completed_at", oneWeekAgo.toISOString()),
    supabase
      .from("personal_records")
      .select("*, exercises(name)")
      .eq("user_id", userId)
      .gte("achieved_at", oneWeekAgo.toISOString()),
    supabase
      .from("weekly_volume_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", getWeekStart(new Date())),
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  return new Response(JSON.stringify({
    workouts: workoutsResult.data || [],
    prs: prsResult.data || [],
    volume: volumeResult.data || [],
    goals: goalsResult.data || [],
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}
