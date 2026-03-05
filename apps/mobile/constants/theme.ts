// ─────────────────────────────────────────────────────────────────────────────
// GainOS Theme — Deep Graphite + Sophisticated Green  (Elite Performance)
//
// To retheme the entire app:
//   1. Change the 5 accent values
//   2. Update the 4 rgba() lines to match your new accent RGB
//   3. Optionally adjust bg/bgCard/border for a different base tone
// ─────────────────────────────────────────────────────────────────────────────

export const Colors = {
  // ─── Backgrounds — Deep Graphite ─────────────────────────────────────────
  bg:         '#0F1115', // main screen background (deep graphite, softer than black)
  bgCard:     '#171A21', // cards, inputs, list items
  bgElevated: '#1E222B', // slightly raised surfaces (input fields, inline rows)
  bgModal:    '#222732', // modals, bottom sheets, popovers
  bgDeep:     '#0B0D10', // deepest background (behind tab bar etc.)

  // ─── Borders / Dividers ──────────────────────────────────────────────────
  border:        '#2A2F3A',              // dividers, subtle lines
  borderMid:     '#343A47',              // slightly lighter divider lines
  borderSubtle:  'rgba(255,255,255,0.07)', // very subtle border on dark surfaces
  borderFaint:   'rgba(255,255,255,0.05)', // barely-visible dividers
  borderFainter: 'rgba(255,255,255,0.04)', // almost invisible separators

  // ─── Text ────────────────────────────────────────────────────────────────
  textBright:  '#F1F4F8', // headings, hero numbers
  textPrimary: '#F1F4F8', // body text, labels
  textLight:   '#CDD3DC', // secondary body text
  textSub:     '#A4ADB8', // supporting labels, subtitles
  textMid:     '#8890A0', // placeholder-level text, timestamps
  textMuted:   '#6C7684', // de-emphasised counts, helper text
  textFaint:   '#4A525E', // placeholder text in inputs / disabled

  // ─── PRIMARY ACCENT — Sophisticated Green ────────────────────────────────
  // Change these 5 lines to switch the whole app to a new accent color.
  // Then update the 4 rgba() lines below to match your new RGB values.
  accent:        '#3FD17A', // PRIMARY — buttons, active bars, chart bars, active tab
  accentLight:   '#72E09F', // SECONDARY — tab bar active icon, icon tints, spinners
  accentLighter: '#AAEEC5', // SUBTLE — selected bar highlight, light text on accent bg
  accentStrong:  '#32B868', // GRADIENT end / hover-pressed
  accentDark:    '#0E2E1C', // DARK BG — active filter chip background

  // Derived transparent variants — update RGB (63,209,122) if you change accent
  accentBgSoft:   'rgba(63,209,122,0.08)',  // very faint accent wash
  accentBg:       'rgba(63,209,122,0.15)',  // active chip / selected state background
  accentBgMid:    'rgba(63,209,122,0.3)',   // stronger hover / pressed state
  accentBgStrong: 'rgba(63,209,122,0.5)',   // bold accent border or fill

  // ─── Success / Green ─────────────────────────────────────────────────────
  success:         '#22c55e',
  successLight:    '#4ade80',
  successBright:   '#86efac',
  successBorder:   '#16a34a',
  successDark:     '#15803d',
  successBg:       '#0d1a0d',
  successBgBorder: '#14532d',
  successBgDeep:   '#052e16',

  // ─── Warning / Amber ─────────────────────────────────────────────────────
  warning:      '#E6A23C', // controlled amber — plateau, tip cards
  warningLight: '#FFD07A',
  warningBg:    '#1E1608',

  // ─── Error / Red ─────────────────────────────────────────────────────────
  error:     '#ef4444',
  errorLight: '#f87171',
  errorDark:  '#b91c1c',
  errorBg:    '#1c0f0f',

  // ─── Info / Blue ─────────────────────────────────────────────────────────
  info:         '#3b82f6',
  infoLight:    '#60a5fa',
  infoCyan:     '#06b6d4',
  infoCyanDark: '#0891b2',
  infoWarmupBg: '#1c2436',

  // ─── Misc ────────────────────────────────────────────────────────────────
  orange: '#f97316',
  amber:  '#f59e0b',
  purple: '#c084fc',

  // ─── Overlays ────────────────────────────────────────────────────────────
  overlay:      'rgba(0,0,0,0.8)',
  overlayMid:   'rgba(0,0,0,0.85)',
  overlayLight: 'rgba(0,0,0,0.5)',
} as const;

// Exercise category badge colors
export const CategoryColors: Record<string, string> = {
  compound:  Colors.accent,
  isolation: Colors.infoCyanDark,
  cardio:    Colors.successBorder,
  stretch:   Colors.warning,
};

// Muscle group tag colors
export const MuscleColors: Record<string, string> = {
  chest:       Colors.error,
  back:        Colors.info,
  shoulders:   Colors.purple,
  biceps:      Colors.amber,
  triceps:     Colors.orange,
  legs:        Colors.success,
  quads:       Colors.success,
  hamstrings:  Colors.successBorder,
  glutes:      Colors.successDark,
  calves:      Colors.successLight,
  core:        Colors.infoCyan,
  abs:         Colors.infoCyan,
  forearms:    '#d97706',
};

