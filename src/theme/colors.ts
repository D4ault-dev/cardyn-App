/**
 * Cardyn — Fintech Color Palette
 *
 * 60-30-10 rule:
 *   60% — Light grey/white backgrounds (#F3F5F7, #FFFFFF)
 *   30% — Deep dark teal #0D1F24 (primary brand — trust, authority)
 *   10% — Teal #00C2B4 (accent CTA — action, energy)
 */

export const colors = {
  // ── Primary Brand — Deep Dark Teal ────────────────────────────────────────
  primary:        '#0D1F24',   // Deep dark teal — nav, headers, active states
  primaryLight:   '#E6F7F5',   // very light teal tint — chip bg, input focus bg
  primaryDark:    '#071318',   // darker — pressed states
  primaryText:    '#FFFFFF',   // white text on dark backgrounds

  // ── Accent / CTA — Teal ───────────────────────────────────────────────────
  accent:         '#00C2B4',   // Teal — primary CTA (Sell, Trade, Withdraw, FAB)
  accentLight:    '#E6F7F5',   // pale teal — disabled CTA, tags
  accentDark:     '#009E92',   // darker teal — pressed CTA state

  // ── Secondary Utility — Teal (same family) ────────────────────────────────
  secondary:      '#00C2B4',   // Teal — links, info icons, rate calculator
  secondaryLight: '#E6F7F5',   // pale teal — info backgrounds

  // ── Neutrals ───────────────────────────────────────────────────────────────
  dark:           '#0D1F24',   // Deep dark — headlines, primary text
  body:           '#1A2E35',   // body text
  muted:          '#4A5568',   // secondary text, labels
  subtle:         '#8A94A6',   // placeholder, hints, disabled labels
  border:         '#E2E8F0',   // input borders, dividers
  borderFocus:    '#00C2B4',   // focused input border (teal)
  surface:        '#FFFFFF',   // cards, modals, inputs
  background:     '#F3F5F7',   // page background (light grey canvas)
  backgroundAlt:  '#FAFAFA',   // inner card / section background

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:        '#00C2B4',   // teal (consistent with brand)
  successLight:   '#E6F7F5',
  warning:        '#F59E0B',   // amber
  warningLight:   '#FEF3C7',
  error:          '#EF4444',   // red
  errorLight:     '#FEE2E2',
  info:           '#00C2B4',   // teal for info
  infoLight:      '#E6F7F5',

  // ── Disabled ───────────────────────────────────────────────────────────────
  disabled:       '#E2E8F0',
  disabledText:   '#A0AEC0',

  // ── Overlay ────────────────────────────────────────────────────────────────
  overlay:        'rgba(13,31,36,0.55)',
  overlayLight:   'rgba(13,31,36,0.06)',
} as const

export type ColorKey = keyof typeof colors
