// GainOS Home Screen — Dashboard
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

export default function HomeScreen() {
  const { profile } = useAuthStore();

  const { data: stats, refetch, isRefetching } = useQuery({
    queryKey: ["home-stats", profile?.id],
    queryFn: async () => {
      const [workoutsRes, prsRes, achievementsRes, weeklyVolumeRes] = await Promise.all([
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
          .limit(5),
      ]);

      return {
        recentWorkouts: workoutsRes.data || [],
        recentPRs: prsRes.data || [],
        achievementCount: achievementsRes.count || 0,
        weeklyVolume: weeklyVolumeRes.data || [],
      };
    },
    enabled: !!profile?.id,
  });

  const greeting = getGreeting();
  const name = profile?.full_name?.split(" ")[0] || profile?.username || "Athlete";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#818cf8" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{name} 💪</Text>
          </View>
          <Pressable onPress={() => router.push("/coach")} style={styles.coachButton}>
            <LinearGradient
              colors={["#6366f1", "#8b5cf6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coachButtonGradient}
            >
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.coachButtonText}>Coach</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Streak + Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Streak" value={`${profile?.current_streak || 0}`} suffix="days" emoji="🔥" color="#f97316" />
          <StatCard
            label="This Week"
            value={`${stats?.weeklyVolume.reduce((sum, v) => sum + v.total_sets, 0) || 0}`}
            suffix="sets"
            emoji="📊"
            color="#818cf8"
          />
          <StatCard label="Trophies" value={`${stats?.achievementCount || 0}`} suffix="" emoji="🏆" color="#f59e0b" />
        </View>

        {/* Weekly Volume by Muscle */}
        {stats?.weeklyVolume && stats.weeklyVolume.length > 0 && (
          <Section title="This Week's Volume">
            <View style={styles.muscleGrid}>
              {stats.weeklyVolume.slice(0, 6).map((v) => (
                <MuscleChip key={v.muscle_group} muscle={v.muscle_group} sets={v.total_sets} />
              ))}
            </View>
          </Section>
        )}

        {/* Recent Workouts */}
        {stats?.recentWorkouts && stats.recentWorkouts.length > 0 && (
          <Section title="Recent Workouts" onSeeAll={() => router.push("/history")}>
            {stats.recentWorkouts.map((w: any) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </Section>
        )}

        {/* Recent PRs */}
        {stats?.recentPRs && stats.recentPRs.length > 0 && (
          <Section title="Recent PRs 🎯">
            {stats.recentPRs.map((pr: any) => (
              <PRRow key={pr.id} pr={pr} />
            ))}
          </Section>
        )}

        {/* Start Workout CTA */}
        <Pressable style={styles.startCTA} onPress={() => router.push("/workouts")}>
          <LinearGradient
            colors={["#6366f1", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startCTAGradient}
          >
            <Ionicons name="barbell-outline" size={20} color="#fff" />
            <Text style={styles.startCTAText}>Start Workout</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, suffix, emoji, color }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <Text style={styles.statEmoji}>{emoji}</Text>
      <View style={styles.statValues}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {suffix ? <Text style={styles.statSuffix}>{suffix}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, onSeeAll }: { title: string; children: React.ReactNode; onSeeAll?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function MuscleChip({ muscle, sets }: { muscle: string; sets: number }) {
  const displayName = muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const status = sets >= 10 ? "optimal" : sets >= 6 ? "mev" : "low";
  const chipColors = {
    optimal: { bg: "#052e16", border: "#16a34a", text: "#4ade80" },
    mev: { bg: "#1c1a0a", border: "#ca8a04", text: "#fbbf24" },
    low: { bg: "#1c0f0f", border: "#b91c1c", text: "#f87171" },
  };
  const c = chipColors[status];

  return (
    <View style={[styles.muscleChip, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.muscleChipText, { color: c.text }]}>{displayName}</Text>
      <Text style={[styles.muscleChipSets, { color: c.text }]}>{sets}s</Text>
    </View>
  );
}

function WorkoutRow({ workout }: { workout: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Animated.View style={[styles.workoutRow, animStyle]}>
        <View style={styles.workoutRowLeft}>
          <Text style={styles.workoutRowName}>{workout.name}</Text>
          <Text style={styles.workoutRowMeta}>
            {getRelativeDate(workout.completed_at)} · {workout.total_sets} sets · {formatVolume(workout.total_volume_kg)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#4b5563" />
      </Animated.View>
    </Pressable>
  );
}

function PRRow({ pr }: { pr: any }) {
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
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Animated.View style={[styles.prRow, animStyle]}>
        <View style={styles.prBadge}>
          <Text style={styles.prBadgeText}>PR</Text>
        </View>
        <View style={styles.prRowContent}>
          <Text style={styles.prExerciseName}>{pr.exercises?.name}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0b" },
  content: { paddingBottom: 120, gap: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  greeting: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
  name: { fontSize: 28, fontWeight: "800", color: "#f9fafb", letterSpacing: -0.5 },
  coachButton: { borderRadius: 12, overflow: "hidden" },
  coachButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coachButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111113",
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#2a2a32",
    overflow: "hidden",
  },
  statAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statEmoji: { fontSize: 22 },
  statValues: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statSuffix: { fontSize: 11, color: "#6b7280", fontWeight: "500" },
  statLabel: { fontSize: 11, color: "#6b7280", textAlign: "center" },
  section: { paddingHorizontal: 20, gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#f9fafb", letterSpacing: -0.2 },
  seeAll: { fontSize: 13, color: "#818cf8", fontWeight: "600" },
  muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  muscleChipText: { fontSize: 13, fontWeight: "600" },
  muscleChipSets: { fontSize: 12, fontWeight: "700" },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111113",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  workoutRowLeft: { gap: 4, flex: 1 },
  workoutRowName: { fontSize: 15, fontWeight: "600", color: "#f9fafb" },
  workoutRowMeta: { fontSize: 13, color: "#6b7280" },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0d1a0d",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#14532d",
  },
  prBadge: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  prRowContent: { flex: 1, gap: 2 },
  prExerciseName: { fontSize: 14, fontWeight: "600", color: "#f9fafb" },
  prMeta: { fontSize: 13, color: "#86efac" },
  prDate: { fontSize: 12, color: "#6b7280" },
  startCTA: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  startCTAGradient: {
    padding: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  startCTAText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
});
