// GainOS Progress Screen
import { useState, useRef, useEffect } from "react";
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import { formatVolume, getRelativeDate } from "@gainos/utils";
import { Colors } from "../../constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = "volume" | "workouts" | "duration" | "sets";
type TimeRange = "3months" | "year" | "alltime";

const METRICS: { key: Metric; label: string }[] = [
  { key: "volume", label: "Volume" },
  { key: "workouts", label: "Workouts" },
  { key: "duration", label: "Duration" },
  { key: "sets", label: "Sets" },
];

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "3months", label: "3 Months" },
  { key: "year", label: "1 Year" },
  { key: "alltime", label: "All Time" },
];

interface WorkoutRow {
  completed_at: string;
  total_volume_kg: number;
  total_sets: number;
  duration_seconds: number | null;
}

interface BarData { key: string; label: string; value: number }

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getRangeStart(range: TimeRange): string | null {
  if (range === "alltime") return null;
  const d = new Date();
  if (range === "3months") d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getMetricVal(w: WorkoutRow, metric: Metric): number {
  if (metric === "volume") return w.total_volume_kg ?? 0;
  if (metric === "workouts") return 1;
  if (metric === "duration") return w.duration_seconds ?? 0;
  return w.total_sets ?? 0;
}

function buildBars(workouts: WorkoutRow[], range: TimeRange, metric: Metric): BarData[] {
  const agg = (ws: WorkoutRow[]) => ws.reduce((s, w) => s + getMetricVal(w, metric), 0);
  const inSlot = (w: WorkoutRow, s: Date, e: Date) => {
    const t = new Date(w.completed_at);
    return t >= s && t < e;
  };

  // 3 months → 12 weekly bars, rightmost = this week
  if (range === "3months") {
    return Array.from({ length: 12 }, (_, i) => {
      const ws = new Date();
      const day = ws.getDay();
      ws.setDate(ws.getDate() - day + (day === 0 ? -6 : 1) - (11 - i) * 7);
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      return {
        key: ws.toISOString().split("T")[0]!,
        label: ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: agg(workouts.filter(w => inSlot(w, ws, we))),
      };
    });
  }

  // 1 year → 12 monthly bars
  if (range === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        value: agg(workouts.filter(w => inSlot(w, d, next))),
      };
    });
  }

  // All time → monthly bars from first workout
  if (!workouts.length) return [];
  const sorted = [...workouts].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const first = new Date(sorted[0]!.completed_at);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const endBound = new Date();
  endBound.setDate(1);
  endBound.setMonth(endBound.getMonth() + 1);
  const bars: BarData[] = [];
  const cur = new Date(first);
  const nowYear = new Date().getFullYear();
  while (cur < endBound) {
    const next = new Date(cur);
    next.setMonth(next.getMonth() + 1);
    bars.push({
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      label: cur.getFullYear() !== nowYear
        ? cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : cur.toLocaleDateString("en-US", { month: "short" }),
      value: agg(workouts.filter(w => inSlot(w, cur, next))),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return bars;
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function getNiceMax(v: number): number {
  if (v === 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

function fmtYLabel(v: number, metric: Metric): string {
  if (v === 0) return "0";
  if (metric === "volume") return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
  if (metric === "duration") {
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    return h > 0 ? `${h}h` : `${m}m`;
  }
  return String(Math.round(v));
}

function fmtDuration(s: number): string {
  if (s === 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  return `${m}m`;
}

function getHeaderText(
  bars: BarData[],
  selectedIndex: number | null,
  metric: Metric,
  range: TimeRange,
): { value: string; period: string } {
  if (!bars.length) return { value: "—", period: "" };
  const idx = selectedIndex ?? bars.length - 1;
  const bar = bars[idx];
  if (!bar) return { value: "—", period: "" };

  const isWeekly = range === "3months";
  const offset = bars.length - 1 - idx;
  let period: string;
  if (offset === 0) period = isWeekly ? "this week" : "this month";
  else if (offset === 1) period = isWeekly ? "last week" : "last month";
  else period = isWeekly ? `${offset} weeks ago` : `${offset} months ago`;

  const v = bar.value;
  let value: string;
  if (metric === "volume") value = v === 0 ? "0 kg" : formatVolume(v);
  else if (metric === "workouts") value = `${v} workout${v !== 1 ? "s" : ""}`;
  else if (metric === "duration") value = v === 0 ? "0m" : fmtDuration(v);
  else value = `${v} set${v !== 1 ? "s" : ""}`;

  return { value, period };
}

// ─── Analytics Chart ──────────────────────────────────────────────────────────

const CHART_H = 160;
const Y_W = 38;

function AnalyticsChart({
  bars,
  metric,
  animKey,
  selectedIndex,
  onSelectBar,
}: {
  bars: BarData[];
  metric: Metric;
  animKey: string;
  selectedIndex: number | null;
  onSelectBar: (i: number | null) => void;
}) {
  const fade = useRef(new Animated.Value(1)).current;
  const prevKey = useRef(animKey);

  useEffect(() => {
    if (animKey !== prevKey.current) {
      prevKey.current = animKey;
      Animated.sequence([
        Animated.timing(fade, { toValue: 0.15, duration: 100, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [animKey]);

  if (!bars.length) {
    return (
      <View style={{ height: CHART_H + 36, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.textFaint, fontSize: 13 }}>No data for this period</Text>
      </View>
    );
  }

  const maxVal = Math.max(...bars.map(b => b.value), 0.01);
  const niceMax = getNiceMax(maxVal);
  const ticks = [0, niceMax / 3, (niceMax * 2) / 3, niceMax];

  const n = bars.length;
  const barW = n <= 12 ? 14 : n <= 24 ? 9 : 6;
  const skip = n <= 12 ? 2 : Math.ceil(n / 6);
  const hasSelection = selectedIndex !== null;

  return (
    <Animated.View style={{ opacity: fade }}>
      {/* Y-axis + chart area */}
      <View style={{ flexDirection: "row", height: CHART_H }}>
        {/* Y-axis labels aligned to grid lines */}
        <View style={{ width: Y_W, height: CHART_H, position: "relative" }}>
          {ticks.map((tick, i) => {
            const pct = i / (ticks.length - 1);
            const top = Math.round(CHART_H * (1 - pct)) - 7;
            return (
              <Text key={i} style={[styles.yLabel, { position: "absolute", top, right: 6 }]}>
                {fmtYLabel(Math.round(tick), metric)}
              </Text>
            );
          })}
        </View>

        {/* Chart area */}
        <View style={{ flex: 1, height: CHART_H, position: "relative" }}>
          {/* Grid lines */}
          {ticks.map((_, i) => {
            const pct = i / (ticks.length - 1);
            const top = Math.round(CHART_H * (1 - pct));
            return (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  {
                    top,
                    backgroundColor: i === 0
                      ? "rgba(255,255,255,0.1)"
                      : Colors.borderFainter,
                  },
                ]}
              />
            );
          })}

          {/* Bars — each column is pressable */}
          <View style={{ flexDirection: "row", height: "100%", alignItems: "flex-end" }}>
            {bars.map((bar, i) => {
              const h = bar.value > 0
                ? Math.max((bar.value / niceMax) * CHART_H, 2)
                : 0;
              const isSelected = selectedIndex === i;
              const dimmed = hasSelection && !isSelected;
              return (
                <Pressable
                  key={bar.key}
                  onPress={() => onSelectBar(isSelected ? null : i)}
                  style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" }}
                >
                  {h > 0 && (
                    <View
                      style={{
                        width: barW,
                        height: h,
                        backgroundColor: isSelected
                          ? Colors.accentLighter
                          : dimmed
                          ? Colors.accentBgMid
                          : Colors.accent,
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }}
                    />
                  )}
                  {/* Selection dot indicator */}
                  {isSelected && (
                    <View style={styles.selectionDot} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: "row", marginLeft: Y_W, marginTop: 8 }}>
        {bars.map((bar, i) => (
          <View key={bar.key} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={[
                styles.xLabel,
                selectedIndex === i && styles.xLabelSelected,
              ]}
              numberOfLines={1}
            >
              {i % skip === 0 ? bar.label : ""}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { user, profile } = useAuthStore();
  const [metric, setMetric] = useState<Metric>("volume");
  const [range, setRange] = useState<TimeRange>("3months");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showRangePicker, setShowRangePicker] = useState(false);

  // Reset selection when range or metric changes
  useEffect(() => { setSelectedIndex(null); }, [range, metric]);

  const { data: chartWorkouts, isLoading: chartLoading } = useQuery({
    queryKey: ["progress-chart", user?.id, range],
    queryFn: async () => {
      const start = getRangeStart(range);
      let q = supabase
        .from("workouts")
        .select("completed_at, total_volume_kg, total_sets, duration_seconds")
        .eq("user_id", user!.id)
        .eq("is_complete", true)
        .order("completed_at", { ascending: true });
      if (start) q = q.gte("completed_at", start);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WorkoutRow[];
    },
    enabled: !!user?.id,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["progress-stats", user?.id],
    queryFn: async () => {
      const [countRes, prsRes, recentRes] = await Promise.all([
        supabase.from("workouts").select("id", { count: "exact" }).eq("user_id", user!.id).eq("is_complete", true),
        supabase.from("personal_records").select("*, exercises(name)").eq("user_id", user!.id).eq("is_current", true).eq("pr_type", "estimated_1rm").order("value", { ascending: false }).limit(10),
        supabase.from("workouts").select("id, name, completed_at, total_volume_kg, total_sets, duration_seconds").eq("user_id", user!.id).eq("is_complete", true).order("completed_at", { ascending: false }).limit(5),
      ]);
      return {
        totalWorkouts: countRes.count ?? 0,
        prs: prsRes.data ?? [],
        recentWorkouts: recentRes.data ?? [],
      };
    },
    enabled: !!user?.id,
  });

  const bars = chartWorkouts ? buildBars(chartWorkouts, range, metric) : [];
  const animKey = `${range}-${metric}`;
  const rangeLabel = RANGES.find(r => r.key === range)?.label ?? "3 Months";
  const header = getHeaderText(bars, selectedIndex, metric, range);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Workouts" value={String(statsData?.totalWorkouts ?? 0)} icon="barbell-outline" color={Colors.accentLight} />
          <StatCard label="Streak" value={String(profile?.current_streak ?? 0)} suffix="days" icon="flame-outline" color={Colors.orange} />
          <StatCard label="Best" value={String(profile?.longest_streak ?? 0)} suffix="days" icon="trophy-outline" color={Colors.amber} />
        </View>

        {/* Activity Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Pressable style={styles.rangeBtn} onPress={() => setShowRangePicker(v => !v)}>
              <Text style={styles.rangeBtnText}>{rangeLabel}</Text>
              <Ionicons name={showRangePicker ? "chevron-up" : "chevron-down"} size={11} color={Colors.accentLight} />
            </Pressable>
          </View>

          {showRangePicker && (
            <View style={styles.rangeDropdown}>
              {RANGES.map((r, i) => (
                <Pressable
                  key={r.key}
                  style={[
                    styles.rangeItem,
                    range === r.key && styles.rangeItemActive,
                    i === RANGES.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => { setRange(r.key); setShowRangePicker(false); }}
                >
                  <Text style={[styles.rangeItemText, range === r.key && styles.rangeItemTextActive]}>
                    {r.label}
                  </Text>
                  {range === r.key && <Ionicons name="checkmark" size={14} color={Colors.accentLight} />}
                </Pressable>
              ))}
            </View>
          )}

          {/* Metric tabs */}
          <View style={styles.metricToggle}>
            {METRICS.map(m => (
              <Pressable
                key={m.key}
                style={[styles.metricBtn, metric === m.key && styles.metricBtnActive]}
                onPress={() => setMetric(m.key)}
              >
                <Text style={[styles.metricBtnText, metric === m.key && styles.metricBtnTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Chart card */}
          <View style={styles.chartCard}>
            {/* Dynamic header */}
            {!chartLoading && bars.length > 0 && (
              <View style={styles.chartHeader}>
                <Text style={styles.chartHeaderValue}>{header.value}</Text>
                <Text style={styles.chartHeaderPeriod}>{header.period}</Text>
              </View>
            )}
            {chartLoading ? (
              <ActivityIndicator color={Colors.accentLight} style={{ height: CHART_H + 36 }} />
            ) : (
              <AnalyticsChart
                bars={bars}
                metric={metric}
                animKey={animKey}
                selectedIndex={selectedIndex}
                onSelectBar={setSelectedIndex}
              />
            )}
          </View>
        </View>

        {/* Best Lifts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best Lifts</Text>
          {statsLoading ? (
            <ActivityIndicator color={Colors.accentLight} style={{ marginTop: 16 }} />
          ) : (statsData?.prs.length ?? 0) === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Complete workouts to see your PRs here</Text>
            </View>
          ) : (
            <View style={styles.prList}>
              {statsData!.prs.map((pr: any, i: number) => (
                <View
                  key={pr.id}
                  style={[styles.prRow, i === statsData!.prs.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={styles.prRank}>#{i + 1}</Text>
                  <View style={styles.prCenter}>
                    <Text style={styles.prExercise} numberOfLines={1}>{pr.exercises?.name}</Text>
                    <Text style={styles.prType}>Est. 1RM</Text>
                  </View>
                  <Text style={styles.prValue}>{Math.round(pr.value)}kg</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Workouts */}
        {(statsData?.recentWorkouts.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Workouts</Text>
              <Pressable onPress={() => router.push("/history")}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            {statsData!.recentWorkouts.map((w: any) => (
              <View key={w.id} style={styles.workoutRow}>
                <View style={styles.workoutLeft}>
                  <Text style={styles.workoutName}>{w.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {getRelativeDate(w.completed_at)} · {w.total_sets} sets · {formatVolume(w.total_volume_kg)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, suffix, icon, color }: {
  label: string; value: string; suffix?: string; icon: any; color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.statValues}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 120, gap: 24 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: "700", color: Colors.textPrimary, letterSpacing: -0.5 },

  statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 16,
    paddingTop: 16, paddingHorizontal: 12, paddingBottom: 14,
    alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: Colors.borderMid, overflow: "hidden",
  },
  statAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  statValues: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statSuffix: { fontSize: 10, color: "#6b7280", fontWeight: "500" },
  statLabel: { fontSize: 11, color: "#6b7280", textAlign: "center" },

  section: { paddingHorizontal: 20, gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary, letterSpacing: -0.2 },
  seeAll: { fontSize: 13, color: Colors.accentLight, fontWeight: "600" },

  rangeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: "rgba(163,230,53,0.1)",
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(129,140,248,0.2)",
  },
  rangeBtnText: { fontSize: 12, fontWeight: "600", color: Colors.accentLight },

  rangeDropdown: {
    backgroundColor: "#161618", borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderMid, overflow: "hidden",
    marginTop: -4,
  },
  rangeItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: "#1c1c22",
  },
  rangeItemActive: { backgroundColor: Colors.accentBgSoft },
  rangeItemText: { fontSize: 14, color: Colors.textMid },
  rangeItemTextActive: { color: Colors.accentLight, fontWeight: "600" },

  metricToggle: {
    flexDirection: "row", backgroundColor: Colors.bgCard,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: Colors.borderMid,
  },
  metricBtn: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 8 },
  metricBtnActive: { backgroundColor: "#1e1e2e", borderWidth: 1, borderColor: Colors.accentDark },
  metricBtnText: { fontSize: 12, fontWeight: "500", color: Colors.textMuted },
  metricBtnTextActive: { color: Colors.accentLight, fontWeight: "600" },

  chartCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16,
    paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.borderMid, gap: 16,
  },
  chartHeader: { paddingHorizontal: 2 },
  chartHeaderValue: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary, letterSpacing: -0.5 },
  chartHeaderPeriod: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },

  gridLine: { position: "absolute", left: 0, right: 0, height: 1 },
  yLabel: { fontSize: 10, color: Colors.textFaint, fontWeight: "500" },
  xLabel: { fontSize: 9, color: Colors.textFaint, fontWeight: "500", textAlign: "center" },
  xLabelSelected: { color: Colors.accentLight },

  selectionDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.accentLighter, marginTop: 3,
  },

  emptyCard: {
    backgroundColor: Colors.bgCard, borderRadius: 14,
    padding: 20, alignItems: "center",
    borderWidth: 1, borderColor: Colors.borderMid,
  },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: "center" },

  prList: {
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.borderMid, overflow: "hidden",
  },
  prRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: "#1c1c22", gap: 12,
  },
  prRank: { fontSize: 12, color: Colors.textMuted, fontWeight: "700", width: 24 },
  prCenter: { flex: 1, gap: 2 },
  prExercise: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary },
  prType: { fontSize: 12, color: Colors.textMuted },
  prValue: { fontSize: 16, fontWeight: "800", color: Colors.accentLight },

  workoutRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.bgCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.borderMid,
  },
  workoutLeft: { gap: 3, flex: 1 },
  workoutName: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  workoutMeta: { fontSize: 13, color: Colors.textMuted },
});
