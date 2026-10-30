/**
 * LOGIN Scene: "Flow"
 * Soft shapes drifting, rotating contours
 * Duration: 60s ambient loop
 */

import { motion } from 'motion/react'
import { getOpacity } from '../../../effects.config'

export interface LoginSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function LoginScene({
  intensity = 1,
  speed = 1,
  paused = false,
}: LoginSceneProps) {
  const opacity = getOpacity('contours', intensity)

  const durations = [45000, 60000, 75000, 90000].map((d) => Math.round((d / speed) / 1000))

  return (
    <svg className="login-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Soft blob shapes drifting */}
      <motion.circle
        cx="200"
        cy="500"
        r="150"
        fill="var(--color-accent)"
        opacity={opacity * 0.4}
        animate={
          paused
            ? {}
            : {
                x: [0, 200, 0],
                y: [0, 300, 0],
              }
        }
        transition={{ duration: 40, ease: 'easeInOut', repeat: Infinity }}
      />

      <motion.circle
        cx="800"
        cy="1200"
        r="120"
        fill="var(--color-accent)"
        opacity={opacity * 0.3}
        animate={
          paused
            ? {}
            : {
                x: [0, -150, 0],
                y: [0, -200, 0],
              }
        }
        transition={{ duration: 50, ease: 'easeInOut', repeat: Infinity }}
      />

      <motion.ellipse
        cx="540"
        cy="960"
        rx="100"
        ry="200"
        fill="var(--color-accent)"
        opacity={opacity * 0.35}
        animate={paused ? {} : { x: [0, 100, -100, 0] }}
        transition={{ duration: 45, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Rotating contour ellipses */}
      <motion.ellipse
        cx="540"
        cy="960"
        rx="200"
        ry="300"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacity * 0.4}
        animate={paused ? {} : { rotate: 360 }}
        transition={{ duration: durations[0], ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '540px 960px' }}
      />

      <motion.ellipse
        cx="540"
        cy="960"
        rx="250"
        ry="350"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacity * 0.3}
        animate={paused ? {} : { rotate: -360 }}
        transition={{ duration: durations[1], ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '540px 960px' }}
      />

      <motion.ellipse
        cx="540"
        cy="960"
        rx="180"
        ry="280"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacity * 0.35}
        animate={paused ? {} : { rotate: 360 }}
        transition={{ duration: durations[2], ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '540px 960px' }}
      />

      <motion.ellipse
        cx="540"
        cy="960"
        rx="300"
        ry="400"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity={opacity * 0.25}
        animate={paused ? {} : { rotate: -360 }}
        transition={{ duration: durations[3], ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '540px 960px' }}
      />
    </svg>
  )
}
