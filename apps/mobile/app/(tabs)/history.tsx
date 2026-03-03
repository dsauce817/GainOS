import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import type { Workout } from "@gainos/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number): string {
  if (kg === 0) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSectionLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (date >= startOfThisWeek) return "This Week";
  if (date >= startOfLastWeek) return "Last Week";

  const monthYear = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return monthYear;
}

// ─── Workout Card ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout }: { workout: Workout }) {
  return (
    <Pressable style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.workoutName} numberOfLines={1}>{workout.name}</Text>
        <Text style={styles.workoutDate}>{formatDate(workout.started_at)}</Text>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={13} color="#6b7280" />
          <Text style={styles.statValue}>{formatDuration(workout.duration_seconds)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="barbell-outline" size={13} color="#6b7280" />
          <Text style={styles.statValue}>{workout.total_sets} sets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="trending-up-outline" size={13} color="#6b7280" />
          <Text style={styles.statValue}>{formatVolume(workout.total_volume_kg)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { user } = useAuthStore();

  const { data: workouts, isLoading } = useQuery({
    queryKey: ["workouts", "history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_complete", true)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Workout[];
    },
    enabled: !!user,
  });

  // Group workouts by section label
  const sections: { label: string; items: Workout[] }[] = [];
  for (const workout of workouts ?? []) {
    const label = getSectionLabel(workout.started_at);
    const existing = sections.find((s) => s.label === label);
    if (existing) {
      existing.items.push(workout);
    } else {
      sections.push({ label, items: [workout] });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {workouts && workouts.length > 0 && (
          <Text style={styles.subtitle}>{workouts.length} workouts</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#818cf8" />
        </View>
      ) : workouts?.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="barbell-outline" size={48} color="#27272a" />
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptySubtitle}>Completed workouts will appear here</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section) => (
            <View key={section.label}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              {section.items.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0b",
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f4f4f5",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#52525b",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#52525b",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#3f3f46",
  },
  list: {
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#111113",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#27272a",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f4f4f5",
    flex: 1,
  },
  workoutDate: {
    fontSize: 13,
    color: "#52525b",
    marginLeft: 8,
  },
  cardStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    color: "#71717a",
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#27272a",
  },
});
