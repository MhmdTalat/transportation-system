/**
 * SEARCHING Scene: "Radar"
 * 3 expanding rings, rotating wedge, center pin, blips
 * Duration: 4s loop
 */

import { motion } from 'motion/react'
import { getOpacity, getDuration } from '../../../effects.config'

export interface SearchingSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function SearchingScene({
  intensity = 1,
  speed = 1,
  paused = false,
}: SearchingSceneProps) {
  const opacity = getOpacity('radarSweep', intensity)
  const blipOpacity = getOpacity('radarBlip', intensity)
  const duration = getDuration('radarSweep', speed)
  const maxRadius = 300

  return (
    <svg className="searching-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="radarWedge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-accent)" stopOpacity={opacity} />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Center pickup pin */}
      <circle cx="540" cy="960" r="8" fill="var(--color-accent)" opacity={opacity} className="radar-pin" />

      {/* Rotating wedge */}
      <motion.g
        animate={paused ? {} : { rotate: 360 }}
        transition={{ duration: duration / 1000, ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '540px 960px' }}
      >
        <path
          d={`M 540 960 L ${540 + maxRadius * Math.cos(-Math.PI / 3.5)} ${960 + maxRadius * Math.sin(-Math.PI / 3.5)} A ${maxRadius} ${maxRadius} 0 0 1 ${540 + maxRadius * Math.cos(Math.PI / 3.5)} ${960 + maxRadius * Math.sin(Math.PI / 3.5)} Z`}
          fill="url(#radarWedge)"
          opacity={opacity}
        />
      </motion.g>

      {/* Ring 1 */}
      <motion.circle cx="540" cy="960" r={maxRadius * 0.33} fill="none" stroke="var(--color-accent)" strokeWidth="2" animate={paused ? {} : { opacity: [opacity * 0.6, opacity * 0.2, opacity * 0.6] }} transition={{ duration: duration / 1000, ease: 'linear', repeat: Infinity }} />

      {/* Ring 2 */}
      <motion.circle cx="540" cy="960" r={maxRadius * 0.66} fill="none" stroke="var(--color-accent)" strokeWidth="2" animate={paused ? {} : { opacity: [opacity * 0.6, opacity * 0.2, opacity * 0.6] }} transition={{ duration: duration / 1000, ease: 'linear', repeat: Infinity, delay: (duration * 0.33) / 1000 }} />

      {/* Ring 3 */}
      <motion.circle cx="540" cy="960" r={maxRadius} fill="none" stroke="var(--color-accent)" strokeWidth="2" animate={paused ? {} : { opacity: [opacity * 0.6, opacity * 0.2, opacity * 0.6] }} transition={{ duration: duration / 1000, ease: 'linear', repeat: Infinity, delay: (duration * 0.66) / 1000 }} />

      {/* Blips */}
      {Array.from({ length: 4 }).map((_, idx) => {
        const angle = (idx * 360) / 4
        const blipRadius = maxRadius * 0.5
        return (
          <motion.circle
            key={`blip-${idx}`}
            cx={540 + blipRadius * Math.cos((angle * Math.PI) / 180)}
            cy={960 + blipRadius * Math.sin((angle * Math.PI) / 180)}
            r="5"
            fill="var(--color-accent)"
            animate={paused ? {} : { opacity: [blipOpacity, 0, blipOpacity] }}
            transition={{
              duration: duration / 1000,
              ease: 'linear',
              repeat: Infinity,
              delay: (-angle / 360) * (duration / 1000),
            }}
          />
        )
      })}
    </svg>
  )
}
