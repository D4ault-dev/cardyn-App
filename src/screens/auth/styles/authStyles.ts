import { Platform, StyleSheet, Dimensions } from 'react-native'
import { colors, typography, spacing, radius, fw } from '../../../theme'
import { ms, SCREEN_H } from '../../../util/responsive'

const { width: W } = Dimensions.get('window')

// ── Success screen styles ─────────────────────────────────────────────────────
export const suc = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginBottom: spacing[8] },
  iconOuter: {
    width: ms(120), height: ms(120), borderRadius: ms(60),
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: {
    width: ms(80), height: ms(80), borderRadius: ms(40),
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: typography.size['3xl'], fontWeight: fw('extrabold') as any,
    color: colors.dark, textAlign: 'center', marginBottom: spacing[3],
  },
  sub: {
    fontSize: typography.size.base, color: colors.muted,
    textAlign: 'center', lineHeight: ms(22),
  },
})

// ── Login hero styles ─────────────────────────────────────────────────────────
export const lh = StyleSheet.create({
  logoWrap: {
    width: ms(88), height: ms(88), borderRadius: ms(44),
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: spacing[4],
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  logo: { width: ms(88), height: ms(88) },
  brandName: {
    fontSize: typography.size['4xl'], fontWeight: fw('extrabold') as any,
    color: '#FFFFFF', letterSpacing: 2, marginBottom: spacing[2], textAlign: 'center',
  },
  tagline: {
    fontSize: typography.size.sm, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: ms(20), fontWeight: typography.weight.regular,
    paddingHorizontal: spacing[4],
  },
})

// ── Login screen v2 styles ────────────────────────────────────────────────────
export const li2 = StyleSheet.create({
  // Root layout
  root: { flex: 1, backgroundColor: colors.primary, flexDirection: 'column' },
  safeTop: { zIndex: 20 },
  
  // Navigation
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2],
  },
  helpTxt: {
    fontSize: typography.size.md, fontWeight: fw('semibold') as any,
    color: 'rgba(255,255,255,0.95)', paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  
  // Card container — no paddingTop, form View handles its own top padding
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    paddingHorizontal: 0,
    paddingTop: 0,
    elevation: 0, shadowOpacity: 0,
  },
  
  // Input field base styles — no horizontal padding, outer form View controls margins
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: ms(14),
    marginBottom: spacing[2], marginHorizontal: spacing[2],
    borderWidth: 1.5, borderColor: 'transparent',
    minHeight: ms(56),
  },
  inputRowFocused: { borderColor: colors.primary, backgroundColor: '#FFFFFF', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  inputRowError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  inputRowDone: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  
  inputLabel: {
    fontSize: typography.size.lg, fontWeight: fw('semibold') as any,
    color: colors.dark, marginRight: spacing[3], minWidth: 68,
  },
  inputDivider: { width: 1, height: ms(20), backgroundColor: colors.border, marginRight: spacing[3] },
  input: {
    flex: 1, fontSize: typography.size.lg, color: colors.dark,
    paddingVertical: 0, fontWeight: fw('medium') as any,
  },
  inputPlaceholder: { color: '#9CA3AF' },
  
  // Clear/Edit buttons
  clearBtn: {
    width: ms(24), height: ms(24), borderRadius: ms(12),
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing[2],
  },
  editBtn: { padding: spacing[2] },
  
  // Account not found state
  notFoundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing[1], marginBottom: spacing[2], paddingHorizontal: spacing[2],
    backgroundColor: '#FFF5F5', borderRadius: radius.md, paddingVertical: spacing[2],
  },
  notFoundTxt: { fontSize: typography.size.sm, color: colors.error, flex: 1 },
  notFoundLink: { fontSize: typography.size.sm, fontWeight: fw('bold') as any, color: colors.primary },
  
  // Password input row
  pwRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: ms(14),
    marginBottom: spacing[2], marginHorizontal: spacing[2],
    borderWidth: 1.5, borderColor: 'transparent', gap: spacing[3],
    minHeight: ms(56),
  },
  pwRowFocused: { borderColor: colors.primary, backgroundColor: '#FFFFFF', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  pwRowError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  pwInput: {
    flex: 1, fontSize: typography.size.lg, color: colors.dark,
    paddingVertical: 0, fontWeight: fw('medium') as any,
  },
  
  // Error messages
  errRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing[2], paddingHorizontal: spacing[2],
  },
  errTxt: { fontSize: typography.size.sm, color: colors.error, flex: 1 },
  
  // Forgot password link
  forgotRow: { alignItems: 'flex-end', marginTop: spacing[1] },
  forgotTxt: {
    fontSize: typography.size.sm, fontWeight: fw('semibold') as any,
    color: colors.secondary,
  },
  
  // Primary button
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: ms(16), alignItems: 'center', justifyContent: 'center',
    marginTop: spacing[2], marginBottom: spacing[2], marginHorizontal: spacing[2],
    minHeight: ms(52), flexDirection: 'row', gap: spacing[2],
  },
  btnOff: { backgroundColor: colors.disabled, elevation: 0 },
  btnActive: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  btnTxt: { fontSize: typography.size.xl, fontWeight: fw('bold') as any, color: '#FFFFFF' },
  btnTxtOff: { color: colors.disabledText },
  
  // Links row (Sign up / Retrieve)
  linksRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[4], marginTop: spacing[1], marginBottom: spacing[2],
  },
  linkTxt: {
    fontSize: typography.size.base, fontWeight: fw('semibold') as any,
    color: colors.secondary, paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  linkDot: { width: ms(4), height: ms(4), borderRadius: ms(2), backgroundColor: colors.border },
  
  // Divider with text
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing[2] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerTxt: {
    fontSize: typography.size.xs, color: colors.subtle,
    marginHorizontal: spacing[4], fontWeight: fw('medium') as any,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  
  // Social buttons container
  socialRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  
  // Consent text
  consent: {
    fontSize: typography.size.xs, color: colors.disabledText,
    textAlign: 'center', lineHeight: ms(18), paddingHorizontal: spacing[4],
  },
  consentLink: { color: colors.secondary, fontWeight: fw('semibold') as any },
  
  // Animated container helpers
  animatedContainer: { overflow: 'hidden' },
  
  // Focus animation helper
  focusTransition: { borderColor: colors.primary, backgroundColor: '#FFFFFF' },

  // Hero text wrap — used by SignupStep and ForgotStep
  heroWrap: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  heroTitle: {
    fontSize: typography.size['4xl'],
    fontWeight: fw('extrabold') as any,
    color: '#FFFFFF',
    lineHeight: ms(46),
  },
})

// ── Shared step styles ────────────────────────────────────────────────────────
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  socialRowWrap: {
    flexDirection: 'row', gap: spacing[3],
    paddingHorizontal: spacing[6], marginBottom: spacing[1],
  },
  backCircle: {
    width: ms(38), height: ms(38), borderRadius: ms(19),
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 2, backgroundColor: '#F0F0F0', marginHorizontal: spacing[5], borderRadius: 1 },
  progressFill: { height: 2, backgroundColor: colors.primary, borderRadius: 1 },
  stepContent: { paddingHorizontal: spacing[6], paddingTop: spacing[5] },
  stepTitle: {
    fontSize: typography.size['3xl'], fontWeight: fw('extrabold') as any,
    color: colors.dark, lineHeight: ms(32), marginBottom: spacing[2],
  },
  stepSub: {
    fontSize: typography.size.base, color: colors.muted,
    lineHeight: ms(21), marginBottom: spacing[4],
  },
  fieldLabel: {
    fontSize: typography.size.xs, fontWeight: fw('semibold') as any,
    color: colors.subtle, marginBottom: spacing[2],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F7F7', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#F0F0F0',
    paddingHorizontal: spacing[4], paddingVertical: ms(16),
    gap: spacing[3], marginBottom: spacing[2],
  },
  inputCardTxt: { flex: 1, fontSize: typography.size.lg, color: colors.dark, paddingVertical: 0 },
  flagSection: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingRight: spacing[2] },
  vDivider: { width: 1, height: ms(22), backgroundColor: colors.border },
  prefix: { fontSize: typography.size.lg, fontWeight: fw('semibold') as any, color: colors.body },
  otpRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[6] },
  otpBox: {
    flex: 1, height: ms(60), borderRadius: radius.lg,
    backgroundColor: '#F7F7F7', borderWidth: 1.5, borderColor: '#F0F0F0',
    textAlign: 'center', fontSize: typography.size['3xl'],
    fontWeight: fw('bold') as any, color: colors.dark,
  },
  otpBoxFocused: { borderColor: colors.primary, backgroundColor: '#FFFFFF' },
  otpBoxOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary, color: colors.primary },
  resendWrap: { alignItems: 'center', marginBottom: spacing[3] },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
  },
  resendBtnTxt: { fontSize: typography.size.sm, fontWeight: fw('semibold') as any, color: colors.primary },
  resendCountTxt: { fontSize: typography.size.sm, color: colors.subtle },
  consentTxt: { fontSize: typography.size.xs, color: colors.disabledText, lineHeight: ms(17), textAlign: 'center' },
  termsLink: { color: colors.secondary, fontWeight: fw('semibold') as any },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: ms(16), alignItems: 'center' as const,
  },
  primaryBtnOff: { backgroundColor: colors.disabled },
  primaryBtnTxt: { fontSize: typography.size.lg, fontWeight: fw('bold') as any, color: '#FFFFFF' },
  primaryBtnTxtOff: { color: colors.disabledText },
  bottomPad: { paddingHorizontal: spacing[6], paddingBottom: spacing[8], paddingTop: spacing[2] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[3] },
  switchTxt: { fontSize: typography.size.base, fontWeight: fw('medium') as any, color: colors.subtle },
  switchLink: { color: colors.secondary, fontWeight: fw('bold') as any },
  errTxt: { fontSize: typography.size.sm, color: colors.error, marginBottom: spacing[2] },
  pwTopWrap: { paddingTop: spacing[2] },
  pwTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: spacing[4],
  },
  phonePill: {
    flexDirection: 'row', alignItems: 'center', gap: ms(5),
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: ms(6),
  },
  phonePillTxt: { fontSize: typography.size.sm, fontWeight: fw('semibold') as any, color: colors.primary },
  pwCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: ms(28), borderTopRightRadius: ms(28),
    paddingHorizontal: spacing[6], paddingTop: spacing[5],
    paddingBottom: ms(100), marginBottom: ms(-40),
    elevation: 12,
  },
  pwHandle: {
    width: ms(36), height: ms(4), backgroundColor: colors.border,
    borderRadius: ms(2), alignSelf: 'center', marginBottom: spacing[5],
  },
  pwTitle: {
    fontSize: typography.size['2xl'], fontWeight: fw('extrabold') as any,
    color: colors.dark, marginBottom: spacing[1], textAlign: 'center',
  },
  pwSub: { fontSize: typography.size.sm, color: colors.subtle, marginBottom: spacing[3], textAlign: 'center' },
  pwInputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F7F7', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#F0F0F0',
    paddingHorizontal: spacing[4], paddingVertical: ms(16),
    gap: spacing[3], marginBottom: spacing[2],
  },
  pwErrRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5), marginBottom: spacing[2] },
  pwErrTxt: { fontSize: typography.size.sm, color: colors.error },
  forgotRow: { alignItems: 'center', paddingTop: spacing[5] },
  forgotTxt: { fontSize: typography.size.base, fontWeight: fw('semibold') as any, color: colors.secondary },
  bioCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[6], paddingBottom: spacing[16],
  },
  bioOuter: { width: ms(160), height: ms(160), borderRadius: ms(80), backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  bioMiddle: { width: ms(118), height: ms(118), borderRadius: ms(59), backgroundColor: '#00C2B4', alignItems: 'center', justifyContent: 'center' },
  bioInner: { width: ms(84), height: ms(84), borderRadius: ms(42), backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bioTitle: {
    fontSize: typography.size['3xl'], fontWeight: fw('extrabold') as any,
    color: colors.dark, textAlign: 'center', marginTop: spacing[8], marginBottom: spacing[3],
  },
  bioSub: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', lineHeight: ms(21) },
  bioBtns: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[5], paddingBottom: spacing[10] },
  bioSkipBtn: { flex: 1, paddingVertical: ms(16), borderRadius: radius.lg, backgroundColor: '#F5F5F5', alignItems: 'center' },
  bioSkipTxt: { fontSize: typography.size.md, fontWeight: fw('bold') as any, color: colors.muted },
  bioEnableBtn: { flex: 1, paddingVertical: ms(16), borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center' },
  bioEnableTxt: { fontSize: typography.size.md, fontWeight: fw('bold') as any, color: '#FFFFFF' },
})

// ── Onboarding styles ─────────────────────────────────────────────────────────
export const ob = StyleSheet.create({
  skipBtn: {
    position: 'absolute', top: spacing[3], right: spacing[5],
    zIndex: 10, paddingVertical: spacing[2], paddingHorizontal: spacing[3],
  },
  skipTxt: { fontSize: typography.size.base, fontWeight: fw('semibold') as any, color: colors.primary },
  illus: { width: W, height: SCREEN_H * 0.42, overflow: 'hidden' },
  illusCircleOuter: { width: W, height: SCREEN_H * 0.42 },
  illusCircleInner: { width: W, height: SCREEN_H * 0.42 },
  textWrap: { paddingHorizontal: spacing[6], paddingTop: spacing[5], alignItems: 'center' },
  title: {
    fontSize: typography.size['3xl'], fontWeight: fw('extrabold') as any,
    color: colors.dark, lineHeight: ms(34), marginBottom: spacing[2], textAlign: 'center',
  },
  subtitle: { fontSize: typography.size.base, color: colors.muted, lineHeight: ms(22), textAlign: 'center' },
  bottom: { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
  dotsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4], justifyContent: 'center' },
  obDot: { width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: '#E0E0E0' },
  obDotActive: { width: ms(20), height: ms(6), borderRadius: ms(3), backgroundColor: colors.primary },
  startBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: ms(16), alignItems: 'center', marginBottom: spacing[3],
  },
  startTxt: { fontSize: typography.size.lg, fontWeight: fw('bold') as any, color: '#FFFFFF', letterSpacing: 0.5 },
  loginBtn: { backgroundColor: '#F5F5F5', borderRadius: radius.lg, paddingVertical: ms(16), alignItems: 'center' },
  loginTxt: { fontSize: typography.size.lg, fontWeight: fw('semibold') as any, color: colors.body },
})