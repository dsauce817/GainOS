// GainOS Fitness Utilities
// All calculation logic shared between mobile and web

// ============================================================
// 1RM ESTIMATIONS
// ============================================================

/** Epley formula: most common, works well 1-10+ reps */
export function epley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Brzycki formula: more accurate for lower rep ranges */
export function brzycki1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round((weight * (36 / (37 - reps))) * 10) / 10;
}

/** Lander formula */
export function lander1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round((100 * weight) / (101.3 - 2.67123 * reps) * 10) / 10;
}

/** Average of multiple formulas for best estimate */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  const avg = (epley1RM(weight, reps) + brzycki1RM(weight, reps) + lander1RM(weight, reps)) / 3;
  return Math.round(avg * 10) / 10;
}

/** Get weight for target % of 1RM */
export function percentOf1RM(oneRM: number, percent: number): number {
  return Math.round((oneRM * (percent / 100)) / 2.5) * 2.5;
}

/** RPE-based weight calculator */
export function rpeToPercent(rpe: number, reps: number): number {
  // Based on RPE chart by Mike Tuchscherer
  const rpeChart: Record<number, Record<number, number>> = {
    10: { 1: 100, 2: 96, 3: 92, 4: 89, 5: 86, 6: 83, 7: 81, 8: 79, 9: 77, 10: 75 },
    9.5: { 1: 98, 2: 94, 3: 91, 4: 88, 5: 85, 6: 82, 7: 80, 8: 78, 9: 76, 10: 74 },
    9: { 1: 96, 2: 92, 3: 89, 4: 86, 5: 83, 6: 81, 7: 79, 8: 77, 9: 75, 10: 73 },
    8.5: { 1: 94, 2: 91, 3: 88, 4: 85, 5: 82, 6: 80, 7: 78, 8: 76, 9: 74, 10: 72 },
    8: { 1: 92, 2: 89, 3: 86, 4: 83, 5: 81, 6: 79, 7: 77, 8: 75, 9: 73, 10: 71 },
    7.5: { 1: 91, 2: 88, 3: 85, 4: 82, 5: 80, 6: 78, 7: 76, 8: 74, 9: 72, 10: 70 },
    7: { 1: 89, 2: 86, 3: 83, 4: 81, 5: 79, 6: 77, 7: 75, 8: 73, 9: 71, 10: 69 },
  };
  const rpeRow = rpeChart[rpe] || rpeChart[8]!;
  return rpeRow[Math.min(reps, 10)] || 75;
}

// ============================================================
// VOLUME CALCULATIONS
// ============================================================

export interface SetData {
  weight_kg: number;
  reps: number;
  is_warmup?: boolean;
}

export function calculateVolume(sets: SetData[]): number {
  return sets
    .filter(s => !s.is_warmup)
    .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
}

export function calculateRelativeVolume(sets: SetData[], bodyweightKg: number): number {
  return calculateVolume(sets) / bodyweightKg;
}

/** Count working sets (non-warmup) */
export function countWorkingSets(sets: SetData[]): number {
  return sets.filter(s => !s.is_warmup).length;
}

// ============================================================
// WEEKLY VOLUME RECOMMENDATIONS
// ============================================================

export interface MuscleVolumeRec {
  muscle: string;
  mev: number;  // Minimum Effective Volume (sets/week)
  mav: number;  // Maximum Adaptive Volume (sets/week)
  mrv: number;  // Maximum Recoverable Volume (sets/week)
}

export const MUSCLE_VOLUME_RECOMMENDATIONS: MuscleVolumeRec[] = [
  { muscle: "chest",       mev: 8,  mav: 12, mrv: 20 },
  { muscle: "lats",        mev: 8,  mav: 14, mrv: 22 },
  { muscle: "mid_back",    mev: 8,  mav: 14, mrv: 25 },
  { muscle: "lower_back",  mev: 6,  mav: 9,  mrv: 15 },
  { muscle: "front_delt",  mev: 6,  mav: 8,  mrv: 16 },
  { muscle: "side_delt",   mev: 8,  mav: 16, mrv: 26 },
  { muscle: "rear_delt",   mev: 6,  mav: 16, mrv: 26 },
  { muscle: "traps",       mev: 12, mav: 20, mrv: 26 },
  { muscle: "triceps",     mev: 6,  mav: 14, mrv: 20 },
  { muscle: "biceps",      mev: 8,  mav: 14, mrv: 20 },
  { muscle: "forearms",    mev: 4,  mav: 12, mrv: 20 },
  { muscle: "quads",       mev: 8,  mav: 16, mrv: 20 },
  { muscle: "hamstrings",  mev: 6,  mav: 10, mrv: 20 },
  { muscle: "glutes",      mev: 4,  mav: 12, mrv: 20 },
  { muscle: "calves",      mev: 8,  mav: 16, mrv: 22 },
  { muscle: "core",        mev: 6,  mav: 16, mrv: 20 },
];

export function getMuscleVolumeStatus(
  muscle: string,
  weeklySets: number
): "insufficient" | "mev" | "optimal" | "high" | "mrv_exceeded" {
  const rec = MUSCLE_VOLUME_RECOMMENDATIONS.find(m => m.muscle === muscle);
  if (!rec) return "optimal";
  if (weeklySets < rec.mev) return "insufficient";
  if (weeklySets < rec.mav) return "mev";
  if (weeklySets <= rec.mrv) return "optimal";
  if (weeklySets <= rec.mrv + 5) return "high";
  return "mrv_exceeded";
}

// ============================================================
// PROGRESSIVE OVERLOAD RECOMMENDATIONS
// ============================================================

export interface ProgressionSuggestion {
  newWeightKg: number;
  targetReps: string;
  rationale: string;
}

export function suggestProgression(
  lastSetWeight: number,
  lastSetReps: number,
  targetRepRange: string, // e.g., "8-12"
  equipment: "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight"
): ProgressionSuggestion {
  const [minReps, maxReps] = targetRepRange.split("-").map(Number);
  const targetMin = minReps || 8;
  const targetMax = maxReps || 12;

  // Standard increment sizes by equipment
  const increments = {
    barbell: 2.5,
    dumbbell: 2.0,
    machine: 5.0,
    cable: 2.5,
    bodyweight: 0,
  };

  const increment = increments[equipment] || 2.5;

  if (lastSetReps >= targetMax!) {
    // Hit top of rep range → increase weight
    const newWeight = lastSetWeight + increment;
    return {
      newWeightKg: newWeight,
      targetReps: `${targetMin}-${targetMax}`,
      rationale: `You hit ${lastSetReps} reps at ${lastSetWeight}kg — time to add ${increment}kg!`,
    };
  } else if (lastSetReps >= targetMin!) {
    // In target range → keep same weight, aim for more reps
    return {
      newWeightKg: lastSetWeight,
      targetReps: `${lastSetReps + 1}-${targetMax}`,
      rationale: `Keep ${lastSetWeight}kg and aim for ${lastSetReps + 1}+ reps this set.`,
    };
  } else {
    // Below target range → keep or reduce weight
    return {
      newWeightKg: lastSetWeight,
      targetReps: `${targetMin}-${targetMax}`,
      rationale: `Stay at ${lastSetWeight}kg and focus on hitting ${targetMin} clean reps.`,
    };
  }
}

// ============================================================
// DELOAD DETECTION
// ============================================================

export interface DeloadRecommendation {
  needed: boolean;
  reason: string[];
  suggestion: string;
}

export function checkDeloadNeeded(
  weeksOfHighVolume: number,
  recentPRs: number,
  avgRPE: number,
  sleepHoursAvg: number,
  jointPainReported: boolean
): DeloadRecommendation {
  const reasons: string[] = [];
  let needed = false;

  if (weeksOfHighVolume >= 4) {
    needed = true;
    reasons.push(`${weeksOfHighVolume} consecutive weeks of high volume training`);
  }
  if (avgRPE > 8.5 && weeksOfHighVolume >= 2) {
    needed = true;
    reasons.push(`Average RPE of ${avgRPE.toFixed(1)} — high systemic fatigue`);
  }
  if (sleepHoursAvg < 6.5) {
    needed = true;
    reasons.push(`Averaging only ${sleepHoursAvg.toFixed(1)}h sleep — recovery is compromised`);
  }
  if (jointPainReported) {
    needed = true;
    reasons.push("Joint discomfort reported — proactive deload recommended");
  }
  if (recentPRs === 0 && weeksOfHighVolume >= 3) {
    reasons.push("No recent PRs — accumulated fatigue may be masking fitness");
  }

  return {
    needed,
    reason: reasons,
    suggestion: needed
      ? "Take a 1-week deload: reduce volume by 40-50%, keep intensity (weight) similar. Focus on technique and recovery."
      : "No deload needed. Keep pushing but monitor recovery signals.",
  };
}

// ============================================================
// UNIT CONVERSIONS
// ============================================================

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

export function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function formatWeight(kg: number, unitSystem: "metric" | "imperial"): string {
  if (unitSystem === "imperial") {
    return `${kgToLbs(kg)} lbs`;
  }
  return `${kg} kg`;
}

// ============================================================
// STREAK CALCULATIONS
// ============================================================

export function calculateStreak(workoutDates: Date[]): number {
  if (workoutDates.length === 0) return 0;

  const sorted = [...workoutDates].sort((a, b) => b.getTime() - a.getTime());
  let streak = 0;
  let expectedDate = new Date();
  expectedDate.setHours(0, 0, 0, 0);

  for (const date of sorted) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((expectedDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      expectedDate = d;
    } else {
      break;
    }
  }

  return streak;
}

// ============================================================
// NUTRITION CALCULATIONS
// ============================================================

/** Mifflin-St Jeor BMR */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: "male" | "female"
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

export function calculateMacroTargets(
  tdee: number,
  goal: "cut" | "bulk" | "recomp" | "maintain",
  bodyweightKg: number
): { calories: number; proteinG: number; carbsG: number; fatsG: number } {
  const calorieAdjustments = {
    cut: -400,
    bulk: 300,
    recomp: 0,
    maintain: 0,
  };

  const calories = tdee + calorieAdjustments[goal];
  const proteinG = Math.round(bodyweightKg * 2.2); // 2.2g per kg bodyweight
  const fatsG = Math.round(calories * 0.25 / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatsG * 9) / 4);

  return { calories, proteinG, carbsG, fatsG };
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

export function formatPRType(prType: string): string {
  const labels: Record<string, string> = {
    weight: "Weight PR",
    reps: "Rep PR",
    estimated_1rm: "Estimated 1RM PR",
    volume: "Volume PR",
  };
  return labels[prType] || prType;
}

export function getRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ============================================================
// REST TIMER
// ============================================================

export const DEFAULT_REST_TIMES = {
  compound_heavy: 180,   // 3 min for heavy compounds (deadlift, squat, bench)
  compound_moderate: 120, // 2 min for moderate compounds
  isolation: 60,         // 1 min for isolation
  superset: 45,          // 45s between superset exercises
};

export function getRecommendedRest(
  exercise: { category: string },
  weight: number,
  estimated1RM: number
): number {
  const intensityPct = estimated1RM > 0 ? (weight / estimated1RM) * 100 : 0;

  if (exercise.category === "compound") {
    if (intensityPct > 80) return DEFAULT_REST_TIMES.compound_heavy!;
    return DEFAULT_REST_TIMES.compound_moderate!;
  }
  return DEFAULT_REST_TIMES.isolation!;
}
