// GainOS Active Workout Screen
// The core logging experience — exercises, sets, rest timer, RPE

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Vibration,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useWorkoutStore } from "../../store/workout";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import { formatDuration } from "@gainos/utils";
import type { ActiveExercise, ActiveSet, Exercise } from "@gainos/db";
import { Colors } from "../../constants/theme";

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const {
    activeWorkout,
    elapsedSeconds,
    restTimer,
    tickTimer,
    tickRestTimer,
    stopRestTimer,
    completeSet,
    addSet,
    removeSet,
    updateSet,
    addExercise,
    removeExercise,
    discardWorkout,
  } = useWorkoutStore();

  const { profile } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Elapsed workout timer
  useEffect(() => {
    timerRef.current = setInterval(tickTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer.isActive) {
      restTimerRef.current = setInterval(() => {
        tickRestTimer();
      }, 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [restTimer.isActive]);

  // Vibrate when rest timer hits 0
  useEffect(() => {
    if (restTimer.remainingSeconds === 0 && !restTimer.isActive && elapsedSeconds > 0) {
      Vibration.vibrate([0, 300, 100, 300]);
    }
  }, [restTimer.isActive]);

  const handleFinishWorkout = async () => {
    if (!activeWorkout) return;

    Alert.alert(
      "Finish Workout?",
      `You've been training for ${formatDuration(elapsedSeconds)}`,
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Finish",
          style: "default",
          onPress: saveWorkout,
        },
      ]
    );
  };

  const saveWorkout = async () => {
    if (!activeWorkout || !profile) return;
    setSaving(true);

    try {
      // Insert workout
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: profile.id,
          routine_id: activeWorkout.routineId,
          name: activeWorkout.name,
          started_at: activeWorkout.startedAt.toISOString(),
          duration_seconds: elapsedSeconds,
        })
        .select()
        .single();

      if (workoutError || !workout) throw workoutError;

      // Insert all completed sets
      const setsToInsert = activeWorkout.exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.isComplete && s.reps && s.weight)
          .map((s) => ({
            workout_id: workout.id,
            exercise_id: ex.exerciseId,
            set_number: s.setNumber,
            reps: parseInt(s.reps) || 0,
            weight_kg: parseFloat(s.weight) || 0,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            is_warmup: s.isWarmup,
            completed_at: s.completedAt?.toISOString() || new Date().toISOString(),
          }))
      );

      if (setsToInsert.length) {
        const { error } = await supabase
          .from("workout_sets")
          .insert(setsToInsert);

        if (error) throw error;
      }

      // Call complete-workout edge function for PR detection + achievements
      const { data: celebration } = await supabase.functions.invoke("complete-workout", {
        body: { workoutId: workout.id },
      });


      // Block the discard-guard useEffect from redirecting to tabs

      discardWorkout();
      setSaving(false);
      router.replace({
        pathname: "/workout/complete",
        params: {
          workoutId: workout.id,
          celebration: JSON.stringify(celebration),
        },
      });

    } catch (err) {
      Alert.alert("Save failed", "Workout saved locally. Will sync when back online.");
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      "Discard Workout?",
      "All progress will be lost.",
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            discardWorkout();
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };


  if (!activeWorkout) return null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleDiscard} style={styles.discardBtn}>
          <Text style={styles.discardText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.workoutName} numberOfLines={1}>{activeWorkout.name}</Text>
          <Text style={styles.elapsedTime}>{formatDuration(elapsedSeconds)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.finishBtn, saving && styles.finishBtnDisabled]}
          onPress={handleFinishWorkout}
          disabled={saving}
        >
          <Text style={styles.finishText}>{saving ? "Saving..." : "Finish"}</Text>
        </TouchableOpacity>
      </View>

      {/* Rest Timer Banner */}
      {restTimer.isActive && (
        <TouchableOpacity onPress={stopRestTimer}>
          <LinearGradient
            colors={["#0a1400", Colors.bgCard]}
            style={styles.restTimerBanner}
          >
            <View style={styles.restTimerLeft}>
              <Text style={styles.restTimerLabel}>REST</Text>
              <Text style={styles.restTimerTime}>{restTimer.remainingSeconds}s</Text>
            </View>
            <View style={styles.restTimerBar}>
              <View
                style={[
                  styles.restTimerProgress,
                  {
                    width: `${(restTimer.remainingSeconds / restTimer.totalSeconds) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.restTimerSkip}>Skip</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Exercises */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={120}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeWorkout.exercises.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              profile={profile}
              onAddSet={() => addSet(ex.exerciseId)}
              onRemoveSet={(localId) => removeSet(ex.exerciseId, localId)}
              onUpdateSet={(localId, field, value) => updateSet(ex.exerciseId, localId, field, value)}
              onCompleteSet={(localId) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                completeSet(ex.exerciseId, localId);
              }}
              onRemoveExercise={() => removeExercise(ex.exerciseId)}
            />
          ))}

          {/* Add Exercise */}
          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={() => setShowExercisePicker(true)}
          >
            <Text style={styles.addExerciseText}>+ Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <ExercisePickerModal
          onSelect={(ex) => {
            addExercise(ex);
            setShowExercisePicker(false);
          }}
          onClose={() => setShowExercisePicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// EXERCISE CARD
// ============================================================
function ExerciseCard({
  exercise,
  profile,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onCompleteSet,
  onRemoveExercise,
}: {
  exercise: ActiveExercise;
  profile: any;
  onAddSet: () => void;
  onRemoveSet: (localId: string) => void;
  onUpdateSet: (localId: string, field: keyof ActiveSet, value: any) => void;
  onCompleteSet: (localId: string) => void;
  onRemoveExercise: () => void;
}) {
  const completedSets = exercise.sets.filter((s) => s.isComplete).length;
  const unitSystem = profile?.unit_system || "metric";

  return (
    <View style={styles.exerciseCard}>
      {/* Exercise Header */}
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderLeft}>
          <Text style={styles.exerciseName}>{exercise.exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {exercise.exercise.muscle_groups.map((m) =>
              m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            ).join(", ")}
          </Text>
        </View>
        <View style={styles.exerciseHeaderRight}>
          <Text style={styles.setProgress}>
            {completedSets}/{exercise.targetSets} sets
          </Text>
          <TouchableOpacity onPress={onRemoveExercise} style={styles.removeExerciseBtn}>
            <Text style={styles.removeExerciseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Column Headers */}
      <View style={styles.setHeaders}>
        <Text style={[styles.setHeaderText, { width: 36 }]}>SET</Text>
        <Text style={[styles.setHeaderText, { flex: 1 }]}>WEIGHT</Text>
        <Text style={[styles.setHeaderText, { flex: 1 }]}>REPS</Text>
        <Text style={[styles.setHeaderText, { width: 50 }]}>RPE</Text>
        <Text style={[styles.setHeaderText, { width: 44 }]}></Text>
      </View>

      {/* Sets */}
      {exercise.sets.map((set) => (
        <SetRow
          key={set.localId}
          set={set}
          unitSystem={unitSystem}
          onUpdate={(field, value) => onUpdateSet(set.localId, field, value)}
          onComplete={() => onCompleteSet(set.localId)}
          onRemove={() => onRemoveSet(set.localId)}
        />
      ))}

      {/* Add Set */}
      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Text style={styles.addSetText}>+ Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// SET ROW
// ============================================================
function SetRow({
  set,
  unitSystem,
  onUpdate,
  onComplete,
  onRemove,
}: {
  set: ActiveSet;
  unitSystem: string;
  onUpdate: (field: keyof ActiveSet, value: any) => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.setRow, set.isComplete && styles.setRowComplete]}>
      {/* Set number / warmup toggle */}
      <TouchableOpacity
        style={[styles.setNumber, set.isWarmup && styles.setNumberWarmup]}
        onPress={() => onUpdate("isWarmup", !set.isWarmup)}
      >
        <Text style={[styles.setNumberText, set.isWarmup && styles.setNumberWarmupText]}>
          {set.isWarmup ? "W" : set.setNumber}
        </Text>
      </TouchableOpacity>

      {/* Weight */}
      <TextInput
        style={[styles.setInput, set.isComplete && styles.setInputComplete]}
        value={set.weight}
        onChangeText={(v) => onUpdate("weight", v)}
        placeholder="0"
        placeholderTextColor="#4b5563"
        keyboardType="decimal-pad"
        editable={!set.isComplete}
        returnKeyType="next"
      />

      {/* Reps */}
      <TextInput
        style={[styles.setInput, set.isComplete && styles.setInputComplete]}
        value={set.reps}
        onChangeText={(v) => onUpdate("reps", v)}
        placeholder="0"
        placeholderTextColor="#4b5563"
        keyboardType="number-pad"
        editable={!set.isComplete}
        returnKeyType="done"
      />

      {/* RPE */}
      <TextInput
        style={[styles.setInputSmall, set.isComplete && styles.setInputComplete]}
        value={set.rpe || ""}
        onChangeText={(v) => onUpdate("rpe", v || null)}
        placeholder="-"
        placeholderTextColor="#4b5563"
        keyboardType="decimal-pad"
        editable={!set.isComplete}
      />

      {/* Complete / Remove */}
      {set.isComplete ? (
        <TouchableOpacity style={styles.completedBadge} onPress={onRemove}>
          <Text style={styles.completedBadgeText}>✓</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.completeBtn,
            !(set.weight && set.reps) && styles.completeBtnDisabled,
          ]}
          onPress={onComplete}
          disabled={!set.weight || !set.reps}
        >
          <Text style={styles.completeBtnText}>✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================
// EXERCISE PICKER MODAL
// ============================================================
function ExercisePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  useEffect(() => {
    searchExercises();
  }, [search, selectedMuscle]);

  const searchExercises = async () => {
    let query = supabase
      .from("exercises")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (search.trim()) {
      query = query.ilike("name", `%${search.trim()}%`);
    }
    if (selectedMuscle) {
      query = query.contains("muscle_groups", [selectedMuscle]);
    }

    const { data } = await query.limit(40);
    setExercises((data || []) as Exercise[]);
  };

  const muscles = ["chest", "lats", "quads", "hamstrings", "glutes", "shoulders", "biceps", "triceps", "core"];

  return (
    <View style={styles.modal}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Exercise</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor="#6b7280"
          autoFocus
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleFilter}>
          {muscles.map((m) => (
            <Pressable
              key={m}
              style={[styles.muscleChip2, selectedMuscle === m && styles.muscleChip2Active]}
              onPress={() => setSelectedMuscle(selectedMuscle === m ? null : m)}
            >
              <Text style={[styles.muscleChip2Text, selectedMuscle === m && styles.muscleChip2TextActive]}>
                {m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={styles.exerciseList}>
          {exercises.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={styles.exerciseListItem}
              onPress={() => onSelect(ex)}
            >
              <View style={styles.exerciseListItemLeft}>
                <Text style={styles.exerciseListItemName}>{ex.name}</Text>
                <Text style={styles.exerciseListItemMeta}>
                  {ex.muscle_groups.map((m) =>
                    m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  ).join(", ")} · {ex.equipment}
                </Text>
              </View>
              <Text style={styles.exerciseListChevron}>+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgElevated,
  },
  discardBtn: { padding: 8 },
  discardText: { color: "#6b7280", fontSize: 18 },
  headerCenter: { alignItems: "center", flex: 1 },
  workoutName: { color: Colors.textBright, fontSize: 16, fontWeight: "700" },
  elapsedTime: { color: Colors.accent, fontSize: 14, fontWeight: "600" },
  finishBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  finishBtnDisabled: { opacity: 0.5 },
  finishText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  restTimerBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMid,
  },
  restTimerLeft: { alignItems: "center", width: 60 },
  restTimerLabel: { color: "#9ca3af", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  restTimerTime: { color: Colors.accent, fontSize: 22, fontWeight: "800" },
  restTimerBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.borderMid,
    borderRadius: 2,
    overflow: "hidden",
  },
  restTimerProgress: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  restTimerSkip: { color: "#6b7280", fontSize: 14, fontWeight: "500" },

  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },

  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  exerciseHeaderLeft: { flex: 1, gap: 2 },
  exerciseName: { color: Colors.textBright, fontSize: 17, fontWeight: "700" },
  exerciseMeta: { color: "#6b7280", fontSize: 13 },
  exerciseHeaderRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  setProgress: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  removeExerciseBtn: { padding: 4 },
  removeExerciseText: { color: "#4b5563", fontSize: 16 },

  setHeaders: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  setHeaderText: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  setRowComplete: { opacity: 0.6 },

  setNumber: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.bgModal,
    justifyContent: "center",
    alignItems: "center",
  },
  setNumberWarmup: { backgroundColor: Colors.infoWarmupBg },
  setNumberText: { color: "#9ca3af", fontSize: 14, fontWeight: "600" },
  setNumberWarmupText: { color: Colors.infoLight },

  setInput: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    textAlign: "center",
    color: Colors.textBright,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  setInputSmall: {
    width: 50,
    height: 44,
    backgroundColor: Colors.bgElevated,
    borderRadius: 10,
    textAlign: "center",
    color: Colors.textBright,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  setInputComplete: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBgBorder,
    color: Colors.successBright,
  },

  completeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1a2d1a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#166534",
  },
  completeBtnDisabled: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.borderMid,
    opacity: 0.4,
  },
  completeBtnText: { color: Colors.success, fontSize: 18, fontWeight: "700" },
  completedBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.successBgBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  completedBadgeText: { color: Colors.successLight, fontSize: 18, fontWeight: "700" },

  addSetBtn: {
    padding: 12,
    alignItems: "center",
  },
  addSetText: { color: Colors.accentLight, fontSize: 14, fontWeight: "600" },

  addExerciseBtn: {
    padding: 20,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.borderMid,
    borderStyle: "dashed",
  },
  addExerciseText: { color: Colors.accent, fontSize: 16, fontWeight: "600" },

  // Modal
  modal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { color: Colors.textBright, fontSize: 20, fontWeight: "700" },
  modalClose: { color: "#6b7280", fontSize: 20, padding: 4 },
  searchInput: {
    backgroundColor: Colors.bgModal,
    borderRadius: 12,
    padding: 14,
    color: Colors.textBright,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  muscleFilter: { maxHeight: 40 },
  muscleChip2: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: Colors.bgModal,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  muscleChip2Active: { backgroundColor: Colors.accentDark, borderColor: Colors.accent },
  muscleChip2Text: { color: "#9ca3af", fontSize: 13, fontWeight: "500" },
  muscleChip2TextActive: { color: Colors.accentLighter },
  exerciseList: { flex: 1 },
  exerciseListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgElevated,
  },
  exerciseListItemLeft: { flex: 1, gap: 3 },
  exerciseListItemName: { color: Colors.textBright, fontSize: 15, fontWeight: "600" },
  exerciseListItemMeta: { color: "#6b7280", fontSize: 13 },
  exerciseListChevron: { color: Colors.accent, fontSize: 22, fontWeight: "700" },
});
