import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#ef4444",
  back: "#3b82f6",
  shoulders: "#8b5cf6",
  biceps: "#f59e0b",
  triceps: "#f97316",
  legs: "#22c55e",
  quads: "#22c55e",
  hamstrings: "#16a34a",
  glutes: "#15803d",
  calves: "#4ade80",
  core: "#06b6d4",
  abs: "#06b6d4",
  forearms: "#d97706",
};

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();

  const { data: exercise, isLoading } = useQuery({
    queryKey: ["exercise", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: prs } = useQuery({
    queryKey: ["exercise-prs", id, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personal_records")
        .select("*")
        .eq("exercise_id", id)
        .eq("user_id", profile!.id)
        .eq("is_current", true)
        .order("pr_type");
      return data || [];
    },
    enabled: !!id && !!profile?.id,
  });

  const { data: history } = useQuery({
    queryKey: ["exercise-history", id, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_sets")
        .select("*, workouts(name, completed_at)")
        .eq("exercise_id", id)
        .eq("workouts.user_id", profile!.id)
        .not("workouts", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id && !!profile?.id,
  });

  if (isLoading || !exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const prLabels: Record<string, string> = {
    weight: "Max Weight",
    reps: "Max Reps",
    estimated_1rm: "Est. 1RM",
    volume: "Volume",
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{exercise.name}</Text>
          <View style={styles.tags}>
            <Tag text={exercise.equipment} />
            <Tag text={exercise.category} />
          </View>
        </View>

        {/* Muscle Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscles</Text>
          <View style={styles.muscleRow}>
            {exercise.muscle_groups?.map((m: string) => (
              <View
                key={m}
                style={[
                  styles.muscleChip,
                  { backgroundColor: `${MUSCLE_COLORS[m] || "#6366f1"}22`, borderColor: MUSCLE_COLORS[m] || "#6366f1" },
                ]}
              >
                <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS[m] || "#6366f1" }]}>
                  {m.replace(/_/g, " ")}
                </Text>
              </View>
            ))}
            {exercise.secondary_muscles?.map((m: string) => (
              <View key={`sec-${m}`} style={styles.secondaryChip}>
                <Text style={styles.secondaryChipText}>{m.replace(/_/g, " ")}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Personal Records */}
        {prs && prs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your PRs 🎯</Text>
            <View style={styles.prGrid}>
              {prs.map((pr: any) => (
                <View key={pr.id} style={styles.prCard}>
                  <Text style={styles.prValue}>
                    {pr.value}{pr.pr_type === "reps" ? " reps" : "kg"}
                  </Text>
                  <Text style={styles.prLabel}>{prLabels[pr.pr_type] || pr.pr_type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Instructions */}
        {exercise.instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to perform</Text>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsText}>{exercise.instructions}</Text>
            </View>
          </View>
        )}

        {/* Tips */}
        {exercise.tips && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tips 💡</Text>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsText}>{exercise.tips}</Text>
            </View>
          </View>
        )}

        {/* History */}
        {history && history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sets</Text>
            {history.slice(0, 10).map((set: any) => (
              <View key={set.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyWeight}>
                    {set.weight_kg}kg × {set.reps} reps
                  </Text>
                  <Text style={styles.historyMeta}>
                    {set.workouts?.name} · {new Date(set.completed_at).toLocaleDateString()}
                  </Text>
                </View>
                {set.is_pr && (
                  <View style={styles.prBadge}>
                    <Text style={styles.prBadgeText}>PR</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0b" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#6b7280" },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { paddingVertical: 8 },
  backText: { color: "#6366f1", fontSize: 18, fontWeight: "600" },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  titleSection: { gap: 12 },
  title: { fontSize: 28, fontWeight: "900", color: "#f9fafb", letterSpacing: -0.5 },
  tags: { flexDirection: "row", gap: 8 },
  tag: {
    backgroundColor: "#1e1e24",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  tagText: { color: "#9ca3af", fontSize: 12, fontWeight: "500", textTransform: "capitalize" },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f9fafb" },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  muscleChipText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  secondaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#2a2a32",
    backgroundColor: "#111113",
  },
  secondaryChipText: { fontSize: 13, color: "#6b7280", textTransform: "capitalize" },
  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  prCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#0d1a0d",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#14532d",
    alignItems: "center",
    gap: 4,
  },
  prValue: { fontSize: 22, fontWeight: "800", color: "#4ade80" },
  prLabel: { fontSize: 12, color: "#86efac", fontWeight: "500" },
  instructionsCard: {
    backgroundColor: "#111113",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  instructionsText: { color: "#d1d5db", fontSize: 14, lineHeight: 22 },
  tipsCard: {
    backgroundColor: "#1c1a0a",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ca8a04",
  },
  tipsText: { color: "#fbbf24", fontSize: 14, lineHeight: 22 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  historyWeight: { fontSize: 15, fontWeight: "600", color: "#f9fafb" },
  historyMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  prBadge: { backgroundColor: "#16a34a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  prBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
