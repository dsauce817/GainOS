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
  interpolate,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { useWorkoutStore } from "../../store/workout";
import { supabase } from "../../lib/supabase";
import type { Routine } from "@gainos/db";

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

function organizeRoutines(routines: Routine[]) {
  const groups: Record<string, Routine[]> = {};
  const standalone: Routine[] = [];
  for (const r of routines) {
    const { groupName } = parseGroupTag(r.description);
    if (groupName) {
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName]!.push(r);
    } else {
      standalone.push(r);
    }
  }
  return { groups, standalone };
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RoutinesScreen() {
  const { profile } = useAuthStore();
  const { startWorkout, addExercise } = useWorkoutStore();
  const queryClient = useQueryClient();

  // Modal state
  const [modal, setModal] = useState<"routine" | "folder" | "explore" | "rename-folder" | "folder-menu" | "reorder-folders" | null>(null);

  // Form state
  const [routineName, setRoutineName] = useState("");
  const [routineFolder, setRoutineFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderFirstRoutine, setFolderFirstRoutine] = useState("");
  const [activeFolderName, setActiveFolderName] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [folderDragState, setFolderDragState] = useState<{ fromIdx: number; dy: number } | null>(null);
  const folderHeightsRef = useRef<Record<string, number>>({});

  const closeModal = () => {
    setModal(null);
    setRoutineName("");
    setRoutineFolder(null);
    setFolderName("");
    setFolderFirstRoutine("");
    setActiveFolderName(null);
    setRenameFolderValue("");
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

  const { groups, standalone } = organizeRoutines(routines || []);
  const folderNames = Object.keys(groups);

  // Keep folderOrder in sync: preserve custom order, add new, remove deleted
  const groupNamesKey = folderNames.slice().sort().join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFolderOrder((prev) => {
      const kept = prev.filter((n) => groups[n]);
      const added = folderNames.filter((n) => !prev.includes(n));
      return [...kept, ...added];
    });
  }, [groupNamesKey]);

  const orderedFolderEntries = folderOrder
    .filter((n) => groups[n])
    .map((n) => [n, groups[n]!] as [string, Routine[]]);

  const submitSaveFolderOrder = (ordered: string[]) => {
    setFolderOrder(ordered);
  };

  const getTargetFolderIdx = useCallback(
    (fromIdx: number, dy: number): number => {
      let tops: number[] = [];
      let top = 0;
      for (const [n] of orderedFolderEntries) {
        tops.push(top);
        top += (folderHeightsRef.current[n] ?? 54) + 12;
      }
      const fromH = folderHeightsRef.current[orderedFolderEntries[fromIdx]?.[0] ?? ""] ?? 54;
      const draggedCenter = (tops[fromIdx] ?? 0) + fromH / 2 + dy;
      let closest = fromIdx;
      let minDist = Infinity;
      for (let i = 0; i < tops.length; i++) {
        const h = folderHeightsRef.current[orderedFolderEntries[i]?.[0] ?? ""] ?? 54;
        const dist = Math.abs(draggedCenter - ((tops[i] ?? 0) + h / 2));
        if (dist < minDist) { minDist = dist; closest = i; }
      }
      return closest;
    },
    [orderedFolderEntries],
  );

  const handleFolderDragUpdate = useCallback((fromIdx: number, dy: number) => {
    setFolderDragState({ fromIdx, dy });
  }, []);

  const handleFolderDragEnd = useCallback(
    (fromIdx: number, dy: number) => {
      const to = getTargetFolderIdx(fromIdx, dy);
      setFolderOrder((prev) => {
        if (fromIdx === to) return prev;
        const next = [...prev];
        const [item] = next.splice(fromIdx, 1);
        next.splice(to, 0, item!);
        return next;
      });
      setFolderDragState(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [getTargetFolderIdx],
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

  const handleRoutineMenu = (routine: Routine) => {
    Alert.alert(routine.name, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("routines").update({ is_active: false }).eq("id", routine.id);
          queryClient.invalidateQueries({ queryKey: ["routines"] });
        },
      },
    ]);
  };

  const handleFolderMenu = (name: string) => {
    setActiveFolderName(name);
    setModal("folder-menu");
  };

  const handleDeleteFolder = (name: string) => {
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
    const description = routineFolder
      ? `__group:${routineFolder}__`
      : undefined;
    await supabase.from("routines").insert({
      user_id: profile.id,
      name: routineName.trim(),
      ...(description ? { description } : {}),
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

  const hasContent = standalone.length > 0 || orderedFolderEntries.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        scrollEnabled={!folderDragState}
      >
        {/* ── Title ── */}
        <Text style={styles.title}>Routines</Text>

        {/* ── Primary CTA ── */}
        <Pressable
          style={styles.startEmptyCTA}
          onPress={() => {
            startWorkout("Empty Workout");
            router.push("/workout/active");
          }}
        >
          <Text style={styles.startEmptyText}>Start Empty Workout</Text>
        </Pressable>

        {/* ── My Routines ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>MY ROUTINES</Text>
            <View style={styles.sectionActions}>
              <Pressable style={styles.actionChip} onPress={() => setModal("routine")}>
                <Ionicons name="add" size={14} color="#818cf8" />
                <Text style={styles.actionChipText}>Routine</Text>
              </Pressable>
              <Pressable style={styles.actionChip} onPress={() => setModal("folder")}>
                <Ionicons name="folder-outline" size={13} color="#818cf8" />
                <Text style={styles.actionChipText}>Folder</Text>
              </Pressable>
            </View>
          </View>

          {/* Folders */}
          {orderedFolderEntries.map(([name, rts], idx) => {
            const targetFolderIdx = folderDragState
              ? getTargetFolderIdx(folderDragState.fromIdx, folderDragState.dy)
              : -1;
            const isDraggingThis = folderDragState?.fromIdx === idx;
            return (
              <FolderCard
                key={name}
                name={name}
                routines={rts}
                onStart={startFromRoutine}
                onMenu={handleRoutineMenu}
                onFolderMenu={handleFolderMenu}
                folderIsDragging={isDraggingThis}
                folderDragTranslate={isDraggingThis ? folderDragState!.dy : 0}
                folderIsTarget={!isDraggingThis && idx === targetFolderIdx && folderDragState !== null}
                onFolderDragUpdate={(dy) => handleFolderDragUpdate(idx, dy)}
                onFolderDragEnd={(dy) => handleFolderDragEnd(idx, dy)}
                onHeightChange={(h) => { folderHeightsRef.current[name] = h; }}
              />
            );
          })}

          {/* Standalone */}
          {standalone.map((r) => (
            <StandaloneCard
              key={r.id}
              routine={r}
              onStart={() => startFromRoutine(r)}
              onMenu={() => handleRoutineMenu(r)}
            />
          ))}

          {/* Empty state */}
          {!hasContent && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No routines yet.</Text>
              <Pressable onPress={() => setModal("explore")}>
                <Text style={styles.emptyLink}>Explore templates to get started</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Explore ── */}
        <Pressable style={styles.exploreRow} onPress={() => setModal("explore")}>
          <Ionicons name="compass-outline" size={18} color="#52525b" />
          <Text style={styles.exploreText}>Explore Templates</Text>
          <Ionicons name="chevron-forward" size={14} color="#3f3f46" style={styles.exploreChevron} />
        </Pressable>
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
              placeholderTextColor="#3f3f46"
              autoFocus
            />
            {/* Folder picker */}
            <View style={styles.folderPickerSection}>
              <Text style={styles.folderPickerLabel}>ADD TO FOLDER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.folderChips}>
                  <Pressable
                    style={[styles.folderChip, routineFolder === null && styles.folderChipActive]}
                    onPress={() => setRoutineFolder(null)}
                  >
                    <Text style={[styles.folderChipText, routineFolder === null && styles.folderChipTextActive]}>
                      None
                    </Text>
                  </Pressable>
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
            <Text style={styles.sheetTitle}>New Folder</Text>
            <Text style={styles.sheetSubtitle}>Folders group related routines together.</Text>
            <TextInput
              style={styles.input}
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name, e.g. Push / Pull / Legs"
              placeholderTextColor="#3f3f46"
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={folderFirstRoutine}
              onChangeText={setFolderFirstRoutine}
              placeholder="First routine name"
              placeholderTextColor="#3f3f46"
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
                <Ionicons name="close" size={22} color="#52525b" />
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
              placeholderTextColor="#3f3f46"
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
              <Ionicons name="swap-vertical-outline" size={20} color="#a1a1aa" />
              <Text style={styles.menuSheetItemText}>Reorder Folders</Text>
            </Pressable>
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => {
                setRenameFolderValue(activeFolderName || "");
                setModal("rename-folder");
              }}
            >
              <Ionicons name="pencil-outline" size={20} color="#a1a1aa" />
              <Text style={styles.menuSheetItemText}>Rename Folder</Text>
            </Pressable>
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => {
                setRoutineFolder(activeFolderName);
                setModal("routine");
              }}
            >
              <Ionicons name="add-outline" size={20} color="#a1a1aa" />
              <Text style={styles.menuSheetItemText}>Add New Routine</Text>
            </Pressable>
            <View style={styles.menuSheetDivider} />
            <Pressable
              style={styles.menuSheetItem}
              onPress={() => handleDeleteFolder(activeFolderName || "")}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuSheetItemText, styles.menuSheetItemDestructive]}>
                Delete Folder
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reorder Folders Sheet ── */}
      <FolderReorderSheet
        visible={modal === "reorder-folders"}
        folders={folderOrder.filter((n) => groups[n])}
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
  const anim = useSharedValue(1);
  const isOpen = useSharedValue(true);

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
  };

  const bodyStyle = useAnimatedStyle(() => ({
    height: anim.value * contentH,
    overflow: "hidden",
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(anim.value, [0, 1], [180, 0])}deg` }],
  }));

  // Folder-level drag gesture (long press on header left)
  const folderDragGesture = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(350)
    .onBegin(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
    .onUpdate((e) => onFolderDragUpdate?.(e.translationY))
    .onEnd((e) => onFolderDragEnd?.(e.translationY));

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
      {/* Folder Header */}
      <View style={styles.folderHeader}>
        <GestureDetector gesture={folderDragGesture}>
          <View style={styles.folderHeaderLeft}>
            <Ionicons name="reorder-three-outline" size={18} color="#3f3f46" />
            <Ionicons name="folder" size={14} color="#52525b" />
            <Text style={styles.folderName}>{name}</Text>
            <Text style={styles.folderCount}>{routines.length}</Text>
          </View>
        </GestureDetector>
        <View style={styles.folderHeaderRight}>
          <Pressable
            style={styles.menuBtn}
            onPress={() => onFolderMenu(name)}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#3f3f46" />
          </Pressable>
          <Pressable onPress={toggle} hitSlop={8} style={styles.menuBtn}>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={15} color="#3f3f46" />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Animated Body */}
      <Animated.View style={bodyStyle}>
        <View style={[styles.folderBody, routineDragState && { overflow: "visible" }]}>{rows}</View>
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
  hasBorderTop,
  index,
  dragState,
  targetIdx,
  onDragUpdate,
  onDrop,
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
}) {
  const isDragging = dragState?.idx === index;
  const isTarget = !isDragging && index === targetIdx && dragState !== null;

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(300)
    .onBegin(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
    .onUpdate((e) => onDragUpdate(index, e.translationY))
    .onEnd((e) => onDrop(index, e.translationY));

  const translateY = isDragging ? (dragState?.dy ?? 0) : 0;

  const preview = routine.routine_exercises
    ?.slice(0, 3)
    .map((re: any) => re.exercises?.name)
    .filter(Boolean)
    .join(" · ");

  return (
    <Animated.View
      style={[
        styles.routineRow,
        hasBorderTop && styles.routineRowBorder,
        isDragging && styles.routineRowDragging,
        isTarget && styles.routineRowTarget,
        { transform: [{ translateY }], zIndex: isDragging ? 10 : 1 },
      ]}
    >
      <View style={styles.routineRowTop}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.routineDragHandle}>
            <Ionicons name="reorder-three-outline" size={18} color="#3f3f46" />
          </View>
        </GestureDetector>
        <View style={styles.routineRowInfo}>
          <Text style={styles.routineName}>{routine.name}</Text>
          {preview ? (
            <Text style={styles.routinePreview} numberOfLines={1}>{preview}</Text>
          ) : null}
        </View>
        <Pressable style={styles.menuBtn} onPress={onMenu}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#3f3f46" />
        </Pressable>
      </View>
      <Pressable style={styles.startRoutineBtn} onPress={onStart}>
        <Text style={styles.startRoutineBtnText}>Start Routine</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Standalone Card ────────────────────────────────────────────────────────

function StandaloneCard({
  routine,
  onStart,
  onMenu,
}: {
  routine: Routine;
  onStart: () => void;
  onMenu: () => void;
}) {
  const preview = routine.routine_exercises
    ?.slice(0, 3)
    .map((re: any) => re.exercises?.name)
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.standaloneCard}>
      <View style={styles.routineRowTop}>
        <View style={styles.routineRowInfo}>
          <Text style={styles.routineName}>{routine.name}</Text>
          {preview ? (
            <Text style={styles.routinePreview} numberOfLines={1}>{preview}</Text>
          ) : null}
        </View>
        <Pressable style={styles.menuBtn} onPress={onMenu}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#3f3f46" />
        </Pressable>
      </View>
      <Pressable style={styles.startRoutineBtn} onPress={onStart}>
        <Text style={styles.startRoutineBtnText}>Start Routine</Text>
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
  container: { flex: 1, backgroundColor: "#0a0a0b" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 28 },

  title: { fontSize: 32, fontWeight: "800", color: "#f4f4f5", letterSpacing: -1, paddingTop: 8 },

  // Primary CTA
  startEmptyCTA: {
    backgroundColor: "#f4f4f5",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#f4f4f5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  startEmptyText: { fontSize: 16, fontWeight: "700", color: "#0a0a0b", letterSpacing: 0.1 },

  // Section
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionActions: { flexDirection: "row", gap: 8 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.1)",
  },
  actionChipText: { fontSize: 12, fontWeight: "600", color: "#818cf8" },

  // Folder Card
  folderCard: {
    backgroundColor: "#111113",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  folderCardDragging: {
    opacity: 0.85,
    borderColor: "#6366f1",
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  folderCardTarget: {
    borderColor: "rgba(99,102,241,0.5)",
    backgroundColor: "rgba(99,102,241,0.05)",
  },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  folderHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  folderHeaderRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  folderName: { fontSize: 14, fontWeight: "600", color: "#a1a1aa", letterSpacing: 0.1 },
  folderCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3f3f46",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  folderBody: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  // Routine Row (inside folder)
  routineRow: { padding: 16, gap: 12 },
  routineRowBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  routineRowDragging: { opacity: 0.85, backgroundColor: "rgba(99,102,241,0.08)" },
  routineRowTarget: { borderTopWidth: 2, borderTopColor: "#6366f1" },
  routineRowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routineRowInfo: { flex: 1, gap: 4 },
  routineDragHandle: { justifyContent: "center", alignItems: "center", paddingRight: 2, paddingTop: 2 },
  routineName: { fontSize: 16, fontWeight: "700", color: "#f4f4f5" },
  routinePreview: { fontSize: 12, color: "#52525b", lineHeight: 17 },
  menuBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginTop: 2 },

  // Start Routine Button (full-width, primary)
  startRoutineBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  startRoutineBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Standalone Card
  standaloneCard: {
    backgroundColor: "#111113",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 12,
  },

  // Hidden measurer
  hiddenMeasurer: { position: "absolute", opacity: 0, left: 0, right: 0, top: 0 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: "#3f3f46" },
  emptyLink: { fontSize: 14, fontWeight: "600", color: "#6366f1" },

  // Explore Row
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#111113",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  exploreText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#52525b" },
  exploreChevron: { marginLeft: "auto" },

  // Sheet
  sheet: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  sheetBox: {
    backgroundColor: "#111113",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  exploreSheet: { maxHeight: "80%", paddingBottom: 40 },
  sheetTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#f4f4f5" },
  sheetSubtitle: { fontSize: 13, color: "#52525b", marginTop: -6 },

  input: {
    backgroundColor: "#1a1a1e",
    borderRadius: 10,
    padding: 14,
    color: "#f4f4f5",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  // Folder picker (inside modals)
  folderPickerSection: { gap: 8 },
  folderPickerLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3f3f46",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  folderChips: { flexDirection: "row", gap: 8 },
  folderChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  folderChipActive: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "rgba(99,102,241,0.4)",
  },
  folderChipText: { fontSize: 13, fontWeight: "500", color: "#52525b" },
  folderChipTextActive: { color: "#818cf8" },

  sheetActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelBtnText: { color: "#71717a", fontWeight: "600", fontSize: 15 },
  confirmBtn: { flex: 1, padding: 14, alignItems: "center", borderRadius: 10, backgroundColor: "#6366f1" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Template cards (inside Explore)
  templateList: { gap: 12, paddingBottom: 16 },
  templateCard: {
    backgroundColor: "#0f0f11",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    gap: 12,
  },
  templateCardHeader: { flexDirection: "row", alignItems: "flex-start" },
  templateName: { fontSize: 15, fontWeight: "700", color: "#f4f4f5" },
  templateSubtitle: { fontSize: 12, color: "#52525b" },
  templateMeta: { fontSize: 11, color: "#3f3f46", fontWeight: "500" },
  templateFolderPicker: { gap: 8 },
  templateCardActions: { flexDirection: "row", gap: 8 },
  templateAddBtn: {
    flex: 1,
    backgroundColor: "rgba(99,102,241,0.15)",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  templateAddBtnText: { fontSize: 13, fontWeight: "600", color: "#818cf8" },
  templateCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
  },
  templateCancelBtnText: { fontSize: 13, fontWeight: "500", color: "#52525b" },

  // Folder menu sheet
  menuSheet: { gap: 0, paddingTop: 16, paddingBottom: 36 },
  menuSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignSelf: "center",
    marginBottom: 16,
  },
  menuSheetTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  menuSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  menuSheetItemText: { fontSize: 16, fontWeight: "500", color: "#d4d4d8" },
  menuSheetItemDestructive: { color: "#ef4444" },
  menuSheetDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 4,
  },

  // Reorder sheet
  reorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  reorderRowActive: {
    backgroundColor: "rgba(99,102,241,0.08)",
    borderRadius: 10,
  },
  reorderRowTarget: {
    borderBottomColor: "#6366f1",
    borderBottomWidth: 2,
  },
  reorderRowName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#f4f4f5" },
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
              <Ionicons name="close" size={22} color="#52525b" />
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
      <Ionicons name="folder" size={14} color="#52525b" />
      <Text style={styles.reorderRowName} numberOfLines={1}>{name}</Text>
      <GestureDetector gesture={panGesture}>
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-three-outline" size={24} color="#52525b" />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
