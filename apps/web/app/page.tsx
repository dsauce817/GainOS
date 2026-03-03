import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[#1a1a1e]">
        <span className="text-2xl font-black tracking-tight text-white">GainOS</span>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
            Log In
          </Link>
          <Link
            href="/auth/signup"
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-8 py-24">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-2 rounded-full text-sm font-medium">
          🔥 Duolingo-level addictive, but for lifting
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white max-w-4xl leading-none">
          Hit PRs.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            Get addicted.
          </span>
        </h1>

        <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
          Track workouts, detect PRs automatically, get AI coaching personalized to your data,
          and unlock achievements that keep you coming back.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/auth/signup"
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:opacity-90 transition-opacity"
          >
            Start Free
          </Link>
          <Link
            href="/dashboard"
            className="border border-[#2a2a32] text-gray-300 px-8 py-4 rounded-2xl text-lg font-medium hover:bg-[#111113] transition-colors"
          >
            View Dashboard
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mt-16">
          {[
            {
              emoji: "🎯",
              title: "Auto PR Detection",
              desc: "Every weight, reps, estimated 1RM, and volume PR is detected automatically and celebrated with confetti.",
            },
            {
              emoji: "🤖",
              title: "AI Coach",
              desc: "Claude reads your workouts, nutrition, sleep, and goals to give personalized coaching that actually changes behavior.",
            },
            {
              emoji: "🏆",
              title: "Trophies & Streaks",
              desc: "30+ achievements, workout streaks, PR milestones, and XP. Feels like a game. Produces real results.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-[#111113] border border-[#2a2a32] rounded-2xl p-6 text-left gap-3 flex flex-col">
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="text-white font-bold text-lg">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#1a1a1e] px-8 py-6 flex items-center justify-between text-sm text-gray-600">
        <span>© 2026 GainOS</span>
        <span>Train smarter. Hit PRs. Repeat.</span>
      </footer>
    </div>
  );
}
