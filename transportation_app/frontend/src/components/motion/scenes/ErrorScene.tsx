/**
 * ERROR Scene: "Offline"
 * Broken route + pulsing warning dot
 * Duration: 3s loop
 */

import { motion } from 'motion/react'
import { getOpacity } from '../../../effects.config'

export interface ErrorSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function ErrorScene({
  intensity = 1,
  paused = false,
}: ErrorSceneProps) {
  const opacityRoute = getOpacity('radarSweep', intensity) * 1.2
  const opacityWarning = getOpacity('radarSweep', intensity) * 1.3

  return (
    <svg className="error-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Route line (left side) */}
      <line x1="200" y1="800" x2="450" y2="900" stroke="var(--color-accent)" strokeWidth="3" opacity={opacityRoute} strokeDasharray="30,20" />

      {/* Break marker */}
      <motion.circle
        cx="500"
        cy="930"
        r="20"
        fill="none"
        stroke="var(--color-danger)"
        strokeWidth="3"
        opacity={opacityWarning}
        animate={
          paused
            ? {}
            : {
                opacity: [opacityWarning, 0.3, opacityWarning],
                r: [20, 25, 20],
              }
        }
        transition={{ duration: 0.8, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* X mark */}
      <line
        x1="490"
        y1="920"
        x2="510"
        y2="940"
        stroke="var(--color-danger)"
        strokeWidth="3"
        opacity={opacityWarning}
        strokeLinecap="round"
      />
      <line
        x1="510"
        y1="920"
        x2="490"
        y2="940"
        stroke="var(--color-danger)"
        strokeWidth="3"
        opacity={opacityWarning}
        strokeLinecap="round"
      />

      {/* Route line (right side, broken) */}
      <line x1="550" y1="960" x2="800" y2="1100" stroke="var(--color-accent)" strokeWidth="3" opacity={opacityRoute * 0.5} strokeDasharray="30,20" />

      {/* Warning indicator (pulsing dot) */}
      <motion.circle
        cx="500"
        cy="1400"
        r="15"
        fill="var(--color-danger)"
        opacity={opacityWarning}
        animate={
          paused
            ? {}
            : {
                r: [15, 25, 15],
                opacity: [opacityWarning, opacityWarning * 0.3, opacityWarning],
              }
        }
        transition={{ duration: 1, ease: 'easeInOut', repeat: Infinity }}
      />
    </svg>
  )
}
