import { create } from "zustand";
import type { ActiveWorkout, ActiveExercise, ActiveSet, Exercise } from "@gainos/db";
import { estimated1RM } from "@gainos/utils";

// Simple UUID v4 implementation without external dep
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  elapsedSeconds: number;
  restTimer: {
    isActive: boolean;
    remainingSeconds: number;
    totalSeconds: number;
    exerciseId: string | null;
  };

  // Workout actions
  startWorkout: (name: string, routineId?: string, exercises?: ActiveExercise[]) => void;
  endWorkout: () => ActiveWorkout | null;
  discardWorkout: () => void;

  // Exercise actions
  addExercise: (exercise: Exercise, targetSets?: number, targetReps?: string, restSeconds?: number) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;

  // Set actions
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, localId: string) => void;
  updateSet: (exerciseId: string, localId: string, field: keyof ActiveSet, value: string | boolean | null) => void;
  completeSet: (exerciseId: string, localId: string) => void;

  // Timer actions
  startRestTimer: (seconds: number, exerciseId: string) => void;
  stopRestTimer: () => void;
  tickTimer: () => void;
  tickRestTimer: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  activeWorkout: null,
  elapsedSeconds: 0,
  restTimer: {
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    exerciseId: null,
  },

  startWorkout: (name, routineId, exercises = []) => {
    set({
      activeWorkout: {
        id: generateId(),
        name,
        routineId: routineId || null,
        startedAt: new Date(),
        exercises,
      },
      elapsedSeconds: 0,
    });
  },

  endWorkout: () => {
    const { activeWorkout } = get();
    return activeWorkout;
  },

  discardWorkout: () => {
    set({
      activeWorkout: null,
      elapsedSeconds: 0,
      restTimer: { isActive: false, remainingSeconds: 0, totalSeconds: 0, exerciseId: null },
    });
  },

  addExercise: (exercise, targetSets = 3, targetReps = "8-12", restSeconds = 90) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const newExercise: ActiveExercise = {
      exerciseId: exercise.id,
      exercise,
      sets: [
        {
          localId: generateId(),
          setNumber: 1,
          weight: "",
          reps: "",
          rpe: null,
          isWarmup: false,
          isComplete: false,
          completedAt: null,
        },
      ],
      targetSets,
      targetReps,
      restSeconds,
      notes: null,
    };

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: [...activeWorkout.exercises, newExercise],
      },
    });
  },

  removeExercise: (exerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.filter((e) => e.exerciseId !== exerciseId),
      },
    });
  },

  reorderExercises: (fromIndex, toIndex) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const exercises = [...activeWorkout.exercises];
    const [moved] = exercises.splice(fromIndex, 1);
    if (moved) exercises.splice(toIndex, 0, moved);
    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  addSet: (exerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = activeWorkout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;

      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [
          ...ex.sets,
          {
            localId: generateId(),
            setNumber: ex.sets.length + 1,
            weight: lastSet?.weight || "",
            reps: lastSet?.reps || "",
            rpe: null,
            isWarmup: false,
            isComplete: false,
            completedAt: null,
          },
        ],
      };
    });

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  removeSet: (exerciseId, localId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = activeWorkout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets
          .filter((s) => s.localId !== localId)
          .map((s, i) => ({ ...s, setNumber: i + 1 })),
      };
    });

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  updateSet: (exerciseId, localId, field, value) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const exercises = activeWorkout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) =>
          s.localId === localId ? { ...s, [field]: value } : s
        ),
      };
    });

    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  completeSet: (exerciseId, localId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    let restSeconds = 90;

    const exercises = activeWorkout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      restSeconds = ex.restSeconds;

      return {
        ...ex,
        sets: ex.sets.map((s) =>
          s.localId === localId
            ? { ...s, isComplete: true, completedAt: new Date() }
            : s
        ),
      };
    });

    set({ activeWorkout: { ...activeWorkout, exercises } });

    // Auto-start rest timer
    get().startRestTimer(restSeconds, exerciseId);
  },

  startRestTimer: (seconds, exerciseId) => {
    set({
      restTimer: {
        isActive: true,
        remainingSeconds: seconds,
        totalSeconds: seconds,
        exerciseId,
      },
    });
  },

  stopRestTimer: () => {
    set({
      restTimer: { isActive: false, remainingSeconds: 0, totalSeconds: 0, exerciseId: null },
    });
  },

  tickTimer: () => {
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  tickRestTimer: () => {
    const { restTimer } = get();
    if (!restTimer.isActive) return;

    if (restTimer.remainingSeconds <= 1) {
      set({
        restTimer: { isActive: false, remainingSeconds: 0, totalSeconds: 0, exerciseId: null },
      });
    } else {
      set({
        restTimer: {
          ...restTimer,
          remainingSeconds: restTimer.remainingSeconds - 1,
        },
      });
    }
  },
}));
