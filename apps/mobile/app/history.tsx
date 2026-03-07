import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import type { Workout } from "@gainos/db";
import { Colors } from "../constants/theme";

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
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function WorkoutCard({ workout, isLast }: { workout: Workout; isLast?: boolean }) {
  return (
    <Pressable style={[styles.card, isLast && { borderBottomWidth: 0 }]}>
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

  const sections: { label: string; items: Workout[] }[] = [];
  for (const workout of workouts ?? []) {
    const label = getSectionLabel(workout.started_at);
    const existing = sections.find((s) => s.label === label);
    if (existing) existing.items.push(workout);
    else sections.push({ label, items: [workout] });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>History</Text>
        {workouts && workouts.length > 0 ? (
          <Text style={styles.subtitle}>{workouts.length} workouts</Text>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accentLight} />
        </View>
      ) : workouts?.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="barbell-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptySubtitle}>Completed workouts will appear here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.label}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <View style={styles.sectionList}>
                {section.items.map((workout, i) => (
                  <WorkoutCard key={workout.id} workout={workout} isLast={i === section.items.length - 1} />
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: Colors.textMuted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.textMuted, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: Colors.textFaint },
  list: { paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSub,
    letterSpacing: -0.1,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionList: { backgroundColor: Colors.bgCard, borderRadius: 14, overflow: "hidden" },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  workoutName: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  workoutDate: { fontSize: 13, color: Colors.textMuted, marginLeft: 8 },
  cardStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontSize: 13, color: Colors.textMid },
  statDivider: { width: 1, height: 12, backgroundColor: Colors.border },
});
