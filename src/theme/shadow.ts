/**
 * Shadow — standalone file with zero dependencies.
 * Safe to import anywhere without circular dependency risk.
 * Spread directly in StyleSheet.create: ...shadow.sm
 */

export const shadow = {
  sm: {
    shadowColor:   '#000',
    shadowOpacity: 0.04,
    shadowRadius:  6,
    shadowOffset:  { width: 0, height: 1 },
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOpacity: 0.08,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 3 },
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOpacity: 0.12,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     8,
  },
  primary: (color: string) => ({
    shadowColor:   color,
    shadowOpacity: 0.28,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     6,
  }),
} as const
