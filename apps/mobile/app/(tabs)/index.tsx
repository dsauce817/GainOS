// GainOS Home Screen
import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import { formatVolume, getRelativeDate } from "@gainos/utils";
import { Colors } from "../../constants/theme";

export default function HomeScreen() {
  const { profile } = useAuthStore();

  const { data: stats, refetch, isRefetching } = useQuery({
    queryKey: ["home-stats", profile?.id],
    queryFn: async () => {
      const [workoutsRes, prsRes, achievementsRes, weeklyVolumeRes, weeklySessionsRes, lastWeekVolumeRes, weeklyPRsRes] = await Promise.all([
        supabase
          .from("workouts")
          .select("id, name, completed_at, total_volume_kg, total_sets")
          .eq("user_id", profile!.id)
          .eq("is_complete", true)
          .order("completed_at", { ascending: false })
          .limit(5),
        supabase
          .from("personal_records")
          .select("*, exercises(name)")
          .eq("user_id", profile!.id)
          .eq("is_current", true)
          .order("achieved_at", { ascending: false })
          .limit(3),
        supabase
          .from("user_achievements")
          .select("id", { count: "exact" })
          .eq("user_id", profile!.id),
        supabase
          .from("weekly_volume_cache")
          .select("*")
          .eq("user_id", profile!.id)
          .gte("week_start", getThisWeekMonday())
          .order("total_sets", { ascending: false })
          .limit(6),
        supabase
          .from("workouts")
          .select("id", { count: "exact" })
          .eq("user_id", profile!.id)
          .eq("is_complete", true)
          .gte("completed_at", `${getThisWeekMonday()}T00:00:00`),
        supabase
          .from("weekly_volume_cache")
          .select("total_volume_kg")
          .eq("user_id", profile!.id)
          .eq("week_start", getLastWeekMonday()),
        supabase
          .from("personal_records")
          .select("id", { count: "exact" })
          .eq("user_id", profile!.id)
          .gte("achieved_at", `${getThisWeekMonday()}T00:00:00`),
      ]);

      const lastWeekVol = (lastWeekVolumeRes.data || []).reduce(
        (s: number, v: any) => s + (v.total_volume_kg || 0), 0
      );

      return {
        recentWorkouts: workoutsRes.data || [],
        recentPRs: prsRes.data || [],
        achievementCount: achievementsRes.count || 0,
        weeklyVolume: weeklyVolumeRes.data || [],
        weeklySessions: weeklySessionsRes.count ?? 0,
        lastWeekVolumeKg: lastWeekVol,
        weeklyPRCount: weeklyPRsRes.count ?? 0,
      };
    },
    enabled: !!profile?.id,
  });

  const greeting = getGreeting();
  const name = profile?.full_name?.split(" ")[0] || profile?.username || "Athlete";
  const weeklySessions = stats?.weeklySessions ?? 0;
  const weeklySets = stats?.weeklyVolume.reduce((sum: number, v: any) => sum + v.total_sets, 0) ?? 0;
  const weeklyPRCount = stats?.weeklyPRCount ?? 0;
  const thisWeekVolumeKg = stats?.weeklyVolume.reduce((sum: number, v: any) => sum + (v.total_volume_kg || 0), 0) ?? 0;
  const lastWeekVolumeKg = stats?.lastWeekVolumeKg ?? 0;
  const volumePct = lastWeekVolumeKg > 0
    ? Math.round((thisWeekVolumeKg - lastWeekVolumeKg) / lastWeekVolumeKg * 100)
    : null;
  const { value: heroValue, unit: heroUnit } = formatHeroVolume(thisWeekVolumeKg);
  const maxMuscleWeeklySets = stats?.weeklyVolume?.length
    ? Math.max(...stats.weeklyVolume.map((v: any) => v.total_sets))
    : 1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accentLight} />
        }
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <Pressable onPress={() => router.push("/coach")} style={styles.coachBtn}>
            <LinearGradient
              colors={[Colors.accent, Colors.accentStrong]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coachBtnGradient}
            >
              <Ionicons name="sparkles" size={13} color="#fff" />
              <Text style={styles.coachBtnText}>Coach</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Volume Hero ───────────────────────────────────────── */}
        <View style={styles.heroBlock}>

          <Text style={styles.heroLabel}>Weekly Volume</Text>

          <View style={styles.heroNumberRow}>
            <Text style={styles.heroNumber}>{heroValue}</Text>
            <Text style={styles.heroUnit}>{heroUnit}</Text>
          </View>

          {volumePct !== null && (
            <Text style={[styles.heroContext, { color: volumePct >= 0 ? Colors.accentLight : Colors.errorLight }]}>
              {volumePct >= 0 ? "+" : ""}{volumePct}% vs last week
            </Text>
          )}

          <View style={styles.statsStrip}>
            <View style={styles.stripStat}>
              <Text style={styles.stripValue}>{weeklySessions}</Text>
              <Text style={styles.stripLabel}>Sessions</Text>
            </View>
            <View style={styles.stripLine} />
            <View style={styles.stripStat}>
              <Text style={styles.stripValue}>{weeklySets}</Text>
              <Text style={styles.stripLabel}>Sets</Text>
            </View>
            <View style={styles.stripLine} />
            <View style={styles.stripStat}>
              <Text style={styles.stripValue}>{weeklyPRCount}</Text>
              <Text style={styles.stripLabel}>PRs</Text>
            </View>
          </View>

        </View>

        {/* ── Volume by Muscle ──────────────────────────────────── */}
        {stats?.weeklyVolume && stats.weeklyVolume.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Volume by Muscle</Text>
            <View style={styles.muscleChart}>
              {stats.weeklyVolume.map((v: any) => (
                <MuscleBar
                  key={v.muscle_group}
                  muscle={v.muscle_group}
                  sets={v.total_sets}
                  maxSets={maxMuscleWeeklySets}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Recent Workouts ───────────────────────────────────── */}
        {stats?.recentWorkouts && stats.recentWorkouts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Workouts</Text>
              <Pressable onPress={() => router.push("/history")}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.listContainer}>
              {stats.recentWorkouts.map((w: any, i: number) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  isLast={i === stats.recentWorkouts.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Recent PRs ────────────────────────────────────────── */}
        {stats?.recentPRs && stats.recentPRs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent PRs</Text>
            <View style={styles.prContainer}>
              {stats.recentPRs.map((pr: any, i: number) => (
                <PRRow
                  key={pr.id}
                  pr={pr}
                  isLast={i === stats.recentPRs.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Start Workout CTA ─────────────────────────────────── */}
        <Pressable style={styles.cta} onPress={() => router.push("/workouts")}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="barbell-outline" size={20} color="#fff" />
            <Text style={styles.ctaText}>Start Workout</Text>
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MuscleBar({ muscle, sets, maxSets }: { muscle: string; sets: number; maxSets: number }) {
  const displayName = muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const pct = maxSets > 0 ? sets / maxSets : 0;
  const status = sets >= 10 ? "optimal" : sets >= 6 ? "mev" : "low";
  const color =
    status === "optimal" ? Colors.accentLight :
    status === "mev"     ? Colors.warning :
                           Colors.errorLight;

  return (
    <View style={styles.muscleBarRow}>
      <Text style={styles.muscleBarName}>{displayName}</Text>
      <View style={styles.muscleBarTrack}>
        <View style={[styles.muscleBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.muscleBarCount, { color }]}>{sets}s</Text>
    </View>
  );
}

function WorkoutRow({ workout, isLast }: { workout: any; isLast?: boolean }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Animated.View style={[styles.workoutRow, isLast && { borderBottomWidth: 0 }, animStyle]}>
        <View style={styles.workoutRowLeft}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.workoutMeta}>
            {getRelativeDate(workout.completed_at)} · {workout.total_sets} sets · {formatVolume(workout.total_volume_kg)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
      </Animated.View>
    </Pressable>
  );
}

function PRRow({ pr, isLast }: { pr: any; isLast?: boolean }) {
  const labels: Record<string, string> = {
    weight: "Weight",
    reps: "Reps",
    estimated_1rm: "Est. 1RM",
    volume: "Volume",
  };
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Animated.View style={[styles.prRow, isLast && { borderBottomWidth: 0 }, animStyle]}>
        <View style={styles.prBadge}>
          <Text style={styles.prBadgeText}>PR</Text>
        </View>
        <View style={styles.prContent}>
          <Text style={styles.prExercise}>{pr.exercises?.name}</Text>
          <Text style={styles.prMeta}>
            {labels[pr.pr_type] || pr.pr_type} · {pr.value}{pr.pr_type === "reps" ? " reps" : "kg"}
            {pr.improvement_pct ? ` (+${pr.improvement_pct}%)` : ""}
          </Text>
        </View>
        <Text style={styles.prDate}>{getRelativeDate(pr.achieved_at)}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getThisWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getLastWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function formatHeroVolume(kg: number): { value: string; unit: string } {
  if (kg === 0) return { value: "0", unit: "kg" };
  if (kg >= 1000) return { value: (kg / 1000).toFixed(1), unit: "t" };
  return { value: String(Math.round(kg)), unit: "kg" };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 120, gap: 32 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  name: {
    fontSize: 20,
    fontWeight: "500",
    color: Colors.textSub,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  coachBtn: { borderRadius: 12, overflow: "hidden", marginTop: 4 },
  coachBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coachBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // ── Volume Hero — lives on screen background ──────────────────────────────
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textFaint,
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  heroNumberRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  heroNumber: {
    fontSize: 60,
    fontWeight: "900",
    color: Colors.accent,
    letterSpacing: -4,
    lineHeight: 68,
  },
  heroUnit: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textSub,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroContext: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  // ── Stats strip — below hero, separated by space not a container ───────────
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
  },
  stripStat: {
    flex: 1,
    gap: 4,
  },
  stripValue: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.textBright,
    letterSpacing: -0.4,
  },
  stripLabel: {
    fontSize: 11,
    color: Colors.textFaint,
    fontWeight: "500",
  },
  stripLine: {
    width: 0.5,
    height: 28,
    backgroundColor: Colors.separator,
    marginHorizontal: 16,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textBright,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: "600",
  },

  // ── Muscle bar chart ───────────────────────────────────────────────────────
  muscleChart: { gap: 16 },
  muscleBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  muscleBarName: {
    width: 88,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSub,
    letterSpacing: -0.1,
  },
  muscleBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: "hidden",
  },
  muscleBarFill: {
    height: 4,
    borderRadius: 2,
  },
  muscleBarCount: {
    width: 26,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  // ── Workout list ──────────────────────────────────────────────────────────
  listContainer: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator,
  },
  workoutRowLeft: { gap: 4, flex: 1 },
  workoutName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textBright,
    letterSpacing: -0.1,
  },
  workoutMeta: { fontSize: 13, color: Colors.textMuted },

  // ── PR list ───────────────────────────────────────────────────────────────
prContainer: {
  backgroundColor: Colors.bgCard,
  borderRadius: 14,
  overflow: "hidden",
},
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(34,197,94,0.12)",
  },
  prBadge: {
    backgroundColor: Colors.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexShrink: 0,
  },
  prBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  prContent: { flex: 1, gap: 2 },
  prExercise: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textBright,
    letterSpacing: -0.1,
  },
  prMeta: { fontSize: 13, color: Colors.successBright },
  prDate: { fontSize: 12, color: Colors.textMuted, flexShrink: 0 },

  // ── CTA ───────────────────────────────────────────────────────────────────
cta: {
  marginHorizontal: 20,
  borderRadius: 16,
  overflow: "hidden",
},
  ctaGradient: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
});
