// GainOS Routines
import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { useWorkoutStore } from "../../store/workout";
import { supabase } from "../../lib/supabase";
import type { Routine } from "@gainos/db";
import { Colors } from "../../constants/theme";

// ─── Types ─────────────────────────────────────────────────────────────────

type SingleRoutineTemplate = {
  name: string;
  description: string;
  exercises: string[];
  days: string[];
};

type TemplateItem =
  | ({ kind: "single" } & SingleRoutineTemplate)
  | { kind: "group"; name: string; routines: SingleRoutineTemplate[] };

// ─── Template Data ──────────────────────────────────────────────────────────

const TEMPLATES: TemplateItem[] = [
  {
    kind: "group",
    name: "Push / Pull / Legs",
    routines: [
      {
        name: "Push",
        description: "Chest, Shoulders, Triceps",
        exercises: ["Barbell Bench Press", "Overhead Press", "Incline Dumbbell Press", "Lateral Raise", "Cable Pushdown"],
        days: ["Monday", "Thursday"],
      },
      {
        name: "Pull",
        description: "Back, Biceps",
        exercises: ["Barbell Row", "Lat Pulldown", "Seated Cable Row", "Face Pull", "Barbell Curl"],
        days: ["Tuesday", "Friday"],
      },
      {
        name: "Legs",
        description: "Quads, Hamstrings, Glutes",
        exercises: ["Barbell Back Squat", "Romanian Deadlift", "Leg Press", "Leg Curl (Lying)", "Hip Thrust"],
        days: ["Wednesday", "Saturday"],
      },
    ],
  },
  {
    kind: "group",
    name: "Upper / Lower",
    routines: [
      {
        name: "Upper",
        description: "Push + Pull combined",
        exercises: ["Barbell Bench Press", "Barbell Row", "Overhead Press", "Lat Pulldown", "Dumbbell Curl", "Cable Pushdown"],
        days: ["Monday", "Thursday"],
      },
      {
        name: "Lower",
        description: "Squat, Hinge, Accessories",
        exercises: ["Barbell Back Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Leg Curl (Lying)", "Standing Calf Raise"],
        days: ["Tuesday", "Friday"],
      },
    ],
  },
  {
    kind: "single",
    name: "Full Body",
    description: "3×/week compound focus",
    exercises: ["Barbell Back Squat", "Barbell Bench Press", "Barbell Row", "Overhead Press", "Romanian Deadlift"],
    days: ["Monday", "Wednesday", "Friday"],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseGroupTag(description: string | null | undefined) {
  if (!description) return { groupName: null, text: null };
  const match = description.match(/^__group:(.+?)__(.*)$/);
  if (match) return { groupName: match[1]!, text: match[2] || null };
  return { groupName: null, text: description };
}

const MY_ROUTINES = "My Routines";

function organizeRoutines(routines: Routine[]) {
  const groups: Record<string, Routine[]> = { [MY_ROUTINES]: [] };
  for (const r of routines) {
    const { groupName } = parseGroupTag(r.description);
    const key = groupName || MY_ROUTINES;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(r);
  }
  return { groups, standalone: [] as Routine[] };
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RoutinesScreen() {
  const { profile } = useAuthStore();
  const { startWorkout, addExercise } = useWorkoutStore();
  const queryClient = useQueryClient();

  // Modal state
  const [modal, setModal] = useState<"routine" | "folder" | "explore" | "rename-folder" | "folder-menu" | "reorder-folders" | "routine-menu" | "rename-routine" | null>(null);

  // Form state
  const [routineName, setRoutineName] = useState("");
  const [routineFolder, setRoutineFolder] = useState<string>(MY_ROUTINES);
  const [folderName, setFolderName] = useState("");
  const [folderFirstRoutine, setFolderFirstRoutine] = useState("");
  const [activeFolderName, setActiveFolderName] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [renameRoutineValue, setRenameRoutineValue] = useState("");
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [folderDragState, setFolderDragState] = useState<{ fromIdx: number; dy: number } | null>(null);
  const folderHeightsRef = useRef<Record<string, number>>({});

  // Routines section collapse
  const [routinesContentH, setRoutinesContentH] = useState(0);
  const routinesAnim = useSharedValue(0);
  const routinesIsOpen = useSharedValue(false);
  useEffect(() => {
    SecureStore.getItemAsync("routines_section_open").then((val) => {
      const open = val === null ? true : val === "1";
      routinesIsOpen.value = open;
      routinesAnim.value = open ? 1 : 0;
    });
  }, []);
  const routinesBodyStyle = useAnimatedStyle(() => ({
    height: routinesAnim.value * routinesContentH,
    overflow: "hidden",
  }));
  const toggleRoutines = () => {
    routinesIsOpen.value = !routinesIsOpen.value;
    routinesAnim.value = withSpring(routinesIsOpen.value ? 1 : 0, { damping: 20, stiffness: 180, overshootClamping: true });
    SecureStore.setItemAsync("routines_section_open", routinesIsOpen.value ? "1" : "0");
  };

  const closeModal = () => {
    setModal(null);
    setRoutineName("");
    setRoutineFolder(MY_ROUTINES);
    setFolderName("");
    setFolderFirstRoutine("");
    setActiveFolderName(null);
    setRenameFolderValue("");
    setActiveRoutine(null);
    setRenameRoutineValue("");
  };

  const { data: routines } = useQuery({
    queryKey: ["routines", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("routines")
        .select(`*, routine_exercises(*, exercises(*))`)
        .eq("user_id", profile!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data as Routine[]) || [];
    },
    enabled: !!profile?.id,
  });

  const { groups } = organizeRoutines(routines || []);
  const folderNames = Object.keys(groups);

  // Keep folderOrder in sync: preserve custom order, add new, remove deleted
  // "My Routines" is always pinned first
  const groupNamesKey = folderNames.slice().sort().join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFolderOrder((prev) => {
      const kept = prev.filter((n) => groups[n]);
      const added = folderNames.filter((n) => !prev.includes(n));
      const merged = [...kept, ...added];
      // Ensure My Routines is always first
      const withoutDefault = merged.filter((n) => n !== MY_ROUTINES);
      return [MY_ROUTINES, ...withoutDefault];
    });
  }, [groupNamesKey]);

  const orderedFolderEntries = folderOrder
    .filter((n) => groups[n])
    .map((n) => [n, groups[n]!] as [string, Routine[]]);

  const myRoutinesItems = groups[MY_ROUTINES] || [];
  const programEntries = orderedFolderEntries.filter(([n]) => n !== MY_ROUTINES);

  const submitSaveFolderOrder = (ordered: string[]) => {
    setFolderOrder(ordered);
  };

  const getTargetFolderIdx = useCallback(
    (fromIdx: number, dy: number): number => {
      let tops: number[] = [];
      let top = 0;
      for (const [n] of programEntries) {
        tops.push(top);
        top += (folderHeightsRef.current[n] ?? 54) + 12;
      }
      const fromH = folderHeightsRef.current[programEntries[fromIdx]?.[0] ?? ""] ?? 54;
      const draggedCenter = (tops[fromIdx] ?? 0) + fromH / 2 + dy;
      let closest = fromIdx;
      let minDist = Infinity;
      for (let i = 0; i < tops.length; i++) {
        const h = folderHeightsRef.current[programEntries[i]?.[0] ?? ""] ?? 54;
        const dist = Math.abs(draggedCenter - ((tops[i] ?? 0) + h / 2));
        if (dist < minDist) { minDist = dist; closest = i; }
      }
      return closest;
    },
    [programEntries],
  );

  const handleFolderDragUpdate = useCallback((fromIdx: number, dy: number) => {
    setFolderDragState({ fromIdx, dy });
  }, []);

  const handleFolderDragEnd = useCallback(
    (fromIdx: number, dy: number) => {
      const to = getTargetFolderIdx(fromIdx, dy);
      if (fromIdx !== to) {
        const fromName = programEntries[fromIdx]?.[0];
        const toName = programEntries[to]?.[0];
        if (fromName && toName) {
          setFolderOrder((prev) => {
            const fromActual = prev.indexOf(fromName);
            const toActual = prev.indexOf(toName);
            if (fromActual < 0 || toActual < 0 || fromActual === toActual) return prev;
            const next = [...prev];
            const [item] = next.splice(fromActual, 1);
            next.splice(toActual, 0, item!);
            return next;
          });
        }
      }
      setFolderDragState(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [getTargetFolderIdx, programEntries],
  );

  // ── DB helpers ─────────────────────────────────────────────────────────

  const insertRoutineWithExercises = async (
    template: SingleRoutineTemplate,
    groupName?: string | null,
  ) => {
    if (!profile) return;
    const description = groupName
      ? `__group:${groupName}__${template.description}`
      : template.description;

    const { data: routine } = await supabase
      .from("routines")
      .insert({ user_id: profile.id, name: template.name, description, days: template.days })
      .select()
      .single();

    if (!routine) return;

    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name")
      .in("name", template.exercises);

    if (exercises?.length) {
      const rows = template.exercises
        .map((name, i) => {
          const ex = exercises.find((e: any) => e.name === name);
          return ex ? { routine_id: routine.id, exercise_id: ex.id, order_index: i } : null;
        })
        .filter(Boolean);
      await supabase.from("routine_exercises").insert(rows);
    }
  };

  const startFromRoutine = async (routine: Routine) => {
    startWorkout(routine.name, routine.id);
    const exercises =
      routine.routine_exercises?.sort((a, b) => a.order_index - b.order_index) || [];
    for (const re of exercises) {
      if (re.exercises) addExercise(re.exercises, re.target_sets, re.target_reps, re.rest_seconds);
    }
    router.push("/workout/active");
  };

  const handleRoutineMenu = (r: Routine) => {
    setActiveRoutine(r);
    setModal("routine-menu");
  };

  const handleDuplicateRoutine = async () => {
    if (!activeRoutine || !profile) return;
    const { data: copy } = await supabase
      .from("routines")
      .insert({ user_id: profile.id, name: `${activeRoutine.name} (Copy)`, description: activeRoutine.description })
      .select()
      .single();
    if (copy && activeRoutine.routine_exercises?.length) {
      const rows = activeRoutine.routine_exercises.map((re: any) => ({
        routine_id: copy.id,
        exercise_id: re.exercise_id,
        order_index: re.order_index,
        target_sets: re.target_sets,
        target_reps: re.target_reps,
        rest_seconds: re.rest_seconds,
      }));
      await supabase.from("routine_exercises").insert(rows);
    }
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  const handleDeleteRoutine = async () => {
    if (!activeRoutine) return;
    await supabase.from("routines").update({ is_active: false }).eq("id", activeRoutine.id);
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  const submitRenameRoutine = async () => {
    const newName = renameRoutineValue.trim();
    if (!newName || !activeRoutine) return;
    await supabase.from("routines").update({ name: newName }).eq("id", activeRoutine.id);
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  const handleFolderMenu = (name: string) => {
    setActiveFolderName(name);
    setModal("folder-menu");
  };

  const handleDeleteFolder = (name: string) => {
    if (name === MY_ROUTINES) return;
    Alert.alert("Delete Folder", `Delete "${name}" and all its routines?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const ids = (groups[name] || []).map((r) => r.id);
          if (ids.length) {
            await supabase.from("routines").update({ is_active: false }).in("id", ids);
            queryClient.invalidateQueries({ queryKey: ["routines"] });
          }
          closeModal();
        },
      },
    ]);
  };

  const submitRenameFolder = async () => {
    const newName = renameFolderValue.trim();
    if (!newName || !activeFolderName) return;
    const rts = groups[activeFolderName] || [];
    await Promise.all(
      rts.map((r) => {
        const { text } = parseGroupTag(r.description);
        return supabase
          .from("routines")
          .update({ description: `__group:${newName}__${text || ""}` })
          .eq("id", r.id);
      })
    );
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  // ── Form submissions ───────────────────────────────────────────────────

  const submitNewRoutine = async () => {
    if (!routineName.trim() || !profile) return;
    const description = `__group:${routineFolder}__`;
    await supabase.from("routines").insert({
      user_id: profile.id,
      name: routineName.trim(),
      description,
    });
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  const submitNewFolder = async () => {
    if (!folderName.trim() || !folderFirstRoutine.trim() || !profile) return;
    const description = `__group:${folderName.trim()}__`;
    await supabase.from("routines").insert({
      user_id: profile.id,
      name: folderFirstRoutine.trim(),
      description,
    });
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    closeModal();
  };

  const handleAddTemplate = async (item: TemplateItem, targetFolder: string | null) => {
    closeModal();
    if (item.kind === "single") {
      await insertRoutineWithExercises(item, targetFolder);
    } else {
      const folder = targetFolder || item.name;
      for (const t of item.routines) {
        await insertRoutineWithExercises(t, folder);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["routines"] });
  };


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        scrollEnabled={!folderDragState}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Workouts</Text>
          {(routines?.length ?? 0) > 0 && (
            <Text style={styles.titleCount}>
              {routines!.length} routine{routines!.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>

        {/* ── Primary CTA ── */}
        <Pressable
          style={styles.cta}
          onPress={() => {
            startWorkout("Empty Workout");
            router.push("/workout/active");
          }}
        >
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

        {/* ── Programs ── */}
        <View style={[styles.section, styles.programSection]}>
          <View style={[styles.sectionHeader, { marginBottom: 20 }]}>
            <Text style={styles.sectionLabel}>Programs</Text>
            <Pressable style={styles.actionChip} onPress={() => setModal("folder")}>
              <Ionicons name="add" size={14} color={Colors.accentLight} />
              <Text style={styles.actionChipText}>New Program</Text>
            </Pressable>
          </View>

          {programEntries.map(([name, rts], idx) => {
            const targetFolderIdx = folderDragState
              ? getTargetFolderIdx(folderDragState.fromIdx, folderDragState.dy)
              : -1;
            const isDraggingThis = folderDragState?.fromIdx === idx;
            let shiftY = 0;
            if (folderDragState && !isDraggingThis) {
              const from = folderDragState.fromIdx;
              const to = targetFolderIdx;
              const draggedName = programEntries[from]?.[0] ?? "";
              const draggedH = (folderHeightsRef.current[draggedName] ?? 54) + 12;
              if (from < to && idx > from && idx <= to) shiftY = -draggedH;
              else if (from > to && idx >= to && idx < from) shiftY = draggedH;
            }
            return (
              <FolderCard
                key={name}
                name={name}
                routines={rts}
                onStart={startFromRoutine}
                onMenu={handleRoutineMenu}
                onFolderMenu={handleFolderMenu}
                folderIsDragging={isDraggingThis}
                folderDragTranslate={isDraggingThis ? folderDragState!.dy : shiftY}
                folderIsTarget={!isDraggingThis && idx === targetFolderIdx && folderDragState !== null}
                onFolderDragUpdate={(dy) => handleFolderDragUpdate(idx, dy)}
                onFolderDragEnd={(dy) => handleFolderDragEnd(idx, dy)}
                onHeightChange={(h) => { folderHeightsRef.current[name] = h; }}
              />
            );
          })}

          {programEntries.length === 0 && (
            <View style={styles.emptyPrograms}>
              <Text style={styles.emptyText}>No programs yet.</Text>
            </View>
          )}
        </View>

        {/* ──Routines ── */}
        <View style={[styles.section, styles.programSection]}>
          <View style={[styles.sectionHeader, { marginBottom: 30 }]}>
            <Text style={styles.sectionLabel}>Routines</Text>
            <Pressable
              style={styles.actionChip}
              onPress={() => { setRoutineFolder(MY_ROUTINES); setModal("routine"); }}
            >
              <Ionicons name="add" size={14} color={Colors.accentLight} />
              <Text style={styles.actionChipText}>New Routine</Text>
            </Pressable>
          </View>

          {/* Collapsible folder-style row */}
          <View>
            <View style={styles.folderHeader}>
              <Pressable style={styles.folderHeaderLeft} onPress={toggleRoutines}>
                <Ionicons name="folder" size={14} color={Colors.textMuted} />
                <Text style={styles.folderName}>My Routines</Text>
                <Text style={styles.folderCount}>{myRoutinesItems.length}</Text>
              </Pressable>
            </View>

            {/* Hidden measurer */}
            <View pointerEvents="none" style={{ position: "absolute", opacity: 0, left: 0, right: 0, top: 48 }}
              onLayout={(e) => setRoutinesContentH(e.nativeEvent.layout.height)}>
              <View style={styles.listContainer}>
                {myRoutinesItems.map((r) => (
                  <MyRoutineRow key={r.id} routine={r} onStart={() => {}} onMenu={() => {}} />
                ))}
              </View>
            </View>

            <Animated.View style={routinesBodyStyle}>
              <View style={styles.listContainer}>
                {myRoutinesItems.map((r) => (
                  <MyRoutineRow
                    key={r.id}
                    routine={r}
                    onStart={() => startFromRoutine(r)}
                    onMenu={() => handleRoutineMenu(r)}
                  />
                ))}
                {myRoutinesItems.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No routines yet.</Text>
                    <Pressable onPress={() => setModal("explore")}>
                      <Text style={styles.emptyLink}>Explore templates to get started</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>

        {/* ── Explore ── */}
        <View style={styles.exploreWrapper}>
          <Pressable style={styles.exploreRow} onPress={() => setModal("explore")}>
            <Ionicons name="compass-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.exploreText}>Explore Templates</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textFaint} />
          </Pressable>
        </View>
      </ScrollView>

      {/* ── New Routine Modal ── */}
      <Modal visible={modal === "routine"} transparent animationType="slide">
        <View style={styles.sheet}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>New Routine</Text>
            <TextInput
              style={styles.input}
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="e.g. Push Day"
              placeholderTextColor={Colors.textFaint}
              autoFocus
            />
            {/* Folder picker */}
            <View style={styles.folderPickerSection}>
              <Text style={styles.folderPickerLabel}>ADD TO FOLDER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.folderChips}>
                  {folderNames.map((fn) => (
                    <Pressable
                      key={fn}
                      style={[styles.folderChip, routineFolder === fn && styles.folderChipActive]}
                      onPress={() => setRoutineFolder(fn)}
                    >
                      <Text style={[styles.folderChipText, routineFolder === fn && styles.folderChipTextActive]}>
                        {fn}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, !routineName.trim() && styles.confirmBtnDisabled]}
                onPress={submitNewRoutine}
                disabled={!routineName.trim()}
              >
                <Text style={styles.confirmBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New Folder Modal ── */}
      <Modal visible={modal === "folder"} transparent animationType="slide">
        <View style={styles.sheet}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>New Program</Text>
            <Text style={styles.sheetSubtitle}>Programs group related routines together.</Text>
            <TextInput
              style={styles.input}
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Program name, e.g. Push / Pull / Legs"
              placeholderTextColor={Colors.textFaint}
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={folderFirstRoutine}
              onChangeText={setFolderFirstRoutine}
              placeholder="First routine name"
              placeholderTextColor={Colors.textFaint}
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (!folderName.trim() || !folderFirstRoutine.trim()) && styles.confirmBtnDisabled]}
                onPress={submitNewFolder}
                disabled={!folderName.trim() || !folderFirstRoutine.trim()}
              >
                <Text style={styles.confirmBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Explore Sheet ── */}
      <Modal visible={modal === "explore"} transparent animationType="slide">
        <View style={styles.sheet}>
          <View style={[styles.sheetBox, styles.exploreSheet]}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Explore Templates</Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sheetSubtitle}>
              Adding a template creates a routine in My Routines.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.templateList}>
                {TEMPLATES.map((item) => (
                  <TemplateCard
                    key={item.name}
                    item={item}
                    folders={folderNames}
                    onAdd={(folder) => handleAddTemplate(item, folder)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Rename Folder Modal ── */}
      <Modal visible={modal === "rename-folder"} transparent animationType="slide">
        <View style={styles.sheet}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Rename Folder</Text>
            <TextInput
              style={styles.input}
              value={renameFolderValue}
              onChangeText={setRenameFolderValue}
              placeholder="Folder name"
              placeholderTextColor={Colors.textFaint}
              autoFocus
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModal("folder-menu")}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, !renameFolderValue.trim() && styles.confirmBtnDisabled]}
                onPress={submitRenameFolder}
                disabled={!renameFolderValue.trim()}
              >
                <Text style={styles.confirmBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Folder Menu Sheet ── */}
      <Modal visible={modal === "folder-menu"} transparent animationType="slide">
        <Pressable style={styles.sheet} onPress={closeModal}>
          <Pressable style={[styles.sheetBox, styles.menuSheet]}>
            <View style={styles.menuSheetHandle} />
            <Text style={styles.menuSheetTitle}>{activeFolderName}</Text>
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => setModal("reorder-folders")}
            >
              <Ionicons name="swap-vertical-outline" size={20} color={Colors.textSub} />
              <Text style={styles.menuSheetItemText}>Reorder Folders</Text>
            </Pressable>
            {activeFolderName !== MY_ROUTINES && (
              <Pressable
                style={styles.menuSheetItem}
                onPress={() => {
                  setRenameFolderValue(activeFolderName || "");
                  setModal("rename-folder");
                }}
              >
                <Ionicons name="pencil-outline" size={20} color={Colors.textSub} />
                <Text style={styles.menuSheetItemText}>Rename Folder</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => {
                setRoutineFolder(activeFolderName ?? MY_ROUTINES);
                setModal("routine");
              }}
            >
              <Ionicons name="add-outline" size={20} color={Colors.textSub} />
              <Text style={styles.menuSheetItemText}>Add New Routine</Text>
            </Pressable>
            {activeFolderName !== MY_ROUTINES && (
              <>
                <View style={styles.menuSheetDivider} />
                <Pressable
                  style={styles.menuSheetItem}
                  onPress={() => handleDeleteFolder(activeFolderName || "")}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  <Text style={[styles.menuSheetItemText, styles.menuSheetItemDestructive]}>
                    Delete Folder
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Routine Menu Sheet ── */}
      <Modal visible={modal === "routine-menu"} transparent animationType="slide">
        <Pressable style={styles.sheet} onPress={closeModal}>
          <Pressable style={[styles.sheetBox, styles.menuSheet]}>
            <View style={styles.menuSheetHandle} />
            <Text style={styles.menuSheetTitle}>{activeRoutine?.name}</Text>
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => { setRenameRoutineValue(activeRoutine?.name ?? ""); setModal("rename-routine"); }}
            >
              <Ionicons name="pencil-outline" size={20} color={Colors.textSub} />
              <Text style={styles.menuSheetItemText}>Edit Name</Text>
            </Pressable>
            <Pressable style={styles.menuSheetItem} onPress={handleDuplicateRoutine}>
              <Ionicons name="copy-outline" size={20} color={Colors.textSub} />
              <Text style={styles.menuSheetItemText}>Duplicate</Text>
            </Pressable>
            <View style={styles.menuSheetDivider} />
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => Alert.alert("Delete Routine", `Delete "${activeRoutine?.name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: handleDeleteRoutine },
              ])}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={[styles.menuSheetItemText, styles.menuSheetItemDestructive]}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Rename Routine Modal ── */}
      <Modal visible={modal === "rename-routine"} transparent animationType="slide">
        <View style={styles.sheet}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Edit Routine Name</Text>
            <TextInput
              style={styles.input}
              value={renameRoutineValue}
              onChangeText={setRenameRoutineValue}
              placeholder="Routine name"
              placeholderTextColor={Colors.textFaint}
              autoFocus
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModal("routine-menu")}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, !renameRoutineValue.trim() && styles.confirmBtnDisabled]}
                onPress={submitRenameRoutine}
                disabled={!renameRoutineValue.trim()}
              >
                <Text style={styles.confirmBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reorder Folders Sheet ── */}
      <FolderReorderSheet
        visible={modal === "reorder-folders"}
        folders={folderOrder.filter((n) => groups[n] && n !== MY_ROUTINES)}
        onClose={() => setModal("folder-menu")}
        onSave={submitSaveFolderOrder}
      />
    </SafeAreaView>
  );
}

// ─── Folder Card ────────────────────────────────────────────────────────────

const ROUTINE_H = 118;

function FolderCard({
  name,
  routines,
  onStart,
  onMenu,
  onFolderMenu,
  folderIsDragging = false,
  folderDragTranslate = 0,
  folderIsTarget = false,
  onFolderDragUpdate,
  onFolderDragEnd,
  onHeightChange,
}: {
  name: string;
  routines: Routine[];
  onStart: (r: Routine) => void;
  onMenu: (r: Routine) => void;
  onFolderMenu: (name: string) => void;
  folderIsDragging?: boolean;
  folderDragTranslate?: number;
  folderIsTarget?: boolean;
  onFolderDragUpdate?: (dy: number) => void;
  onFolderDragEnd?: (dy: number) => void;
  onHeightChange?: (h: number) => void;
}) {
  const [contentH, setContentH] = useState(0);
  const anim = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const folderKey = `folder_open_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  useEffect(() => {
    SecureStore.getItemAsync(folderKey).then((val) => {
      const open = val === null ? true : val === "1";
      isOpen.value = open;
      anim.value = open ? 1 : 0;
    });
  }, []);

  // Routine drag state (internal)
  const [routineOrder, setRoutineOrder] = useState<Routine[]>(routines);
  const [routineDragState, setRoutineDragState] = useState<{ idx: number; dy: number } | null>(null);
  const routineIdKey = routines.map((r) => r.id).join(",");
  useEffect(() => { setRoutineOrder(routines); }, [routineIdKey]);

  const routineTargetIdx = routineDragState
    ? Math.max(0, Math.min(routineOrder.length - 1, Math.round(routineDragState.idx + routineDragState.dy / ROUTINE_H)))
    : -1;

  const handleRoutineUpdate = useCallback((idx: number, dy: number) => {
    setRoutineDragState({ idx, dy });
  }, []);

  const handleRoutineDrop = useCallback((idx: number, dy: number) => {
    const to = Math.max(0, Math.min(routineOrder.length - 1, Math.round(idx + dy / ROUTINE_H)));
    setRoutineOrder((prev) => {
      if (idx === to) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setRoutineDragState(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [routineOrder.length]);

  const toggle = () => {
    isOpen.value = !isOpen.value;
    anim.value = withSpring(isOpen.value ? 1 : 0, {
      damping: 20,
      stiffness: 180,
      overshootClamping: true,
    });
    SecureStore.setItemAsync(folderKey, isOpen.value ? "1" : "0");
  };

  const bodyStyle = useAnimatedStyle(() => ({
    height: anim.value * contentH,
    overflow: "hidden",
  }));

  // Folder-level drag gesture (long press on header left)
  const folderDragGesture = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(350)
    .onBegin(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
    .onUpdate((e) => onFolderDragUpdate?.(e.translationY))
    .onEnd((e) => onFolderDragEnd?.(e.translationY));

  const avgRowH = contentH > 0 && routineOrder.length > 0
    ? Math.round(contentH / routineOrder.length)
    : ROUTINE_H;

  const rows = routineOrder.map((r, i) => (
    <RoutineCardRow
      key={r.id}
      routine={r}
      onStart={() => onStart(r)}
      onMenu={() => onMenu(r)}
      hasBorderTop={i > 0}
      index={i}
      dragState={routineDragState}
      targetIdx={routineTargetIdx}
      onDragUpdate={handleRoutineUpdate}
      onDrop={handleRoutineDrop}
      rowH={avgRowH}
    />
  ));

  return (
    <Animated.View
      style={[
        styles.folderCard,
        folderIsDragging && styles.folderCardDragging,
        folderIsTarget && styles.folderCardTarget,
        { transform: [{ translateY: folderDragTranslate }], zIndex: folderIsDragging ? 20 : 1 },
      ]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      {/* Folder Header — tap to toggle, long press to drag */}
      <GestureDetector gesture={folderDragGesture}>
        <View style={styles.folderHeader}>
          <Pressable style={styles.folderHeaderLeft} onPress={toggle}>
            <Ionicons name="folder" size={14} color={Colors.textMuted} />
            <Text style={styles.folderName}>{name}</Text>
            <Text style={styles.folderCount}>{routines.length}</Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => onFolderMenu(name)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textFaint} />
          </Pressable>
        </View>
      </GestureDetector>

      {/* Animated Body */}
      <Animated.View style={[bodyStyle, routineDragState ? { overflow: "visible" as const } : undefined]}>
        <View style={styles.folderBody}>{rows}</View>
      </Animated.View>

      {/* Hidden measurer */}
      <View
        pointerEvents="none"
        onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
        style={styles.hiddenMeasurer}
      >
        <View style={styles.folderBody}>{rows}</View>
      </View>
    </Animated.View>
  );
}

// ─── Routine Card Row (inside folder) ───────────────────────────────────────

function RoutineCardRow({
  routine,
  onStart,
  onMenu,
  hasBorderTop: _hasBorderTop,
  index,
  dragState,
  targetIdx,
  onDragUpdate,
  onDrop,
  rowH,
}: {
  routine: Routine;
  onStart: () => void;
  onMenu: () => void;
  hasBorderTop: boolean;
  index: number;
  dragState: { idx: number; dy: number } | null;
  targetIdx: number;
  onDragUpdate: (idx: number, dy: number) => void;
  onDrop: (idx: number, dy: number) => void;
  rowH: number;
}) {
  const isDragging = dragState?.idx === index;

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(300)
    .onBegin(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
    .onUpdate((e) => onDragUpdate(index, e.translationY))
    .onEnd((e) => onDrop(index, e.translationY));

  let translateY = 0;
  if (isDragging) {
    translateY = dragState?.dy ?? 0;
  } else if (dragState) {
    const from = dragState.idx;
    const to = targetIdx;
    if (from < to && index > from && index <= to) translateY = -rowH;
    else if (from > to && index >= to && index < from) translateY = rowH;
  }

  const preview = routine.routine_exercises
    ?.slice(0, 4)
    .map((re: any) => re.exercises?.name)
    .filter(Boolean)
    .join(" • ");

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.routineRow,
          isDragging && styles.routineRowDragging,
          { transform: [{ translateY }], zIndex: isDragging ? 10 : 1 },
        ]}
      >
        <View style={styles.routineRowHeader}>
          <View style={styles.routineRowInfo}>
            <Text style={styles.routineName}>{routine.name}</Text>
            {preview ? (
              <Text style={styles.routinePreview} numberOfLines={2}>{preview}</Text>
            ) : null}
          </View>
          <Pressable style={styles.menuBtn} onPress={onMenu} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textFaint} />
          </Pressable>
        </View>
        <Pressable style={styles.startBtnFull} onPress={onStart}>
          <Text style={styles.startBtnFullText}>Start Routine</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── My Routine Row (flat, no drag) ─────────────────────────────────────────

function MyRoutineRow({
  routine,
  onStart,
  onMenu,
}: {
  routine: Routine;
  onStart: () => void;
  onMenu: () => void;
}) {
  const preview = routine.routine_exercises
    ?.slice(0, 4)
    .map((re: any) => re.exercises?.name)
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={styles.routineRow}>
      <View style={styles.routineRowHeader}>
        <View style={styles.routineRowInfo}>
          <Text style={styles.routineName}>{routine.name}</Text>
          {preview ? (
            <Text style={styles.routinePreview} numberOfLines={2}>{preview}</Text>
          ) : null}
        </View>
        <Pressable style={styles.menuBtn} onPress={onMenu} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textFaint} />
        </Pressable>
      </View>
      <Pressable style={styles.startBtnFull} onPress={onStart}>
        <Text style={styles.startBtnFullText}>Start Routine</Text>
      </Pressable>
    </View>
  );
}

// ─── Template Card (in Explore) ─────────────────────────────────────────────

function TemplateCard({
  item,
  folders,
  onAdd,
}: {
  item: TemplateItem;
  folders: string[];
  onAdd: (folder: string | null) => void;
}) {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    item.kind === "group" ? item.name : null
  );

  const subtitle =
    item.kind === "group"
      ? item.routines.map((r) => r.name).join("  ·  ")
      : item.description;

  const meta =
    item.kind === "group"
      ? `${item.routines.length} routines`
      : `${item.exercises.length} exercises`;

  return (
    <View style={styles.templateCard}>
      <View style={styles.templateCardHeader}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.templateName}>{item.name}</Text>
          <Text style={styles.templateSubtitle}>{subtitle}</Text>
          <Text style={styles.templateMeta}>{meta}</Text>
        </View>
      </View>

      {/* Folder picker */}
      {showFolderPicker && (
        <View style={styles.templateFolderPicker}>
          <Text style={styles.folderPickerLabel}>SAVE TO FOLDER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.folderChips}>
              <Pressable
                style={[styles.folderChip, selectedFolder === null && styles.folderChipActive]}
                onPress={() => setSelectedFolder(null)}
              >
                <Text style={[styles.folderChipText, selectedFolder === null && styles.folderChipTextActive]}>
                  No Folder
                </Text>
              </Pressable>
              {item.kind === "group" && (
                <Pressable
                  style={[styles.folderChip, selectedFolder === item.name && styles.folderChipActive]}
                  onPress={() => setSelectedFolder(item.name)}
                >
                  <Text style={[styles.folderChipText, selectedFolder === item.name && styles.folderChipTextActive]}>
                    {item.name} (new)
                  </Text>
                </Pressable>
              )}
              {folders.map((fn) => (
                <Pressable
                  key={fn}
                  style={[styles.folderChip, selectedFolder === fn && styles.folderChipActive]}
                  onPress={() => setSelectedFolder(fn)}
                >
                  <Text style={[styles.folderChipText, selectedFolder === fn && styles.folderChipTextActive]}>
                    {fn}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View style={styles.templateCardActions}>
        {showFolderPicker ? (
          <>
            <Pressable style={styles.templateCancelBtn} onPress={() => setShowFolderPicker(false)}>
              <Text style={styles.templateCancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.templateAddBtn}
              onPress={() => { onAdd(selectedFolder); setShowFolderPicker(false); }}
            >
              <Text style={styles.templateAddBtnText}>Add to My Routines</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.templateAddBtn} onPress={() => setShowFolderPicker(true)}>
            <Text style={styles.templateAddBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll:     { paddingBottom: 120, gap: 24 },

  // ── Header ──────────────────────────────────────────────────────────────
  header:     { paddingHorizontal: 20, paddingTop: 16, gap: 2 },
  title:      { fontSize: 28, fontWeight: "800", color: Colors.textBright, letterSpacing: -0.5 },
  titleCount: { fontSize: 13, fontWeight: "500", color: Colors.textMuted, letterSpacing: -0.1 },

  // ── Primary CTA ─────────────────────────────────────────────────────────
  cta:         { marginHorizontal: 20, borderRadius: 18, overflow: "hidden" },
  ctaGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  ctaText:     { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: -0.1 },

  // ── Section ─────────────────────────────────────────────────────────────
  section:       { paddingHorizontal: 20, gap: 12 },
  programSection: {
    gap: 0,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  routinesSectionToggle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionLabel:  { fontSize: 26, fontWeight: "800", color: Colors.textBright, letterSpacing: -0.5 },
  sectionActions: { flexDirection: "row", gap: 8 },
  actionChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: "rgba(63,209,122,0.1)",
  },
  actionChipText: { fontSize: 12, fontWeight: "600", color: Colors.accentLight },

  // ── List container (standalone grouped) ─────────────────────────────────
  listContainer: { gap: 8, marginTop: 8 },

  // ── Standalone flat row ──────────────────────────────────────────────────
  standaloneRow: {
    flexDirection: "row", alignItems: "center",
    paddingRight: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.separator,
  },
  standaloneContent: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingLeft: 16, paddingRight: 4, gap: 8,
  },

  // ── Folder Card ──────────────────────────────────────────────────────────
  folderCard: {},  // no background — surfaces separate via screen bg only
  folderCardDragging: {
    opacity: 0.85, borderWidth: 1, borderColor: Colors.accent,
    shadowColor: Colors.accent, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 6, borderRadius: 10,
  },
  folderCardTarget: { borderWidth: 1, borderColor: Colors.accentBgStrong, borderRadius: 10 },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  folderHeaderLeft:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  folderName:  { fontSize: 17, fontWeight: "600", color: Colors.textBright, letterSpacing: -0.2 },
  folderCount: {
    fontSize: 12, fontWeight: "600", color: Colors.textFaint,
    backgroundColor: Colors.borderFaint,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  folderBody: { gap: 8, marginTop: 8 },

  // ── Routine card (inside folder) ─────────────────────────────────────────
  routineRow:        { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, gap: 12 },
  routineRowHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routineRowContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  routineRowActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  routineRowBorder:  {},
  startBtn:          { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(63,209,122,0.1)" },
  startBtnText:      { fontSize: 12, fontWeight: "600", color: Colors.accentLight },
  startBtnFull:      { backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center" as const },
  startBtnFullText:  { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  routineRowDragging: { opacity: 0.85 },
  routineRowTarget:   { borderTopWidth: 2, borderTopColor: Colors.accent },
  routineRowInfo:     { flex: 1, gap: 4 },
  routineName:    { fontSize: 15, fontWeight: "600", color: Colors.textBright, letterSpacing: -0.1 },
  routinePreview: { fontSize: 13, color: Colors.textMuted },
  menuBtn:        { width: 36, height: 48, alignItems: "center", justifyContent: "center" },

  // ── Hidden measurer ──────────────────────────────────────────────────────
  hiddenMeasurer: { position: "absolute", opacity: 0, left: 0, right: 0, top: 0 },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState:    { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyPrograms: { paddingVertical: 20, alignItems: "center" },
  emptyText:  { fontSize: 14, color: Colors.textFaint },
  emptyLink:  { fontSize: 14, fontWeight: "600", color: Colors.accent },

  // ── Explore row ──────────────────────────────────────────────────────────
  exploreWrapper: { marginHorizontal: 20, backgroundColor: Colors.bgCard, borderRadius: 14, overflow: "hidden" },
  exploreRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  exploreText:    { flex: 1, fontSize: 17, fontWeight: "600", color: Colors.textBright },
  exploreChevron: { marginLeft: "auto" as const },

  // ── Sheet ────────────────────────────────────────────────────────────────
  sheet:    { flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" },
  sheetBox: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  exploreSheet:  { maxHeight: "80%", paddingBottom: 40 },
  sheetTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle:    { fontSize: 18, fontWeight: "700", color: Colors.textPrimary },
  sheetSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: -6 },

  input: {
    backgroundColor: Colors.bgElevated, borderRadius: 10, padding: 14,
    color: Colors.textPrimary, fontSize: 16,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },

  // ── Folder picker (modals) ───────────────────────────────────────────────
  folderPickerSection: { gap: 8 },
  folderPickerLabel:   { fontSize: 11, fontWeight: "600", color: Colors.textFaint, letterSpacing: -0.1 },
  folderChips:         { flexDirection: "row", gap: 8 },
  folderChip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  folderChipActive:    { backgroundColor: Colors.accentBg, borderColor: "rgba(63,209,122,0.4)" },
  folderChipText:      { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  folderChipTextActive:{ color: Colors.accentLight },

  sheetActions:      { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn:         { flex: 1, padding: 14, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cancelBtnText:     { color: Colors.textMid, fontWeight: "600", fontSize: 15 },
  confirmBtn:        { flex: 1, padding: 14, alignItems: "center", borderRadius: 10, backgroundColor: Colors.accent },
  confirmBtnDisabled:{ opacity: 0.4 },
  confirmBtnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },

  // ── Template cards (Explore) ─────────────────────────────────────────────
  templateList:        { gap: 12, paddingBottom: 16 },
  templateCard:        { backgroundColor: Colors.bgDeep, borderRadius: 12, padding: 16, gap: 12 },
  templateCardHeader:  { flexDirection: "row", alignItems: "flex-start" },
  templateName:        { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  templateSubtitle:    { fontSize: 12, color: Colors.textMuted },
  templateMeta:        { fontSize: 11, color: Colors.textFaint, fontWeight: "500" },
  templateFolderPicker:{ gap: 8 },
  templateCardActions: { flexDirection: "row", gap: 8 },
  templateAddBtn:      { flex: 1, backgroundColor: Colors.accentBg, borderRadius: 9, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: Colors.accentBgMid },
  templateAddBtnText:  { fontSize: 13, fontWeight: "600", color: Colors.accentLight },
  templateCancelBtn:   { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 9, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: "center" },
  templateCancelBtnText:{ fontSize: 13, fontWeight: "500", color: Colors.textMuted },

  // ── Folder menu sheet ────────────────────────────────────────────────────
  menuSheet:             { gap: 0, paddingTop: 16, paddingBottom: 36 },
  menuSheetHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "center", marginBottom: 16 },
  menuSheetTitle:        { fontSize: 13, fontWeight: "600", color: Colors.textMuted, letterSpacing: -0.1, paddingHorizontal: 4, paddingBottom: 8 },
  menuSheetItem:         { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 4 },
  menuSheetItemText:     { fontSize: 16, fontWeight: "500", color: Colors.textLight },
  menuSheetItemDestructive: { color: Colors.error },
  menuSheetDivider:      { height: 0.5, backgroundColor: Colors.separator, marginVertical: 4 },

  // ── Reorder sheet ────────────────────────────────────────────────────────
  reorderRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.separator,
  },
  reorderRowActive: { backgroundColor: Colors.accentBgSoft, borderRadius: 10 },
  reorderRowTarget: { borderBottomColor: Colors.accent, borderBottomWidth: 2,
  },
  reorderRowName: { flex: 1, fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  dragHandle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Folder Reorder Sheet ────────────────────────────────────────────────────

function FolderReorderSheet({
  visible,
  folders,
  onClose,
  onSave,
}: {
  visible: boolean;
  folders: string[];
  onClose: () => void;
  onSave: (ordered: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [dragState, setDragState] = useState<{ idx: number; dy: number } | null>(null);

  useEffect(() => {
    if (visible) setOrder([...folders]);
  }, [visible]);

  const ITEM_H = 54;

  const getTargetIdx = useCallback(
    (fromIdx: number, dy: number) =>
      Math.max(0, Math.min(order.length - 1, Math.round(fromIdx + dy / ITEM_H))),
    [order.length],
  );

  const handleUpdate = useCallback((idx: number, dy: number) => {
    setDragState({ idx, dy });
  }, []);

  const handleDrop = useCallback(
    (idx: number, dy: number) => {
      const to = Math.max(0, Math.min(order.length - 1, Math.round(idx + dy / ITEM_H)));
      setOrder((prev) => {
        if (idx === to) return prev;
        const next = [...prev];
        const [item] = next.splice(idx, 1);
        next.splice(to, 0, item!);
        return next;
      });
      setDragState(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [order.length],
  );

  const targetIdx = dragState ? getTargetIdx(dragState.idx, dragState.dy) : -1;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheet}>
        <View style={[styles.sheetBox, { paddingBottom: 36 }]}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Reorder Folders</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.sheetSubtitle}>Hold and drag the handle to reorder.</Text>
          <ScrollView scrollEnabled={!dragState} showsVerticalScrollIndicator={false}>
            {order.map((name, index) => (
              <ReorderRow
                key={name}
                name={name}
                index={index}
                dragState={dragState}
                targetIdx={targetIdx}
                onUpdate={handleUpdate}
                onDrop={handleDrop}
              />
            ))}
          </ScrollView>
          <Pressable
            style={[styles.confirmBtn, { marginTop: 20 }]}
            onPress={() => { onSave(order); onClose(); }}
          >
            <Text style={styles.confirmBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ReorderRow({
  name,
  index,
  dragState,
  targetIdx,
  onUpdate,
  onDrop,
}: {
  name: string;
  index: number;
  dragState: { idx: number; dy: number } | null;
  targetIdx: number;
  onUpdate: (idx: number, dy: number) => void;
  onDrop: (idx: number, dy: number) => void;
}) {
  const isDragging = dragState?.idx === index;
  const isTarget = !isDragging && index === targetIdx && dragState !== null;

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((e) => onUpdate(index, e.translationY))
    .onEnd((e) => onDrop(index, e.translationY));

  const translateY = isDragging ? (dragState?.dy ?? 0) : 0;

  return (
    <Animated.View
      style={[
        styles.reorderRow,
        isDragging && styles.reorderRowActive,
        isTarget && styles.reorderRowTarget,
        { transform: [{ translateY }], zIndex: isDragging ? 10 : 1 },
      ]}
    >
      <Ionicons name="folder" size={14} color={Colors.textMuted} />
      <Text style={styles.reorderRowName} numberOfLines={1}>{name}</Text>
      <GestureDetector gesture={panGesture}>
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-three-outline" size={24} color={Colors.textMuted} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
