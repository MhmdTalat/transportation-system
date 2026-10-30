/**
 * Design Tokens: "Confident Minimalism"
 *
 * One brand color, flat surfaces, no gradients. The map provides color context,
 * the interface stays neutral. Fast, calm, trustworthy, professional.
 *
 * Similar to Uber and Bolt: clean, purposeful, accessible.
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Brand
  brand: '#1D9E75',
  brandDark: '#176B63',
  brandLight: '#2DB88D',

  // Semantic
  success: '#1FA971',
  warning: '#F5A524',
  error: '#E5484D',
  info: '#0EA5E9',

  // Text hierarchy (light mode)
  ink: '#0B0B0C',           // Primary text
  body: '#5E5E5E',          // Secondary text
  mute: '#AFAFAF',          // Tertiary text / hint

  // Surface hierarchy (light mode)
  surface: '#FFFFFF',       // Primary surface (cards, modals)
  surfaceSoft: '#F3F3F3',   // Elevated surface (backgrounds)
  border: '#E6E6E6',        // Borders, dividers

  // Dark mode overrides
  dark: {
    ink: '#F2F2F3',
    body: '#B6B6BA',
    mute: '#85858A',
    surface: '#1C1D21',
    surfaceSoft: '#121316',
    border: '#303136',
  },
} as const

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  fonts: {
    // Prefer Inter for English, Cairo/IBM Plex Sans for Arabic (CSS font-family fallback)
    display: {
      size: '32px',
      weight: 700,
      lineHeight: '1.2',
      letterSpacing: '-0.5px',
    },
    heading: {
      size: '22px',
      weight: 700,
      lineHeight: '1.3',
      letterSpacing: '-0.25px',
    },
    label: {
      size: '14px',
      weight: 600,
      lineHeight: '1.4',
      letterSpacing: '0px',
    },
    body: {
      size: '16px',
      weight: 400,
      lineHeight: '1.5',
      letterSpacing: '0px',
    },
    small: {
      size: '12px',
      weight: 400,
      lineHeight: '1.4',
      letterSpacing: '0px',
    },
  },

  // Use tabular numbers for prices, ETAs, seat numbers
  variants: {
    tabularNums: {
      fontVariantNumeric: 'tabular-nums',
    },
  },
} as const

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const radius = {
  input: '12px',      // Form inputs
  card: '16px',       // Cards, panels
  button: '999px',    // Pills (primary button)
  bottomSheet: '24px', // Bottom sheet top corners only
} as const

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  // Only on floating layers (bottom sheet, search bar)
  sheet: '0 -12px 32px rgb(11 11 12 / 10%)',
  search: '0 4px 16px rgb(11 11 12 / 12%)',
  elevated: '0 4px 16px rgb(11 11 12 / 12%)',
  
  // Dark mode versions
  dark: {
    sheet: '0 -12px 32px rgb(0 0 0 / 28%)',
    search: '0 4px 16px rgb(0 0 0 / 32%)',
    elevated: '0 4px 16px rgb(0 0 0 / 32%)',
  },
} as const

// ============================================================================
// THEME HELPER
// ============================================================================

/**
 * Get theme-aware color value
 * Usage: themeColor(colors.ink, 'dark')
 */
export function themeColor(
  lightColor: string,
  mode: 'light' | 'dark',
  darkColorOverride?: string,
): string {
  if (mode === 'dark' && darkColorOverride) {
    return darkColorOverride
  }
  return lightColor
}

/**
 * Get all theme values for a given mode
 */
export function getTheme(mode: 'light' | 'dark' = 'light') {
  const isLight = mode === 'light'
  return {
    text: {
      primary: isLight ? colors.ink : colors.dark.ink,
      secondary: isLight ? colors.body : colors.dark.body,
      muted: isLight ? colors.mute : colors.dark.mute,
    },
    surface: {
      primary: isLight ? colors.surface : colors.dark.surface,
      soft: isLight ? colors.surfaceSoft : colors.dark.surfaceSoft,
      border: isLight ? colors.border : colors.dark.border,
    },
    shadow: {
      sheet: isLight ? shadows.sheet : shadows.dark.sheet,
      search: isLight ? shadows.search : shadows.dark.search,
      elevated: isLight ? shadows.elevated : shadows.dark.elevated,
    },
    semantic: {
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,
      brand: colors.brand,
    },
  }
}

// ============================================================================
// TOUCH TARGETS & ACCESSIBILITY
// ============================================================================

export const accessibility = {
  minTouchTarget: '48px',       // Minimum touch target (WCAG)
  minButtonHeight: '52px',      // Primary button
  focusOutlineWidth: '2px',
  focusOutlineOffset: '2px',
  focusOutlineColor: colors.brand,
} as const

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  base: 0,
  elevated: 10,
  modal: 100,
  overlay: 200,
  toast: 300,
  tooltip: 400,
} as const
