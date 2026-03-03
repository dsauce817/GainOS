// GainOS Workout Complete Screen
// The dopamine hit — PR celebrations, achievements, and session summary

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { formatDuration, formatVolume, formatPRType } from "@gainos/utils";
import type { WorkoutCelebration, PRResult, AchievementUnlock } from "@gainos/db";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function WorkoutCompleteScreen() {
  const params = useLocalSearchParams<{ workoutId: string; celebration: string }>();
  const celebration: WorkoutCelebration | null = params.celebration
    ? JSON.parse(params.celebration)
    : null;

  const [currentPRIndex, setCurrentPRIndex] = useState(-1); // -1 = show summary
  const [showingAchievements, setShowingAchievements] = useState(false);

  const confettiParticles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: ["#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"][i % 6] || "#6366f1",
    }))
  ).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    if (celebration?.hasCelebration) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 200, 100, 200]);
      launchConfetti();

      // Show PRs one by one after a delay
      if (celebration.prs.length > 0) {
        setTimeout(() => setCurrentPRIndex(0), 800);
      }
    }
  }, []);

  const launchConfetti = () => {
    confettiParticles.forEach((particle, i) => {
      particle.x.setValue(Math.random() * SCREEN_WIDTH);
      particle.y.setValue(-20);
      particle.opacity.setValue(1);

      Animated.parallel([
        Animated.timing(particle.y, {
          toValue: SCREEN_HEIGHT + 50,
          duration: 2000 + Math.random() * 1000,
          delay: i * 50,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(particle.rotation, {
          toValue: 720 + Math.random() * 360,
          duration: 2000 + Math.random() * 1000,
          delay: i * 50,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1500 + i * 50),
          Animated.timing(particle.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  };

  const handleNextPR = () => {
    if (!celebration) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentPRIndex < celebration.prs.length - 1) {
      setCurrentPRIndex(currentPRIndex + 1);
    } else if (celebration.newAchievements.length > 0 && !showingAchievements) {
      setShowingAchievements(true);
    } else {
      // Done with celebrations
      setCurrentPRIndex(-1);
      setShowingAchievements(false);
    }
  };

  const w = celebration?.workout;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Confetti */}
      {confettiParticles.map((particle, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confettiParticle,
            {
              backgroundColor: particle.color,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                {
                  rotate: particle.rotation.interpolate({
                    inputRange: [0, 720],
                    outputRange: ["0deg", "720deg"],
                  }),
                },
              ],
              opacity: particle.opacity,
            },
          ]}
        />
      ))}

      {/* PR Celebration Overlay */}
      {currentPRIndex >= 0 && celebration?.prs[currentPRIndex] && (
        <PRCelebrationCard
          pr={celebration.prs[currentPRIndex]!}
          total={celebration.prs.length}
          index={currentPRIndex}
          onNext={handleNextPR}
          onLaunchConfetti={launchConfetti}
        />
      )}

      {/* Achievement Unlock Overlay */}
      {showingAchievements && celebration?.newAchievements[0] && (
        <AchievementUnlockCard
          achievement={celebration.newAchievements[0]}
          onNext={handleNextPR}
        />
      )}

      {/* Main Summary */}
      {currentPRIndex === -1 && !showingAchievements && (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>
              {celebration?.hasCelebration ? "🔥" : "✅"}
            </Text>
            <Text style={styles.title}>Workout Complete!</Text>
            {celebration?.hasCelebration && (
              <Text style={styles.subtitle}>
                {celebration.prs.length > 0
                  ? `You hit ${celebration.prs.length} PR${celebration.prs.length > 1 ? "s" : ""}!`
                  : `${celebration.newAchievements.length} achievement${celebration.newAchievements.length > 1 ? "s" : ""} unlocked!`}
              </Text>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCell label="Duration" value={formatDuration(w?.duration || 0)} />
            <StatCell label="Volume" value={formatVolume(w?.totalVolume || 0)} />
            <StatCell label="Sets" value={String(w?.totalSets || 0)} />
            <StatCell label="PRs" value={String(celebration?.prs.length || 0)} emoji="🎯" />
          </View>

          {/* PRs Hit */}
          {celebration && celebration.prs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRs Hit Today 🎯</Text>
              {celebration.prs.map((pr, i) => (
                <PRSummaryRow key={i} pr={pr} />
              ))}
            </View>
          )}

          {/* New Achievements */}
          {celebration && celebration.newAchievements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Achievements Unlocked 🏆</Text>
              {celebration.newAchievements.map((ach, i) => (
                <AchievementSummaryRow key={i} achievement={ach} />
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/(tabs)")}
            >
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/coach")}
            >
              <Text style={styles.secondaryBtnText}>🤖 Get Coaching Feedback</Text>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ============================================================
// PR CELEBRATION CARD (full-screen overlay)
// ============================================================
function PRCelebrationCard({
  pr,
  total,
  index,
  onNext,
  onLaunchConfetti,
}: {
  pr: PRResult;
  total: number;
  index: number;
  onNext: () => void;
  onLaunchConfetti: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLaunchConfetti();

    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.05,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  const prTypeColors: Record<string, [string, string]> = {
    weight: ["#16a34a", "#22c55e"],
    reps: ["#1d4ed8", "#3b82f6"],
    estimated_1rm: ["#7c3aed", "#8b5cf6"],
    volume: ["#b45309", "#f59e0b"],
  };

  const colors = prTypeColors[pr.prType] || ["#6366f1", "#8b5cf6"];

  return (
    <View style={styles.prOverlay}>
      <Animated.View style={[styles.prCard, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[colors[0]! + "33", "#111113"]}
          style={styles.prCardGradient}
        >
          <Text style={styles.prUnlocked}>🎯 PR UNLOCKED</Text>
          <Text style={styles.prCounter}>{index + 1} / {total}</Text>

          <View style={[styles.prBadgeLarge, { borderColor: colors[1] }]}>
            <Text style={styles.prBadgeLargeText}>NEW {formatPRType(pr.prType).toUpperCase()}</Text>
          </View>

          <Text style={styles.prExercise}>{pr.exerciseName}</Text>

          <View style={styles.prValues}>
            <Text style={[styles.prNewValue, { color: colors[1] }]}>
              {pr.newValue}{pr.prType === "reps" ? " reps" : "kg"}
            </Text>
            {pr.previousValue && (
              <Text style={styles.prPrevValue}>
                prev: {pr.previousValue}{pr.prType === "reps" ? " reps" : "kg"}
                {pr.improvementPct ? ` (+${pr.improvementPct}%)` : ""}
              </Text>
            )}
          </View>

          <TouchableOpacity style={[styles.prNextBtn, { backgroundColor: colors[0] }]} onPress={onNext}>
            <Text style={styles.prNextBtnText}>
              {index < total - 1 ? "Next PR →" : "Continue →"}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ============================================================
// ACHIEVEMENT UNLOCK CARD
// ============================================================
function AchievementUnlockCard({
  achievement,
  onNext,
}: {
  achievement: AchievementUnlock;
  onNext: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.prOverlay}>
      <Animated.View style={[styles.prCard, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[achievement.color + "33", "#111113"]}
          style={styles.prCardGradient}
        >
          <Text style={styles.prUnlocked}>🏆 ACHIEVEMENT UNLOCKED</Text>

          <Text style={styles.achievementIcon}>{achievement.icon}</Text>
          <Text style={styles.achievementName}>{achievement.name}</Text>
          <Text style={styles.achievementDesc}>{achievement.description}</Text>

          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>+{achievement.xpValue} XP</Text>
          </View>

          <TouchableOpacity
            style={[styles.prNextBtn, { backgroundColor: achievement.color }]}
            onPress={onNext}
          >
            <Text style={styles.prNextBtnText}>Continue →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function StatCell({ label, value, emoji }: { label: string; value: string; emoji?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellValue}>
        {emoji && `${emoji} `}{value}
      </Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

function PRSummaryRow({ pr }: { pr: PRResult }) {
  return (
    <View style={styles.prSummaryRow}>
      <View style={styles.prSummaryBadge}>
        <Text style={styles.prSummaryBadgeText}>PR</Text>
      </View>
      <View style={styles.prSummaryContent}>
        <Text style={styles.prSummaryExercise}>{pr.exerciseName}</Text>
        <Text style={styles.prSummaryMeta}>
          {formatPRType(pr.prType)} — {pr.newValue}{pr.prType === "reps" ? " reps" : "kg"}
          {pr.improvementPct ? ` (+${pr.improvementPct}%)` : ""}
        </Text>
      </View>
    </View>
  );
}

function AchievementSummaryRow({ achievement }: { achievement: AchievementUnlock }) {
  return (
    <View style={styles.achSummaryRow}>
      <Text style={styles.achSummaryIcon}>{achievement.icon}</Text>
      <View style={styles.achSummaryContent}>
        <Text style={styles.achSummaryName}>{achievement.name}</Text>
        <Text style={styles.achSummaryDesc}>{achievement.description}</Text>
      </View>
      <View style={[styles.xpBadge, { marginLeft: 0 }]}>
        <Text style={styles.xpBadgeText}>+{achievement.xpValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0b" },
  content: { padding: 20, gap: 24, paddingBottom: 60 },

  confettiParticle: {
    position: "absolute",
    width: 10,
    height: 14,
    borderRadius: 2,
    zIndex: 100,
  },

  header: { alignItems: "center", gap: 8, paddingTop: 20 },
  emoji: { fontSize: 64 },
  title: { fontSize: 32, fontWeight: "900", color: "#f9fafb", letterSpacing: -1 },
  subtitle: { fontSize: 17, color: "#22c55e", fontWeight: "600" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCell: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#111113",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  statCellValue: { fontSize: 24, fontWeight: "800", color: "#f9fafb" },
  statCellLabel: { fontSize: 13, color: "#6b7280" },

  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f9fafb" },

  prSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0d1a0d",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#14532d",
  },
  prSummaryBadge: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prSummaryBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  prSummaryContent: { flex: 1, gap: 2 },
  prSummaryExercise: { fontSize: 15, fontWeight: "600", color: "#f9fafb" },
  prSummaryMeta: { fontSize: 13, color: "#86efac" },

  achSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111113",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  achSummaryIcon: { fontSize: 32 },
  achSummaryContent: { flex: 1, gap: 2 },
  achSummaryName: { fontSize: 15, fontWeight: "600", color: "#f9fafb" },
  achSummaryDesc: { fontSize: 13, color: "#9ca3af" },

  xpBadge: {
    backgroundColor: "#1c1a0a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ca8a04",
    alignSelf: "flex-start",
    marginTop: 8,
    marginHorizontal: "auto",
  },
  xpBadgeText: { color: "#fbbf24", fontSize: 13, fontWeight: "700" },

  actions: { gap: 12 },
  primaryBtn: { borderRadius: 16, overflow: "hidden" },
  primaryBtnGradient: { padding: 20, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondaryBtn: {
    padding: 18,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  secondaryBtnText: { color: "#9ca3af", fontSize: 15, fontWeight: "500" },

  // PR Overlay
  prOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    padding: 24,
  },
  prCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  prCardGradient: {
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  prUnlocked: { fontSize: 13, fontWeight: "800", color: "#9ca3af", letterSpacing: 2 },
  prCounter: { fontSize: 13, color: "#6b7280" },
  prBadgeLarge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 2,
  },
  prBadgeLargeText: { fontSize: 13, fontWeight: "800", color: "#f9fafb", letterSpacing: 1 },
  prExercise: { fontSize: 24, fontWeight: "800", color: "#f9fafb", textAlign: "center" },
  prValues: { alignItems: "center", gap: 4 },
  prNewValue: { fontSize: 52, fontWeight: "900", letterSpacing: -2 },
  prPrevValue: { fontSize: 14, color: "#6b7280" },
  prNextBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  prNextBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  achievementIcon: { fontSize: 72, marginVertical: 8 },
  achievementName: { fontSize: 28, fontWeight: "800", color: "#f9fafb", textAlign: "center" },
  achievementDesc: { fontSize: 15, color: "#9ca3af", textAlign: "center", lineHeight: 22 },
});
