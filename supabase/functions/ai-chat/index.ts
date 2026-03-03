// GainOS Edge Function: ai-chat
// Handles AI coach conversations with full user context injection

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.52.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

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

    const { conversationId, message } = await req.json();

    // --- BUILD USER CONTEXT ---
    const [
      profileResult,
      recentWorkoutsResult,
      weeklyVolumeResult,
      recentPRsResult,
      goalsResult,
      dailyLogsResult,
      lastCheckinResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("workouts")
        .select(`*, workout_sets(*, exercises(name, muscle_groups))`)
        .eq("user_id", user.id)
        .eq("is_complete", true)
        .order("completed_at", { ascending: false })
        .limit(10),
      supabase
        .from("weekly_volume_cache")
        .select("*")
        .eq("user_id", user.id)
        .gte("week_start", getWeekStart(new Date()))
        .order("total_sets", { ascending: false }),
      supabase
        .from("personal_records")
        .select("*, exercises(name)")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .order("achieved_at", { ascending: false })
        .limit(10),
      supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(14),
      supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .single(),
    ]);

    const profile = profileResult.data;
    const recentWorkouts = recentWorkoutsResult.data || [];
    const weeklyVolume = weeklyVolumeResult.data || [];
    const recentPRs = recentPRsResult.data || [];
    const goals = goalsResult.data || [];
    const dailyLogs = dailyLogsResult.data || [];
    const lastCheckin = lastCheckinResult.data;

    // Compute weekly workout count
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const workoutsThisWeek = recentWorkouts.filter(
      (w: any) => new Date(w.completed_at) > oneWeekAgo
    ).length;

    // Average nutrition last 7 days
    const last7Days = dailyLogs.slice(0, 7);
    const avgProtein = last7Days.length
      ? Math.round(last7Days.reduce((s: number, d: any) => s + (d.protein_g || 0), 0) / last7Days.length)
      : null;
    const avgCalories = last7Days.length
      ? Math.round(last7Days.reduce((s: number, d: any) => s + (d.calories || 0), 0) / last7Days.length)
      : null;
    const avgSleep = last7Days.length
      ? Math.round(last7Days.reduce((s: number, d: any) => s + (d.sleep_hours || 0), 0) / last7Days.length * 10) / 10
      : null;
    const cardioSessionsThisWeek = last7Days.reduce((s: number, d: any) => s + (d.cardio_sessions || 0), 0);

    // Build system prompt
    const systemPrompt = `You are GainOS Coach — an elite, data-driven personal trainer and nutrition coach inside the GainOS fitness app. You are direct, motivating, and evidence-based. You talk like a brilliant coach who actually cares about results, not a generic chatbot.

## Your User's Profile
- **Name**: ${profile?.full_name || profile?.username || "Athlete"}
- **Age**: ${profile?.age || "Unknown"}, **Sex**: ${profile?.sex || "Unknown"}
- **Height**: ${profile?.height_cm ? `${profile.height_cm} cm` : "Unknown"}
- **Current Weight**: ${profile?.weight_kg ? `${profile.weight_kg} kg` : lastCheckin?.weight_kg ? `${lastCheckin.weight_kg} kg (from last check-in)` : "Unknown"}
- **Goal**: ${profile?.goal || "Not set"} (cut = fat loss, bulk = muscle gain, recomp = both)
- **Training Age**: ${profile?.training_age_months ? `${Math.floor(profile.training_age_months / 12)} years ${profile.training_age_months % 12} months` : "Unknown"}
- **Equipment**: ${profile?.equipment?.join(", ") || "Not specified"}
- **Workout Schedule**: ${profile?.schedule?.join(", ") || "Not specified"}
- **Current Streak**: ${profile?.current_streak || 0} days (longest: ${profile?.longest_streak || 0} days)

## This Week's Training
- **Workouts completed**: ${workoutsThisWeek} this week
- **Weekly muscle volume** (sets per muscle group):
${weeklyVolume.map((v: any) => `  - ${v.muscle_group}: ${v.total_sets} sets`).join("\n") || "  - No data yet"}

## Recent PRs (last 10)
${recentPRs.length ? recentPRs.map((pr: any) => `- ${pr.exercises?.name}: ${pr.pr_type} PR — ${pr.value} ${pr.pr_type === "reps" ? "reps" : "kg"} (${new Date(pr.achieved_at).toLocaleDateString()})`).join("\n") : "- No PRs yet"}

## Recent Workouts (last 10)
${recentWorkouts.slice(0, 5).map((w: any) => `- ${w.name} — ${new Date(w.completed_at).toLocaleDateString()} | ${w.total_volume_kg}kg volume | ${w.total_sets} sets`).join("\n") || "- No workouts logged yet"}

## Nutrition & Recovery (7-day averages)
- **Avg Calories**: ${avgCalories || "Not tracked"}
- **Avg Protein**: ${avgProtein ? `${avgProtein}g` : "Not tracked"}
- **Avg Sleep**: ${avgSleep ? `${avgSleep} hours` : "Not tracked"}
- **Cardio sessions this week**: ${cardioSessionsThisWeek}

## Active Goals
${goals.length ? goals.map((g: any) => `- ${g.goal_type}: target ${g.target_value} (${g.period})`).join("\n") : "- No goals set"}

## Last Check-in
${lastCheckin ? `${lastCheckin.date}: ${lastCheckin.weight_kg ? `${lastCheckin.weight_kg}kg` : ""} ${lastCheckin.body_fat_pct ? `${lastCheckin.body_fat_pct}% BF` : ""}` : "No check-ins yet"}

---

## How to respond:
- Be **specific** — reference their actual data (exercises, weights, volume numbers)
- Be **direct** — don't sugarcoat weak areas, but always be constructive
- Be **concise** — short paragraphs, use bullet points for recommendations
- Ask **smart follow-up questions** to get more context before giving advice
- If something is missing (e.g., sleep not tracked), gently point it out
- When giving training advice, reference **evidence-based principles** (MEV, MRV, progressive overload, deload timing)
- When giving nutrition advice, use **specific numbers** based on their goal and bodyweight
- Celebrate PRs and progress genuinely — make it feel real
- Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

    // Get conversation history
    let conversationRecord: any = null;
    if (conversationId) {
      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();
      conversationRecord = conv;
    }

    if (!conversationRecord) {
      // Create new conversation
      const { data: newConv } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 60) })
        .select()
        .single();
      conversationRecord = newConv;
    }

    const convId = conversationRecord.id;

    // Fetch conversation history
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(30);

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...(history || []).filter((m: any) => m.role !== "system").map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // Save user message
    await supabase.from("ai_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4o"
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const assistantContent = response.choices[0]?.message?.content || "";

    // Save assistant message
    await supabase.from("ai_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: assistantContent,
      tokens_used: response.usage?.completion_tokens || 0,
    });

    // Update conversation timestamp
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    // Unlock chat achievement
    const { data: chatAchievement } = await supabase
      .from("user_achievements")
      .select("id")
      .eq("user_id", user.id)
      .eq("achievement_slug", "chat_with_coach")
      .single();

    if (!chatAchievement) {
      await supabase.from("user_achievements").insert({
        user_id: user.id,
        achievement_slug: "chat_with_coach",
      });
    }

    return new Response(
      JSON.stringify({
        conversationId: convId,
        message: assistantContent,
        tokensUsed: response.usage?.completion_tokens || 0,
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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}
