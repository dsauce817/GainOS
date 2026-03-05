// GainOS Trophies & Achievements Screen
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import type { AchievementDefinition } from "@gainos/db";
import { Colors } from "../../constants/theme";

export default function TrophiesScreen() {
  const { profile } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["trophies", profile?.id],
    queryFn: async () => {
      const [achievementsRes, allDefsRes, prsRes] = await Promise.all([
        supabase
          .from("user_achievements")
          .select("*, achievement_definitions(*)")
          .eq("user_id", profile!.id)
          .order("achieved_at", { ascending: false }),
        supabase
          .from("achievement_definitions")
          .select("*")
          .eq("is_hidden", false)
          .order("category"),
        supabase
          .from("personal_records")
          .select("*, exercises(name)")
          .eq("user_id", profile!.id)
          .eq("is_current", true)
          .order("achieved_at", { ascending: false }),
      ]);

      const earned = new Set(
        (achievementsRes.data || []).map((a: any) => a.achievement_slug)
      );

      const allDefs = allDefsRes.data || [];
      const byCategory: Record<string, any[]> = {};
      for (const def of allDefs) {
        if (!byCategory[def.category]) byCategory[def.category] = [];
        byCategory[def.category]!.push({ ...def, earned: earned.has(def.slug) });
      }

      return {
        userAchievements: achievementsRes.data || [],
        byCategory,
        earnedCount: earned.size,
        totalCount: allDefs.length,
        prs: prsRes.data || [],
      };
    },
    enabled: !!profile?.id,
  });

  const categoryLabels: Record<string, string> = {
    milestone: "🏁 Milestones",
    streak: "🔥 Streaks",
    strength: "💪 Strength",
    volume: "📊 Volume",
    consistency: "📅 Consistency",
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Trophies</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {data?.earnedCount || 0}/{data?.totalCount || 0}
            </Text>
          </View>
        </View>

        {/* Overall progress bar */}
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.progressFill,
              {
                width: `${((data?.earnedCount || 0) / Math.max(data?.totalCount || 1, 1)) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Personal Records */}
        {data?.prs && data.prs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Current PRs</Text>
            <View style={styles.prGrid}>
              {data.prs.map((pr: any) => (
                <PRCard key={pr.id} pr={pr} />
              ))}
            </View>
          </View>
        )}

        {/* Achievement Categories */}
        {data?.byCategory && Object.entries(data.byCategory).map(([cat, items]) => (
          <View key={cat} style={styles.section}>
            <Text style={styles.sectionTitle}>{categoryLabels[cat] || cat}</Text>
            <View style={styles.achievementGrid}>
              {items.map((item: any) => (
                <AchievementBadge key={item.slug} achievement={item} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PRCard({ pr }: { pr: any }) {
  const prTypeLabels: Record<string, string> = {
    weight: "Max Weight",
    reps: "Max Reps",
    estimated_1rm: "Est. 1RM",
    volume: "Session Volume",
  };

  return (
    <View style={styles.prCard}>
      <Text style={styles.prCardType}>{prTypeLabels[pr.pr_type] || pr.pr_type}</Text>
      <Text style={styles.prCardExercise} numberOfLines={2}>{pr.exercises?.name}</Text>
      <Text style={styles.prCardValue}>
        {pr.value}{pr.pr_type === "reps" ? " reps" : "kg"}
      </Text>
    </View>
  );
}

function AchievementBadge({ achievement }: { achievement: AchievementDefinition & { earned: boolean } }) {
  return (
    <View style={[styles.achievementBadge, !achievement.earned && styles.achievementBadgeLocked]}>
      <LinearGradient
        colors={achievement.earned ? [achievement.color + "44", Colors.bgCard] : [Colors.bgElevated, Colors.bgCard]}
        style={styles.achievementBadgeGradient}
      >
        <Text style={[styles.achievementBadgeIcon, !achievement.earned && styles.achievementBadgeIconLocked]}>
          {achievement.earned ? achievement.icon : "🔒"}
        </Text>
        <Text
          style={[styles.achievementBadgeName, !achievement.earned && styles.achievementBadgeNameLocked]}
          numberOfLines={2}
        >
          {achievement.name}
        </Text>
        {achievement.earned && (
          <View style={[styles.achievementXP, { borderColor: achievement.color }]}>
            <Text style={[styles.achievementXPText, { color: achievement.color }]}>
              +{achievement.xp_value}
            </Text>
          </View>
        )}
        {!achievement.earned && (
          <Text style={styles.achievementLockedDesc} numberOfLines={2}>
            {achievement.description}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, gap: 24, paddingBottom: 100 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 32, fontWeight: "900", color: Colors.textBright, letterSpacing: -1 },
  progressBadge: {
    backgroundColor: Colors.bgModal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  progressText: { color: "#9ca3af", fontSize: 14, fontWeight: "600" },

  progressBar: {
    height: 6,
    backgroundColor: Colors.bgModal,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },

  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.textBright },

  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  prCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.successBg,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.successBgBorder,
  },
  prCardType: { fontSize: 11, fontWeight: "700", color: Colors.success, textTransform: "uppercase", letterSpacing: 0.5 },
  prCardExercise: { fontSize: 14, fontWeight: "600", color: Colors.textBright },
  prCardValue: { fontSize: 22, fontWeight: "800", color: Colors.successLight },

  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  achievementBadge: {
    width: "47%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  achievementBadgeLocked: { opacity: 0.5 },
  achievementBadgeGradient: { padding: 16, gap: 8, minHeight: 120, justifyContent: "center" },
  achievementBadgeIcon: { fontSize: 32 },
  achievementBadgeIconLocked: { opacity: 0.5 },
  achievementBadgeName: { fontSize: 13, fontWeight: "700", color: Colors.textBright },
  achievementBadgeNameLocked: { color: "#6b7280" },
  achievementXP: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  achievementXPText: { fontSize: 11, fontWeight: "700" },
  achievementLockedDesc: { fontSize: 11, color: "#4b5563", lineHeight: 15 },
});
