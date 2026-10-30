/**
 * MATCHED Scene: "Arrival"
 * Route draws, car glides, glow settles
 * Duration: 2.5s play-once
 */

import { motion } from 'motion/react'
import { getOpacity, getDuration } from '../../../effects.config'

export interface MatchedSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function MatchedScene({
  intensity = 1,
  speed = 1,
  paused = false,
  onComplete,
}: MatchedSceneProps) {
  const opacityRoute = getOpacity('radarSweep', intensity) * 1.3
  const opacityCar = opacityRoute * 1.2
  const opacityGlow = opacityRoute * 0.6

  return (
    <svg className="matched-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Route path (animates stroke-dasharray) */}
      <motion.path
        d="M 200 800 Q 540 900 800 1100"
        stroke="var(--color-accent)"
        strokeWidth="3"
        fill="none"
        opacity={opacityRoute}
        strokeDasharray="500"
        animate={paused ? {} : { strokeDashoffset: [500, 0] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        onAnimationComplete={onComplete}
      />

      {/* Driver marker */}
      <circle cx="200" cy="800" r="12" fill="var(--color-accent)" opacity={opacityRoute} />

      {/* Pickup marker */}
      <circle cx="800" cy="1100" r="12" fill="var(--color-accent)" opacity={opacityRoute} />

      {/* Car gliding along path */}
      <motion.g
        animate={
          paused
            ? {}
            : {
                x: [200, 800],
                y: [800, 1100],
              }
        }
        transition={{ duration: 1, ease: 'linear', delay: 0.8 }}
      >
        <rect x="-15" y="-12" width="30" height="24" fill="var(--color-accent)" opacity={opacityCar} rx="3" />
        <circle cx="-8" cy="0" r="3" fill="var(--color-accent)" opacity={opacityCar * 0.8} />
        <circle cx="8" cy="0" r="3" fill="var(--color-accent)" opacity={opacityCar * 0.8} />
      </motion.g>

      {/* Glow on arrival */}
      <motion.circle
        cx="800"
        cy="1100"
        r="40"
        fill="var(--color-accent)"
        opacity={0}
        animate={
          paused
            ? {}
            : {
                r: [30, 60, 40],
                opacity: [opacityGlow, 0, opacityGlow],
              }
        }
        transition={{ duration: 0.7, ease: 'easeInOut', delay: 1.8, repeat: Infinity }}
      />
    </svg>
  )
}
