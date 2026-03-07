// GainOS Exercise Library
import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import type { Exercise } from "@gainos/db";
import { Colors, CategoryColors } from "../../constants/theme";

const MUSCLE_FILTERS = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Core",
  "Calves",
];

export default function ExercisesScreen() {
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("All");

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Exercise[];
    },
    staleTime: 1000 * 60 * 10, // cache 10 min
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    return exercises.filter((ex) => {
      const matchesSearch =
        search.trim() === "" ||
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.muscle_groups.some((m) => m.toLowerCase().includes(search.toLowerCase()));

      const matchesMuscle =
        selectedMuscle === "All" ||
        ex.muscle_groups.some((m) =>
          m.toLowerCase().includes(selectedMuscle.toLowerCase())
        );

      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        {exercises && (
          <Text style={styles.count}>{filtered.length} exercises</Text>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={Colors.textFaint}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Muscle Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {MUSCLE_FILTERS.map((muscle) => (
          <Pressable
            key={muscle}
            style={[styles.filterChip, selectedMuscle === muscle && styles.filterChipActive]}
            onPress={() => setSelectedMuscle(muscle)}
          >
            <Text
              style={[styles.filterChipText, selectedMuscle === muscle && styles.filterChipTextActive]}
            >
              {muscle}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accentLight} />
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ExerciseCard exercise={item} />}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 0.5, backgroundColor: Colors.separator, marginLeft: 16 }} />
            )}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="barbell-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyText}>No exercises found</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const primaryMuscle = exercise.muscle_groups[0]
    ? exercise.muscle_groups[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const categoryColor = CategoryColors[exercise.category] || Colors.textMuted;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/exercise/${exercise.id}`)}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardName} numberOfLines={1}>{exercise.name}</Text>
        <View style={styles.cardMeta}>
          {primaryMuscle ? (
            <Text style={styles.cardMuscle}>{primaryMuscle}</Text>
          ) : null}
          {primaryMuscle && exercise.equipment ? (
            <View style={styles.dot} />
          ) : null}
          {exercise.equipment ? (
            <Text style={styles.cardEquipment}>{exercise.equipment}</Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}20`, borderColor: `${categoryColor}40` }]}>
        <Text style={[styles.categoryText, { color: categoryColor }]}>
          {exercise.category}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "700", color: Colors.textPrimary, letterSpacing: -0.5 },
  count: { fontSize: 14, color: Colors.textMuted },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },

  filterScroll: { flexShrink: 0, flexGrow: 0 },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accentBg,
    borderColor: Colors.accent,
  },
  filterChipText: { fontSize: 13, fontWeight: "500", color: Colors.textMid },
  filterChipTextActive: { color: Colors.accentLight, fontWeight: "600" },

  listWrapper: { flex: 1, marginHorizontal: 16, backgroundColor: Colors.bgCard, borderRadius: 14, overflow: "hidden" },
  list: { paddingBottom: 120 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 60,
  },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  card: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardPressed: { opacity: 0.7 },
  cardLeft: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMuscle: { fontSize: 13, color: Colors.textMid },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textFaint },
  cardEquipment: { fontSize: 13, color: Colors.textMuted },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryText: { fontSize: 11, fontWeight: "600" },
});
