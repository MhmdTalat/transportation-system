/**
 * Background Effects Configuration
 *
 * Central source for all animation durations, opacities, counts, and speeds.
 * No magic numbers in component code. Adjust here to change all effects globally.
 */

export const effectsConfig = {
  // ============================================================================
  // DURATIONS (milliseconds)
  // ============================================================================
  durations: {
    radarSweep: 4000,      // Full rotation: 4 seconds
    skylineFar: 24000,     // Far layer: 24 seconds
    skylineNear: 10000,    // Near layer: 10 seconds
    skylineRoad: 1600,     // Road dashes: 1.6 seconds
    speedLines: 1500,      // Speed lines loop: 1.5 seconds
    contours: {
      ring1: 45000,        // Outer ring: 45 seconds
      ring2: 60000,        // Middle rings: 60 seconds
      ring3: 75000,        // Inner: 75 seconds
    },
    dotWave: 2000,         // Full wave cycle: 2 seconds
    rain: {
      min: 800,            // Fastest drop: 0.8s fall
      max: 1200,           // Slowest drop: 1.2s fall
    },
    glow: 3000,            // Glow pulse: 3 seconds
    glass: 0,              // Static blur effect
  },

  // ============================================================================
  // OPACITIES (0 to 1, clamped)
  // ============================================================================
  opacities: {
    radarSweep: 0.3,       // Rings fade at ~30%
    radarBlip: 0.4,        // Blips: 40%
    skyline: 0.15,         // Far buildings: 15%
    speedLines: 0.25,      // Streaks: 25%
    contours: 0.25,        // Rotating rings: 25%
    dotWave: 0.35,         // Dots: 35%
    rain: 0.5,             // Drops: 50-60%
    glow: 0.12,            // Soft glow: 12%
    glass: 0.08,           // Frost overlay: 8%
  },

  // ============================================================================
  // ELEMENT COUNTS
  // ============================================================================
  counts: {
    radarRings: 3,
    radarBlips: 4,
    speedLines: 6,
    contoursRings: 4,
    raindrops: { min: 8, max: 12 },
    glowCircles: 1,
  },

  // ============================================================================
  // SIZES & DIMENSIONS
  // ============================================================================
  sizes: {
    radarRingMaxRadius: 150,  // Outer ring reaches 150px
    speedLineLength: { min: 40, max: 100 }, // px
    speedLineHeight: 2,       // stroke width
    raindropRadius: { min: 2, max: 4 }, // px
    contourRingRadii: [80, 120, 160, 200], // px for each ring
    glowRadius: 200,          // px blur effect
  },

  // ============================================================================
  // EASING FUNCTIONS (Framer Motion compatible)
  // ============================================================================
  easing: {
    linear: 'linear',
    easeOut: [0.22, 1, 0.36, 1],
    easeInOut: [0.65, 0, 0.35, 1],
  },

  // ============================================================================
  // INTENSITY MULTIPLIERS (user-facing scale 0-1 → internal values)
  // ============================================================================
  // When user passes intensity={0.5}, multiply config opacity by 0.5
  intensityScale: (baseOpacity: number, intensity: number): number => {
    return Math.max(0, Math.min(1, baseOpacity * intensity))
  },

  // ============================================================================
  // SPEED MULTIPLIERS (user-facing scale 0.5-2 → internal durations)
  // ============================================================================
  // When user passes speed={0.5}, durations become 2x longer (slower)
  speedScale: (baseDuration: number, speed: number): number => {
    return Math.round(baseDuration / Math.max(0.5, Math.min(2, speed)))
  },

  // ============================================================================
  // RESPONSIVE BREAKPOINTS (for size adjustments)
  // ============================================================================
  breakpoints: {
    small: 360,    // Small phone
    medium: 768,   // Tablet
    large: 1024,   // Large screen
  },

  // ============================================================================
  // DEVICE PERFORMANCE PROFILES (for adaptive animations)
  // ============================================================================
  profiles: {
    lowEnd: {
      // Android 8, 4GB RAM, Snapdragon 665
      maxAnimatedNodes: 8,
      disableBlur: true,
      disableGradient: true,
      reduceOpacity: 0.8, // 20% less opacity
    },
    midRange: {
      // iPhone 11, mid-range Android
      maxAnimatedNodes: 12,
      disableBlur: false,
      disableGradient: false,
      reduceOpacity: 1,
    },
    highEnd: {
      // iPhone 14+, flagship Android
      maxAnimatedNodes: 16,
      disableBlur: false,
      disableGradient: false,
      reduceOpacity: 1,
    },
  },

  // ============================================================================
  // COLOR TOKENS (use CSS custom properties in actual implementation)
  // ============================================================================
  colors: {
    brand: 'var(--color-accent, #1D9E75)',
    brandDark: '#176B63',
    error: 'var(--color-danger, #E5484D)',
    warning: 'var(--color-warning, #F5A524)',
    text: 'var(--color-text-primary, #0B0B0C)',
    surface: 'var(--color-surface, #FFFFFF)',
    background: 'var(--color-background, #F3F3F3)',
  },

  // ============================================================================
  // PERFORMANCE TARGETS
  // ============================================================================
  performance: {
    targetFPS: 60,
    maxCPUIncrease: 8, // percent
    maxMemoryGrowth: 2, // MB after 50 navigations
  },
} as const

/**
 * Helper: Get device profile based on screen width
 */
export function getDeviceProfile(
  width: number,
): 'lowEnd' | 'midRange' | 'highEnd' {
  if (width < effectsConfig.breakpoints.small) return 'lowEnd'
  if (width < effectsConfig.breakpoints.medium) return 'lowEnd'
  if (width < effectsConfig.breakpoints.large) return 'midRange'
  return 'highEnd'
}

/**
 * Helper: Apply intensity scale to opacity
 */
export function getOpacity(
  effectName: keyof typeof effectsConfig.opacities,
  intensity: number = 1,
): number {
  const base = effectsConfig.opacities[effectName]
  return effectsConfig.intensityScale(base, intensity)
}

/**
 * Helper: Apply speed scale to duration
 */
export function getDuration(
  effectName: keyof typeof effectsConfig.durations,
  speed: number = 1,
): number {
  const config = effectsConfig.durations
  const base = config[effectName]

  if (typeof base === 'number') {
    return effectsConfig.speedScale(base, speed)
  }

  // For nested objects (durations.rain, durations.contours), not used directly
  return 0
}
