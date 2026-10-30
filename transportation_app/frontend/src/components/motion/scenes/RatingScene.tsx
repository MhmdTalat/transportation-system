/**
 * RATING Scene: "Calm"
 * Drifting circles + bouncing stars
 * Duration: 12s loop (circles), 1.5s stars on trigger
 */

import { motion } from 'motion/react'
import { getOpacity } from '../../../effects.config'

export interface RatingSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function RatingScene({
  intensity = 1,
  paused = false,
}: RatingSceneProps) {
  const opacityCircles = getOpacity('radarSweep', intensity) * 0.4
  const opacityStars = getOpacity('radarSweep', intensity) * 1

  return (
    <svg className="rating-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Drifting circles */}
      {Array.from({ length: 5 }).map((_, idx) => (
        <motion.circle
          key={`circle-${idx}`}
          cx={200 + idx * 150}
          cy={400 + idx * 100}
          r={80 - idx * 10}
          fill="var(--color-accent)"
          opacity={opacityCircles}
          animate={
            paused
              ? {}
              : {
                  y: [0, 100, 0],
                  x: [0, 50, 0],
                }
          }
          transition={{
            duration: 12 + idx * 2,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      ))}

      {/* Stars (5-star rating) */}
      {Array.from({ length: 5 }).map((_, idx) => (
        <motion.g
          key={`star-${idx}`}
          initial={{ scale: 0, y: 200 }}
          animate={paused ? {} : { scale: [0, 1.2, 1], y: 0 }}
          transition={{
            duration: 0.6,
            ease: 'easeOut',
            delay: idx * 0.15,
          }}
          style={{ transformOrigin: `${300 + idx * 120}px 1400px` }}
        >
          <polygon
            points={`${300 + idx * 120},1300 ${310 + idx * 120},1330 ${340 + idx * 120},1330 ${320 + idx * 120},1350 ${330 + idx * 120},1380 ${300 + idx * 120},1360 ${270 + idx * 120},1380 ${280 + idx * 120},1350 ${260 + idx * 120},1330 ${290 + idx * 120},1330`}
            fill="var(--color-accent)"
            opacity={opacityStars}
          />
        </motion.g>
      ))}
    </svg>
  )
}
