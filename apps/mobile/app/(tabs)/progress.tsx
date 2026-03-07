// GainOS Progress Screen — Performance Analytics
import { useState, useRef, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/auth";
import { Colors } from "../../constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = "volume" | "workouts" | "sets" | "duration";
type TimeRange = "3months" | "year" | "alltime";

const METRICS: { key: Metric; label: string }[] = [
  { key: "volume",   label: "Volume" },
  { key: "workouts", label: "Workouts" },
  { key: "sets",     label: "Sets" },
  { key: "duration", label: "Duration" },
];

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "3months",  label: "3M" },
  { key: "year",     label: "1Y" },
  { key: "alltime",  label: "All" },
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
  if (metric === "volume")   return w.total_volume_kg ?? 0;
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

  // alltime → monthly bars from first workout
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

// ─── Display helpers ──────────────────────────────────────────────────────────

function getNiceMax(v: number): number {
  if (v === 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

function formatHeroDisplay(value: number, metric: Metric): { value: string; unit: string } {
  if (metric === "volume") {
    if (value === 0) return { value: "0", unit: "kg" };
    if (value >= 1000) return { value: (value / 1000).toFixed(1), unit: "t" };
    return { value: String(Math.round(value)), unit: "kg" };
  }
  if (metric === "workouts") {
    return { value: String(Math.round(value)), unit: "sessions" };
  }
  if (metric === "sets") {
    return { value: String(Math.round(value)), unit: "sets" };
  }
  // duration in seconds
  if (value === 0) return { value: "0", unit: "min" };
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  if (h > 0) return { value: `${h}`, unit: `h ${m}m` };
  return { value: `${m}`, unit: "min" };
}

function getPeriodLabel(range: TimeRange, selectedIndex: number | null, bars: BarData[]): string {
  if (selectedIndex === null) {
    if (range === "3months") return "past 3 months";
    if (range === "year")    return "past 12 months";
    return "all time";
  }
  const offset = bars.length - 1 - selectedIndex;
  const isWeekly = range === "3months";
  if (offset === 0) return isWeekly ? "this week"  : "this month";
  if (offset === 1) return isWeekly ? "last week"  : "last month";
  return isWeekly ? `${offset} weeks ago` : `${offset} months ago`;
}

function computeTrend(bars: BarData[], range: TimeRange): number | null {
  if (bars.length < 4) return null;
  let recent: number, prior: number;
  if (range === "alltime") {
    recent = bars.slice(-3).reduce((s, b) => s + b.value, 0);
    prior  = bars.slice(-6, -3).reduce((s, b) => s + b.value, 0);
  } else {
    const half = Math.floor(bars.length / 2);
    recent = bars.slice(half).reduce((s, b) => s + b.value, 0);
    prior  = bars.slice(0, half).reduce((s, b) => s + b.value, 0);
  }
  if (prior === 0) return null;
  return Math.round((recent - prior) / prior * 100);
}

function fmtStripVolume(kg: number): string {
  if (kg === 0) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

// ─── Analytics Chart ──────────────────────────────────────────────────────────

const CHART_H = 240;

function AnalyticsChart({
  bars,
  animKey,
  range,
  selectedIndex,
  onSelectBar,
}: {
  bars: BarData[];
  animKey: string;
  range: TimeRange;
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
        Animated.timing(fade, { toValue: 1,    duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [animKey]);

  if (!bars.length) {
    return (
      <View style={{ height: CHART_H + 28, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.textFaint, fontSize: 13 }}>No data for this period</Text>
      </View>
    );
  }

  const maxVal  = Math.max(...bars.map(b => b.value), 0.01);
  const niceMax = getNiceMax(maxVal);
  const n    = bars.length;
  const barW = n <= 12 ? 14 : n <= 24 ? 9 : 6;
  const hasSel  = selectedIndex !== null;

  return (
    <Animated.View style={{ opacity: fade }}>

      {/* Chart area */}
      <View style={{ height: CHART_H, position: "relative" }}>

        {/* Baseline only */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 1, backgroundColor: "rgba(255,255,255,0.08)",
        }} />

        {/* Bars */}
        <View style={{ flexDirection: "row", height: "100%", alignItems: "flex-end" }}>
          {bars.map((bar, i) => {
            const h = bar.value > 0
              ? Math.max((bar.value / niceMax) * CHART_H, 2)
              : 0;
            const isSelected = selectedIndex === i;
            const dimmed     = hasSel && !isSelected;

            return (
              <Pressable
                key={bar.key}
                onPress={() => onSelectBar(isSelected ? null : i)}
                style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" }}
              >
                {h > 0 && (
                  <View style={{
                    width: barW,
                    height: h,
                    backgroundColor: isSelected
                      ? Colors.accentLighter
                      : dimmed
                      ? "rgba(63,209,122,0.18)"
                      : Colors.accent,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }} />
                )}
                {isSelected && <View style={styles.selectionDot} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* X-axis — adaptive density */}
      {(() => {
        // 3M = weekly bars with "Dec 1" labels (wider) → fewer labels
        // 1Y/alltime = monthly bars with "Dec" labels (narrower) → more labels
        const maxLabels = 6;
        const step = n <= maxLabels ? 1 : Math.ceil(n / maxLabels);
        const showAt = new Set<number>();
        for (let j = 0; j < n; j += step) showAt.add(j);
        
        return (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {bars.map((bar, i) => {
              const visible = showAt.has(i) || selectedIndex === i;
              // 3M: show full "Dec 1"; 1Y/alltime: month only "Dec"
              const xText = range === "3months" ? bar.label : bar.label.split(" ")[0]!;
              return (
                <View key={bar.key} style={{ flex: 1, alignItems: "center" }}>
                  <Text
                    style={[styles.xLabel, selectedIndex === i && styles.xLabelSelected]}
                    numberOfLines={1}
                    ellipsizeMode="clip"
                  >
                    {visible ? xText : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { user } = useAuthStore();
  const [metric,        setMetric]        = useState<Metric>("volume");
  const [range,         setRange]         = useState<TimeRange>("3months");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
      const yearStart = `${new Date().getFullYear()}-01-01T00:00:00`;

      const [countRes, prsRes, weekCacheRes, thisYearRes] = await Promise.all([
        supabase
          .from("workouts")
          .select("id", { count: "exact" })
          .eq("user_id", user!.id)
          .eq("is_complete", true),
        supabase
          .from("personal_records")
          .select("*, exercises(name)")
          .eq("user_id", user!.id)
          .eq("is_current", true)
          .eq("pr_type", "estimated_1rm")
          .order("value", { ascending: false })
          .limit(5),
        supabase
          .from("weekly_volume_cache")
          .select("week_start, total_volume_kg")
          .eq("user_id", user!.id),
        supabase
          .from("workouts")
          .select("total_volume_kg")
          .eq("user_id", user!.id)
          .eq("is_complete", true)
          .gte("completed_at", yearStart),
      ]);

      // Best week — sum volume per week_start across muscle groups
      const weekTotals: Record<string, number> = {};
      (weekCacheRes.data || []).forEach((row: any) => {
        weekTotals[row.week_start] =
          (weekTotals[row.week_start] || 0) + (row.total_volume_kg || 0);
      });
      const bestWeekKg = Object.values(weekTotals).length
        ? Math.max(...Object.values(weekTotals))
        : 0;

      const thisYearKg = (thisYearRes.data || []).reduce(
        (s: number, w: any) => s + (w.total_volume_kg || 0), 0
      );

      return {
        totalWorkouts: countRes.count ?? 0,
        prs:           prsRes.data ?? [],
        bestWeekKg,
        thisYearKg,
      };
    },
    enabled: !!user?.id,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const bars         = chartWorkouts ? buildBars(chartWorkouts, range, metric) : [];
  const animKey      = `${range}-${metric}`;
  const periodTotal  = bars.reduce((s, b) => s + b.value, 0);
  const heroRaw      = selectedIndex !== null ? (bars[selectedIndex]?.value ?? 0) : periodTotal;
  const { value: heroValue, unit: heroUnit } = formatHeroDisplay(heroRaw, metric);
  const periodLabel  = getPeriodLabel(range, selectedIndex, bars);
  const trend        = selectedIndex === null ? computeTrend(bars, range) : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
        </View>

        {/* ── Chart Block (range + hero + chart + metric) ───────── */}
        <View>

          {/* Range pills */}
          <View style={styles.rangeRow}>
            {RANGES.map(r => (
              <Pressable
                key={r.key}
                style={[styles.rangePill, range === r.key && styles.rangePillActive]}
                onPress={() => { setRange(r.key); setSelectedIndex(null); }}
              >
                <Text style={[styles.rangePillText, range === r.key && styles.rangePillTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Hero — value + period, above the chart */}
          <View style={styles.heroBlock}>
            <View style={styles.heroNumberRow}>
              <Text style={styles.heroNumber}>{heroValue}</Text>
              {heroUnit ? <Text style={styles.heroUnit}>{heroUnit}</Text> : null}
            </View>
            <Text style={styles.heroPeriod}>{periodLabel}</Text>
            {trend !== null && (
              <Text style={[
                styles.heroTrend,
                { color: trend >= 0 ? Colors.accentLight : Colors.errorLight },
              ]}>
                {trend >= 0 ? "+" : ""}{trend}% vs previous period
              </Text>
            )}
          </View>

          {/* Chart */}
          <View style={styles.chartZone}>
            {chartLoading ? (
              <View style={{ height: CHART_H + 28, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={Colors.accentLight} />
              </View>
            ) : (
              <AnalyticsChart
                bars={bars}
                animKey={animKey}
                range={range}
                selectedIndex={selectedIndex}
                onSelectBar={setSelectedIndex}
              />
            )}
          </View>

          {/* Metric toggle */}
          <View style={styles.metricToggle}>
            {METRICS.map(m => (
              <Pressable
                key={m.key}
                style={styles.metricPill}
                onPress={() => setMetric(m.key)}
              >
                <Text style={[
                  styles.metricPillText,
                  metric === m.key && styles.metricPillTextActive,
                ]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

        </View>

        {/* ── Stats Strip ───────────────────────────────────────── */}
        <View style={styles.statsStrip}>
          <View style={styles.stripStat}>
            <Text style={styles.stripValue}>{statsData?.totalWorkouts ?? "—"}</Text>
            <Text style={styles.stripLabel}>Sessions</Text>
          </View>
          <View style={styles.stripLine} />
          <View style={styles.stripStat}>
            <Text style={styles.stripValue}>{fmtStripVolume(statsData?.bestWeekKg ?? 0)}</Text>
            <Text style={styles.stripLabel}>Best week</Text>
          </View>
          <View style={styles.stripLine} />
          <View style={styles.stripStat}>
            <Text style={styles.stripValue}>{fmtStripVolume(statsData?.thisYearKg ?? 0)}</Text>
            <Text style={styles.stripLabel}>This year</Text>
          </View>
        </View>

        {/* ── Strength Peaks ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strength Peaks</Text>
          {statsLoading ? (
            <ActivityIndicator color={Colors.accentLight} style={{ marginTop: 8 }} />
          ) : (statsData?.prs.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>Complete workouts to set PRs</Text>
          ) : (
            <View style={styles.prList}>
              {statsData!.prs.map((pr: any, i: number) => (
                <View
                  key={pr.id}
                  style={[
                    styles.prRow,
                    i === statsData!.prs.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.prExercise} numberOfLines={1}>
                    {pr.exercises?.name}
                  </Text>
                  <Text style={styles.prValue}>{Math.round(pr.value)}kg</Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { paddingBottom: 120, gap: 32 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textBright,
    letterSpacing: -0.5,
  },

  // ── Hero Block — lives on screen background ───────────────────────────────
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textFaint,
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  heroNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",   // important
    gap: 6,                   // tighter
    marginBottom: 6,
  },
  heroNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textBright,
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textSub,
    marginBottom: 2,
  },
  heroPeriod: {
    fontSize: 14,
    fontWeight: "400",
    color: Colors.textSub,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  heroTrend: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  // ── Range pills — float on screen bg, no container ───────────────────────
  rangeRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 4,
  },
  rangePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  rangePillActive: {
    backgroundColor: Colors.bgCard,
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },
  rangePillTextActive: {
    color: Colors.accentLight,
    fontWeight: "700",
  },

  // ── Chart zone — floating on screen bg ───────────────────────────────────
  chartZone: {
    paddingHorizontal: 20,
    marginTop: 0,
  },
  selectionDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accentLighter,
    marginTop: 3,
  },
  xLabel: {
    fontSize: 10,
    color: Colors.textFaint,
    fontWeight: "500",
    textAlign: "center",
  },
  xLabelSelected: {
    color: Colors.accentLight,
    fontWeight: "700",
  },

  // ── Metric toggle — below chart, no container bg ──────────────────────────
  metricToggle: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 16,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textFaint,
    letterSpacing: -0.1,
  },
  metricPillTextActive: {
    color: Colors.accentLight,
    fontWeight: "700",
  },

  // ── Stats strip — paddingTop:8 adds to gap:32 → ~40px from metric toggle ─
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  stripStat: {
    flex: 1,
    gap: 4,
  },
  stripValue: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textBright,
    letterSpacing: -0.4,
  },
  stripLabel: {
    fontSize: 11,
    color: Colors.textFaint,
    fontWeight: "500",
  },
  stripLine: {
    width: 0.5,
    height: 28,
    backgroundColor: Colors.separator,
    marginHorizontal: 16,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textBright,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingVertical: 4,
  },

  // ── Strength Peaks list ───────────────────────────────────────────────────
  prList: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
  },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator,
  },
  prExercise: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textBright,
    letterSpacing: -0.1,
  },
  prValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.accentLight,
    letterSpacing: -0.3,
  },
});
