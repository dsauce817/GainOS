// GainOS Design System
// Color palette, spacing, typography shared across mobile + web

export const colors = {
  // Brand
  primary: "#6366f1",        // Indigo 500 — main brand
  primaryDark: "#4f46e5",    // Indigo 600
  primaryLight: "#a5b4fc",   // Indigo 300
  secondary: "#8b5cf6",      // Violet 500

  // Semantic
  success: "#22c55e",        // Green 500
  successDark: "#16a34a",
  successLight: "#86efac",
  warning: "#f59e0b",        // Amber 500
  warningLight: "#fcd34d",
  error: "#ef4444",          // Red 500
  errorLight: "#fca5a5",

  // PR/Trophy gold
  gold: "#f59e0b",
  goldDark: "#b45309",
  goldLight: "#fde68a",
  silver: "#94a3b8",
  bronze: "#cd7f32",

  // Muscle group colors
  chest: "#ef4444",          // Red
  back: "#3b82f6",           // Blue
  shoulders: "#8b5cf6",      // Violet
  arms: "#f97316",           // Orange
  legs: "#22c55e",           // Green
  core: "#eab308",           // Yellow
  cardio: "#06b6d4",         // Cyan

  // Neutrals (dark mode first)
  bg: "#0a0a0b",             // Near black
  bgCard: "#111113",
  bgElevated: "#1a1a1e",
  bgInput: "#1e1e24",
  border: "#2a2a32",
  borderLight: "#3a3a44",

  // Text
  text: "#f9fafb",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  textInverse: "#0a0a0b",

  // Status
  streak: "#f97316",         // Orange for streak fire
  pr: "#22c55e",             // Green for PRs
  trophy: "#f59e0b",         // Gold for achievements
};

export const gradients = {
  primary: ["#6366f1", "#8b5cf6"],
  success: ["#22c55e", "#16a34a"],
  gold: ["#f59e0b", "#d97706"],
  fire: ["#f97316", "#ef4444"],
  dark: ["#111113", "#0a0a0b"],
  card: ["#1a1a1e", "#111113"],
  pr: ["#22c55e", "#06b6d4"],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 34,
  display: 42,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,

  // Weights
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  black: "900",
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  }),
};

export const muscleGroupColors: Record<string, string> = {
  chest: colors.chest,
  lats: colors.back,
  mid_back: colors.back,
  lower_back: "#1d4ed8",
  upper_back: "#2563eb",
  traps: "#1e40af",
  rear_delt: "#7c3aed",
  side_delt: "#8b5cf6",
  front_delt: "#a855f7",
  shoulders: colors.shoulders,
  triceps: "#ea580c",
  biceps: "#f97316",
  forearms: "#fb923c",
  quads: "#16a34a",
  hamstrings: "#15803d",
  glutes: "#166534",
  calves: "#4ade80",
  inner_thigh: "#86efac",
  core: colors.core,
  hip_flexors: "#ca8a04",
  neck: "#64748b",
  rotator_cuff: "#475569",
  cardio: colors.cardio,
};

// Muscle group display names
export const muscleGroupLabels: Record<string, string> = {
  chest: "Chest",
  lats: "Lats",
  mid_back: "Mid Back",
  lower_back: "Lower Back",
  upper_back: "Upper Back",
  traps: "Traps",
  rear_delt: "Rear Delt",
  side_delt: "Side Delt",
  front_delt: "Front Delt",
  triceps: "Triceps",
  biceps: "Biceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  inner_thigh: "Inner Thigh",
  core: "Core",
  hip_flexors: "Hip Flexors",
  neck: "Neck",
  rotator_cuff: "Rotator Cuff",
  cardio: "Cardio",
};
