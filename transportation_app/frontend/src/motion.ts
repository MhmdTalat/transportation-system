/**
 * Motion System: "Purposeful, Quick, Calm, Never Blocking"
 *
 * All motion values are defined here. Use only these values in components.
 * Respect prefers-reduced-motion. Animations never block user interaction.
 */

// ============================================================================
// DURATION TOKENS
// ============================================================================

export const duration = {
  fast: 120,      // Button press, quick feedback
  base: 220,      // Standard transitions (screen fade, modal)
  slow: 350,      // Complex animations (route line draw)
  ambient: 9000,  // Long loops (radar, background motion)
} as const

// ============================================================================
// EASING TOKENS
// ============================================================================

export const easing = {
  // Cubic bezier curves (use with framer motion)
  // cubic-bezier(x1, y1, x2, y2)

  // Out: ease-out, swift entry (elements entering)
  // Cubic curve that decelerates at the end
  out: [0.22, 1, 0.36, 1],

  // InOut: smooth passage (moving between states)
  // Accelerates then decelerates
  inOut: [0.65, 0, 0.35, 1],

  // Linear: constant speed (loops, continuous motion)
  linear: [0, 0, 1, 1],

  // Spring config: bouncy, natural feeling
  // Use with Reanimated useSharedValue and withSpring
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 1,
    overshootClamping: false,
  },
} as const

// ============================================================================
// INTERACTION TOKENS
// ============================================================================

export const interaction = {
  // Button press feedback
  press: {
    scale: 0.97,
  },

  // Hover / active state
  hover: {
    scale: 1.02,
  },

  // Stagger delay between list items
  stagger: 40, // milliseconds
} as const

// ============================================================================
// ANIMATION SPECS (Catalog from Design Doc)
// ============================================================================

export const animations = {
  // Screen transitions: Fade + 12px slide
  screenTransition: {
    duration: duration.base,
    easing: easing.out,
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  },

  // Bottom sheet: Spring between snap points
  bottomSheetSnap: {
    type: 'spring' as const,
    ...easing.spring,
    duration: undefined, // Spring ignores duration
  },

  // Button press
  buttonPress: {
    scale: interaction.press.scale,
    duration: duration.fast,
  },

  // List items: Staggered fade-up
  listFadeUp: (index: number) => ({
    duration: duration.base,
    easing: easing.out,
    delay: index * interaction.stagger,
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  }),

  // Skeleton loader: Shimmer (1.2s loop)
  skeletonShimmer: {
    duration: 1200,
    easing: easing.linear,
    repeat: Infinity,
  },

  // Route line draw animation
  routeLineDraw: {
    duration: duration.slow,
    easing: easing.inOut,
  },

  // Car marker: Interpolate between GPS updates (1-3s)
  carMarkerMove: {
    duration: 1500, // Default, can be 1000-3000 based on distance
    easing: easing.linear,
  },

  // Car marker bearing rotation
  carMarkerRotate: {
    duration: 300,
    easing: easing.inOut,
  },

  // ETA text crossfade
  etaTextCrossfade: {
    duration: duration.fast,
    easing: easing.inOut,
  },

  // Searching radar: 3 rings, 3s loop, staggered 1s, fade out
  radarPulse: {
    duration: duration.ambient,
    easing: easing.linear,
    ringCount: 3,
    ringStagger: 1000,
    fadeOut: true,
  },

  // Driver offer: Circular countdown ring + haptic each second
  countdownRing: {
    duration: 15000, // 15 seconds
    easing: easing.linear,
    hapticFeedback: true,
  },

  // Driver matched: Card slides up, details fade in
  driverMatchedCard: {
    slide: {
      duration: duration.slow,
      easing: easing.out,
      initial: { opacity: 0, y: 48 },
      animate: { opacity: 1, y: 0 },
    },
    detailsStagger: interaction.stagger,
  },

  // Payment success: Checkmark burst (Lottie)
  paymentSuccess: {
    duration: 800,
  },

  // Rating stars: Fill with small bounce
  ratingStar: (index: number) => ({
    duration: duration.base,
    easing: easing.out,
    delay: index * (interaction.stagger / 2),
    initial: { scale: 0 },
    animate: { scale: [1.2, 0.95, 1] },
  }),

  // Ambient backgrounds: Soft shapes drifting
  ambientBackground: {
    duration: duration.ambient,
    easing: easing.linear,
    opacity: [0.1, 0.2], // 10-20% opacity
  },

  // Home background: Moving cars on light road grid
  homeBackground: {
    duration: [6000, 7000, 8000], // 6-8s loops per car
    easing: easing.linear,
  },
} as const

// ============================================================================
// REDUCED MOTION VARIANTS
// ============================================================================

/**
 * For prefers-reduced-motion, replace movements with simple fades.
 * Return null to skip animation entirely.
 */
export const reducedMotionVariants = {
  screenTransition: {
    duration: 0,
    easing: easing.linear,
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  bottomSheetSnap: null, // No motion, instant

  listFadeUp: {
    duration: 0,
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },

  skeletonShimmer: null, // Show placeholder instead

  buttonPress: null, // No scale feedback

  radarPulse: null, // Show static indicator

  ambientBackground: null, // Remove background motion

  homeBackground: null, // Static background
} as const

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert our easing format to CSS string
 * Usage: getCubicBezier(easing.out)
 */
export function getCubicBezier(easingValue: number[]): string {
  return `cubic-bezier(${easingValue.join(', ')})`
}

/**
 * Get animation config with reduced motion support
 */
export function getAnimationConfig(
  key: keyof typeof animations,
  reducedMotion: boolean,
) {
  if (reducedMotion) {
    const variant = reducedMotionVariants[key as keyof typeof reducedMotionVariants]
    if (variant === null) return null
    return variant
  }
  return animations[key]
}

/**
 * Stagger delay calculator for lists
 */
export function getStaggerDelay(index: number): number {
  return index * interaction.stagger
}

/**
 * Clamp animation duration to device capabilities
 * (e.g., slower on low-end devices)
 */
export function getAdaptiveDuration(
  baseDuration: number,
  devicePerformance: 'low' | 'medium' | 'high' = 'medium',
): number {
  const multipliers = {
    low: 1.5,     // 50% slower for low-end devices
    medium: 1,    // Standard duration
    high: 0.9,    // 10% faster on high-end
  }
  return Math.round(baseDuration * multipliers[devicePerformance])
}
