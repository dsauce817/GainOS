"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { createClient } from "../../lib/supabase";

interface OverviewData {
  streak: number;
  longestStreak: number;
  totalWorkouts: number;
  totalVolumeKg: number;
  totalPRs: number;
  totalAchievements: number;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [recentPRs, setRecentPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    const [profileRes, workoutsRes, prsRes, weeklyVolumeRes] = await Promise.all([
      supabase.from("profiles").select("current_streak,longest_streak").eq("id", userId).single(),
      supabase
        .from("workouts")
        .select("id,name,completed_at,total_volume_kg,total_sets,duration_seconds")
        .eq("user_id", userId)
        .eq("is_complete", true)
        .order("completed_at", { ascending: false })
        .limit(10),
      supabase
        .from("personal_records")
        .select("*, exercises(name)")
        .eq("user_id", userId)
        .eq("is_current", true)
        .order("achieved_at", { ascending: false })
        .limit(10),
      supabase
        .from("weekly_volume_cache")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: true })
        .limit(40),
    ]);

    const totalWorkouts = workoutsRes.data?.length || 0;
    const totalVolumeKg = workoutsRes.data?.reduce((s, w) => s + (w.total_volume_kg || 0), 0) || 0;

    setOverview({
      streak: profileRes.data?.current_streak || 0,
      longestStreak: profileRes.data?.longest_streak || 0,
      totalWorkouts,
      totalVolumeKg,
      totalPRs: prsRes.data?.length || 0,
      totalAchievements: 0,
    });

    setRecentWorkouts(workoutsRes.data || []);
    setRecentPRs(prsRes.data || []);

    // Group volume data by week for chart
    const weekMap: Record<string, { week: string; sets: number; volume: number }> = {};
    for (const v of weeklyVolumeRes.data || []) {
      if (!weekMap[v.week_start]) {
        weekMap[v.week_start] = { week: v.week_start, sets: 0, volume: 0 };
      }
      weekMap[v.week_start]!.sets += v.total_sets;
      weekMap[v.week_start]!.volume += v.total_volume_kg;
    }
    setVolumeData(Object.values(weekMap).slice(-8));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Sidebar */}
      <div className="flex">
        <aside className="w-64 h-screen bg-[#0a0a0b] border-r border-[#1a1a1e] fixed flex flex-col">
          <div className="p-6 border-b border-[#1a1a1e]">
            <span className="text-2xl font-black text-white tracking-tight">GainOS</span>
          </div>
          <nav className="p-4 flex flex-col gap-1 flex-1">
            {[
              { label: "Dashboard", emoji: "🏠", active: true },
              { label: "Workouts", emoji: "🏋️", active: false },
              { label: "Exercises", emoji: "💪", active: false },
              { label: "Trophies", emoji: "🏆", active: false },
              { label: "Progress", emoji: "📊", active: false },
              { label: "Coach", emoji: "🤖", active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left w-full ${
                  item.active
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-[#1a1a1e]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm">👤</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Athlete</p>
                <p className="text-xs text-gray-500">Profile</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-black text-white">Dashboard</h1>
              <p className="text-gray-400 mt-1">Your training at a glance</p>
            </div>

            {/* Stats Grid */}
            {overview && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Streak" value={`${overview.streak}d`} emoji="🔥" color="text-orange-400" />
                <StatCard label="Best Streak" value={`${overview.longestStreak}d`} emoji="⚡" color="text-yellow-400" />
                <StatCard label="Workouts" value={overview.totalWorkouts.toString()} emoji="🏋️" color="text-indigo-400" />
                <StatCard
                  label="Total Volume"
                  value={overview.totalVolumeKg >= 1000 ? `${(overview.totalVolumeKg / 1000).toFixed(0)}t` : `${overview.totalVolumeKg}kg`}
                  emoji="📊"
                  color="text-blue-400"
                />
                <StatCard label="Current PRs" value={overview.totalPRs.toString()} emoji="🎯" color="text-green-400" />
                <StatCard label="Achievements" value={overview.totalAchievements.toString()} emoji="🏆" color="text-amber-400" />
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Weekly Volume */}
              <div className="bg-[#111113] border border-[#2a2a32] rounded-2xl p-6">
                <h2 className="text-white font-bold text-lg mb-4">Weekly Volume (sets)</h2>
                {volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={volumeData}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                      <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#1e1e24", border: "1px solid #2a2a32", borderRadius: 8 }}
                        labelStyle={{ color: "#f9fafb" }}
                      />
                      <Area type="monotone" dataKey="sets" stroke="#6366f1" fill="url(#volGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    No data yet — start logging workouts
                  </div>
                )}
              </div>

              {/* Recent PRs */}
              <div className="bg-[#111113] border border-[#2a2a32] rounded-2xl p-6">
                <h2 className="text-white font-bold text-lg mb-4">Current PRs 🎯</h2>
                <div className="space-y-3">
                  {recentPRs.length > 0 ? recentPRs.slice(0, 6).map((pr: any) => (
                    <div key={pr.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{pr.exercises?.name}</p>
                        <p className="text-gray-500 text-xs">{pr.pr_type.replace(/_/g, " ")}</p>
                      </div>
                      <span className="text-green-400 font-bold text-sm">
                        {pr.value}{pr.pr_type === "reps" ? " reps" : "kg"}
                      </span>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-sm">Hit your first PR to see it here</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Workouts Table */}
            <div className="bg-[#111113] border border-[#2a2a32] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2a2a32]">
                <h2 className="text-white font-bold text-lg">Recent Workouts</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1a1e]">
                    {["Workout", "Date", "Duration", "Volume", "Sets"].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentWorkouts.length > 0 ? recentWorkouts.map((w: any) => (
                    <tr key={w.id} className="border-b border-[#1a1a1e] hover:bg-[#1a1a1e] transition-colors">
                      <td className="px-6 py-4 text-white font-medium text-sm">{w.name}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(w.completed_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {w.duration_seconds ? `${Math.floor(w.duration_seconds / 60)}m` : "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {w.total_volume_kg >= 1000
                          ? `${(w.total_volume_kg / 1000).toFixed(1)}t`
                          : `${Math.round(w.total_volume_kg)}kg`}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{w.total_sets}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No workouts yet. Download the GainOS app to start logging.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, emoji, color }: {
  label: string;
  value: string;
  emoji: string;
  color: string;
}) {
  return (
    <div className="bg-[#111113] border border-[#2a2a32] rounded-2xl p-5 flex flex-col gap-2">
      <span className="text-2xl">{emoji}</span>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
      <span className="text-xs text-gray-500 font-medium">{label}</span>
    </div>
  );
}
