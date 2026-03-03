# GainOS Setup Guide

## Prerequisites
- Node.js 20+
- Supabase account (free tier works)
- Anthropic API key
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) — for native builds

---

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_achievements.sql
   supabase/seed/exercises.sql
   ```
3. Enable **pg_cron** extension in Database > Extensions
4. Deploy Edge Functions:
   ```bash
   supabase functions deploy complete-workout
   supabase functions deploy ai-chat
   supabase functions deploy analytics
   ```
5. Set Edge Function secrets:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

---

## 2. Environment Variables

```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key, service role key, and Anthropic key
```

For mobile, create `apps/mobile/.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

For web, create `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 3. Install Dependencies

```bash
# From repo root
npm install

# Install mobile deps
cd apps/mobile && npm install

# Install web deps
cd apps/web && npm install
```

---

## 4. Run Development

```bash
# Mobile (iOS Simulator or Expo Go)
cd apps/mobile
npx expo start

# Web Dashboard
cd apps/web
npm run dev
# Opens at http://localhost:3001
```

---

## 5. Production Build

### Mobile
```bash
cd apps/mobile
eas build --platform ios    # iOS
eas build --platform android # Android
eas submit                  # Submit to stores
```

### Web
```bash
cd apps/web
npm run build
# Deploy to Vercel: vercel --prod
```

---

## Architecture Overview

```
gainOS/
├── apps/
│   ├── mobile/          # Expo React Native (iOS + Android)
│   └── web/             # Next.js 14 dashboard
├── packages/
│   ├── db/src/types.ts  # Shared TypeScript types
│   ├── utils/src/       # Fitness calculations (1RM, volume, etc.)
│   └── ui/src/theme.ts  # Design tokens (colors, spacing)
├── supabase/
│   ├── migrations/      # SQL schema
│   ├── functions/       # Edge Functions (PR detection, AI coach, analytics)
│   └── seed/            # Exercise library (220+ exercises)
└── .env.example
```

## Key Features

| Feature | How it works |
|---|---|
| PR Detection | Edge function runs on workout complete, compares against all-time bests |
| AI Coach | Claude API with full user context (workouts, nutrition, sleep, goals) injected |
| Offline Logging | Sets stored locally, synced on complete |
| Achievements | 30+ achievements, auto-unlocked by edge function |
| Streaks | SQL trigger updates streak on each workout completion |
| Volume Cache | `weekly_volume_cache` table updated on completion for fast analytics |
