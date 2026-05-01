/**
 * FUFU CARDS — Professional Fintech Color Palette
 *
 * 60-30-10 rule:
 *   60% — White/Light Grey backgrounds (neutral canvas)
 *   30% — Deep Navy #003C8B (primary brand — trust, authority)
 *   10% — Orange #F47735 (accent CTA — action, urgency)
 *
 * Secondary utility blue #0E9DEC for links, info states, progress.
 * Text uses #393737 (soft dark) instead of pure black — reduces eye strain.
 */

export const colors = {
  // ── Primary Brand — Deep Navy ──────────────────────────────────────────────
  primary:        '#003C8B',   // Deep Navy — buttons, nav, active states
  primaryLight:   '#E8F0FB',   // very light navy tint — chip bg, input focus bg
  primaryDark:    '#002A63',   // darker navy — pressed states
  primaryText:    '#FFFFFF',   // white text on navy backgrounds

  // ── Accent / CTA — Orange ─────────────────────────────────────────────────
  accent:         '#F47735',   // Orange — primary CTA (Sell, Trade, Withdraw)
  accentLight:    '#FEE8D8',   // pale orange — disabled CTA, tags
  accentDark:     '#D4601E',   // darker orange — pressed CTA state

  // ── Secondary Utility — Bright Blue ───────────────────────────────────────
  secondary:      '#0E9DEC',   // Bright Blue — links, info icons, progress bars
  secondaryLight: '#E0F4FD',   // pale blue — info backgrounds

  // ── Neutrals ───────────────────────────────────────────────────────────────
  dark:           '#393737',   // Soft dark — headlines, primary text (not pure black)
  body:           '#4A4848',   // body text
  muted:          '#6B6969',   // secondary text, labels
  subtle:         '#9E9C9C',   // placeholder, hints, disabled labels
  border:         '#E0DEDE',   // input borders, dividers
  borderFocus:    '#003C8B',   // focused input border (navy)
  surface:        '#FFFFFF',   // cards, modals, inputs
  background:     '#F5F5F5',   // page background (light grey canvas)
  backgroundAlt:  '#FAFAFA',   // inner card / section background

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:        '#27AE60',   // green
  successLight:   '#E8F8EF',
  warning:        '#F47735',   // reuse orange for warnings (consistent)
  warningLight:   '#FEE8D8',
  error:          '#E53935',   // red
  errorLight:     '#FDECEA',
  info:           '#0E9DEC',   // bright blue for info
  infoLight:      '#E0F4FD',

  // ── Disabled ───────────────────────────────────────────────────────────────
  disabled:       '#F0EFEF',
  disabledText:   '#C4C2C2',

  // ── Overlay ────────────────────────────────────────────────────────────────
  overlay:        'rgba(0,0,0,0.45)',
  overlayLight:   'rgba(0,0,0,0.06)',
} as const

export type ColorKey = keyof typeof colors
