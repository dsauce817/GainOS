import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import type { AchievementDefinition } from "@gainos/db";
import { Colors } from "../../constants/theme";

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();

  const { data: trophies } = useQuery({
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
        byCategory,
        earnedCount: earned.size,
        totalCount: allDefs.length,
        prs: prsRes.data || [],
      };
    },
    enabled: !!profile?.id,
  });

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const infoRows = [
    { label: "Username", value: profile?.username || "—" },
    { label: "Goal", value: profile?.goal || "—" },
    { label: "Unit System", value: profile?.unit_system || "metric" },
    { label: "Current Streak", value: `${profile?.current_streak || 0} days` },
    { label: "Longest Streak", value: `${profile?.longest_streak || 0} days` },
  ];

  const categoryLabels: Record<string, string> = {
    milestone: "Milestones",
    streak: "Streaks",
    strength: "Strength",
    volume: "Volume",
    consistency: "Consistency",
  };

  const earnedPct =
    trophies
      ? ((trophies.earnedCount / Math.max(trophies.totalCount, 1)) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Profile</Text>

        {/* Avatar */}
        <LinearGradient
          colors={[Colors.accentLight, Colors.accent, Colors.accentStrong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.username?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
        </LinearGradient>

        <Text style={styles.name}>{profile?.full_name || profile?.username || "Athlete"}</Text>
        {profile?.goal ? (
          <Text style={styles.goalText}>{profile.goal}</Text>
        ) : null}

        {/* Info */}
        <View style={styles.card}>
          {infoRows.map((row, i) => (
            <View
              key={row.label}
              style={[styles.row, i < infoRows.length - 1 && styles.rowDivider]}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Trophies ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>TROPHIES</Text>
          <Text style={styles.sectionCount}>
            {trophies?.earnedCount ?? 0}/{trophies?.totalCount ?? 0}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentStrong]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${earnedPct}%` }]}
          />
        </View>

        {/* PRs */}
        {trophies?.prs && trophies.prs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subSectionLabel}>CURRENT PRS</Text>
            <View style={styles.prGrid}>
              {trophies.prs.map((pr: any) => (
                <PRCard key={pr.id} pr={pr} />
              ))}
            </View>
          </View>
        )}

        {/* Achievement categories */}
        {trophies?.byCategory &&
          Object.entries(trophies.byCategory).map(([cat, items]) => (
            <View key={cat} style={styles.section}>
              <Text style={styles.subSectionLabel}>
                {(categoryLabels[cat] || cat).toUpperCase()}
              </Text>
              <View style={styles.achievementGrid}>
                {items.map((item: any) => (
                  <AchievementBadge key={item.slug} achievement={item} />
                ))}
              </View>
            </View>
          ))}

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function PRCard({ pr }: { pr: any }) {
  const labels: Record<string, string> = {
    weight: "Max Weight",
    reps: "Max Reps",
    estimated_1rm: "Est. 1RM",
    volume: "Volume",
  };
  return (
    <View style={styles.prCard}>
      <Text style={styles.prCardType}>{labels[pr.pr_type] || pr.pr_type}</Text>
      <Text style={styles.prCardExercise} numberOfLines={2}>{pr.exercises?.name}</Text>
      <Text style={styles.prCardValue}>
        {pr.value}{pr.pr_type === "reps" ? " reps" : "kg"}
      </Text>
    </View>
  );
}

function AchievementBadge({
  achievement,
}: {
  achievement: AchievementDefinition & { earned: boolean };
}) {
  return (
    <View
      style={[
        styles.badge,
        achievement.earned
          ? { borderColor: achievement.color + "44" }
          : styles.badgeLocked,
      ]}
    >
      <Text style={[styles.badgeIcon, !achievement.earned && styles.badgeIconLocked]}>
        {achievement.earned ? achievement.icon : "🔒"}
      </Text>
      <Text
        style={[styles.badgeName, !achievement.earned && styles.badgeNameLocked]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>
      {achievement.earned ? (
        <Text style={[styles.badgeXP, { color: achievement.color }]}>
          +{achievement.xp_value} XP
        </Text>
      ) : (
        <Text style={styles.badgeDesc} numberOfLines={2}>
          {achievement.description}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 16, alignItems: "center" },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -1,
    alignSelf: "flex-start",
    paddingTop: 8,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    marginTop: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  avatar: {
    flex: 1,
    borderRadius: 41,
    backgroundColor: Colors.bgModal,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary, marginTop: 4 },
  goalText: { fontSize: 13, color: Colors.accentLight, fontWeight: "600", textTransform: "capitalize", marginTop: -6 },

  card: {
    width: "100%",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.borderFaint },
  rowLabel: { fontSize: 14, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary, textTransform: "capitalize" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 2,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionCount: { fontSize: 13, fontWeight: "600", color: Colors.textMuted },

  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  section: { width: "100%", gap: 10 },
  subSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textFaint,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },

  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  prCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
  },
  prCardType: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  prCardExercise: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  prCardValue: { fontSize: 20, fontWeight: "800", color: Colors.successLight },

  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: {
    width: "47%",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  badgeLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.5 },
  badgeName: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  badgeNameLocked: { color: Colors.textMuted },
  badgeXP: { fontSize: 11, fontWeight: "700" },
  badgeDesc: { fontSize: 11, color: Colors.textFaint, lineHeight: 15 },

  signOutBtn: {
    width: "100%",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(127,29,29,0.6)",
    alignItems: "center",
    marginTop: 8,
  },
  signOutText: { color: Colors.errorLight, fontSize: 15, fontWeight: "600" },
});
