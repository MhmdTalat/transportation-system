/**
 * IDLE Scene: "Waiting"
 * Subtle pulse rings, online indicator
 * Duration: 5s loop (battery-conscious)
 */

import { motion } from 'motion/react'
import { getOpacity } from '../../../effects.config'

export interface IdleSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function IdleScene({
  intensity = 1,
  paused = false,
}: IdleSceneProps) {
  const opacityRings = getOpacity('radarSweep', intensity) * 0.25
  const opacityIndicator = getOpacity('radarSweep', intensity) * 0.5

  return (
    <svg className="idle-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Outer pulse ring */}
      <motion.circle
        cx="540"
        cy="960"
        r="100"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacityRings}
        animate={
          paused
            ? {}
            : {
                r: [80, 120, 80],
                opacity: [opacityRings, 0, opacityRings],
              }
        }
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Inner pulse ring (slight phase shift) */}
      <motion.circle
        cx="540"
        cy="960"
        r="90"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacityRings * 0.7}
        animate={
          paused
            ? {}
            : {
                r: [90, 130, 90],
                opacity: [opacityRings * 0.7, 0, opacityRings * 0.7],
              }
        }
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity, delay: 0.2 }}
      />

      {/* Online indicator (small circle at bottom-right) */}
      <circle cx="580" cy="980" r="8" fill="var(--color-success)" opacity={opacityIndicator} />

      {/* Center marker */}
      <circle cx="540" cy="960" r="5" fill="var(--color-accent)" opacity={opacityRings * 2} />
    </svg>
  )
}
