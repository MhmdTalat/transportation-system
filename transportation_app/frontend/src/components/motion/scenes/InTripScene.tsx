/**
 * IN TRIP Scene: "Speed"
 * 6 horizontal streaks + road shake
 * Duration: 1.5s loop
 */

import { motion } from 'motion/react'
import { getOpacity, getDuration } from '../../../effects.config'

export interface InTripSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function InTripScene({
  intensity = 1,
  speed = 1,
  paused = false,
}: InTripSceneProps) {
  const opacity = getOpacity('speedLines', intensity)
  const duration = getDuration('speedLines', speed) || 1500

  const streaks = [
    { y: 800, length: 60, delay: 0, isBrand: false },
    { y: 900, length: 80, delay: 0.1, isBrand: true },
    { y: 1000, length: 50, delay: 0.2, isBrand: false },
    { y: 1100, length: 90, delay: 0.3, isBrand: true },
    { y: 1200, length: 70, delay: 0.4, isBrand: false },
    { y: 1300, length: 100, delay: 0.5, isBrand: false },
  ]

  return (
    <svg className="intrip-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Speed streaks */}
      {streaks.map((streak, idx) => (
        <motion.line
          key={`streak-${idx}`}
          x1={-streak.length}
          y1={streak.y}
          x2="1080"
          y2={streak.y}
          stroke={streak.isBrand ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
          strokeWidth="2"
          opacity={opacity}
          animate={paused ? {} : { x: [0, 1080 + streak.length] }}
          transition={{
            duration: duration / 1000,
            ease: 'linear',
            repeat: Infinity,
            delay: streak.delay,
          }}
        />
      ))}

      {/* Road shake container */}
      <motion.g
        className="road-shake"
        animate={paused ? {} : { x: [-2, 2, -2] }}
        transition={{ duration: 0.6, ease: 'easeInOut', repeat: Infinity }}
      >
        <rect x="0" y="1500" width="1080" height="200" fill="var(--color-accent)" opacity={opacity * 0.1} />
      </motion.g>
    </svg>
  )
}
