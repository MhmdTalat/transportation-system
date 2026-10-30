/**
 * PAYMENT Scene: "Burst"
 * Checkmark draws, confetti bursts
 * Duration: 2s play-once
 */

import { motion } from 'motion/react'
import { getOpacity } from '../../../effects.config'

export interface PaymentSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function PaymentScene({
  intensity = 1,
  paused = false,
  onComplete,
}: PaymentSceneProps) {
  const opacityCheck = getOpacity('radarSweep', intensity) * 1.7
  const opacityConfetti = opacityCheck * 0.85

  const confetti = Array.from({ length: 10 }).map((_, i) => ({
    id: i,
    angle: (i * 360) / 10,
    distance: 100 + Math.random() * 50,
    delay: 0.6,
    duration: 0.8,
  }))

  return (
    <svg className="payment-scene" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      {/* Checkmark */}
      <motion.path
        d="M 450 900 L 520 970 L 620 870"
        stroke="var(--color-accent)"
        strokeWidth="8"
        fill="none"
        opacity={opacityCheck}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="200"
        animate={paused ? {} : { strokeDashoffset: [200, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* Confetti burst */}
      {confetti.map((piece) => {
        const x = Math.cos((piece.angle * Math.PI) / 180) * piece.distance
        const y = Math.sin((piece.angle * Math.PI) / 180) * piece.distance
        const shape = piece.id % 3

        return (
          <motion.g
            key={`confetti-${piece.id}`}
            initial={{ x: 540, y: 960, opacity: opacityConfetti }}
            animate={
              paused
                ? {}
                : {
                    x: [540, 540 + x],
                    y: [960, 960 + y],
                    opacity: [opacityConfetti, 0],
                    rotate: [0, 360],
                  }
            }
            transition={{
              duration: piece.duration,
              ease: 'easeOut',
              delay: piece.delay,
            }}
            onAnimationComplete={onComplete}
          >
            {shape === 0 && <rect x="-6" y="-6" width="12" height="12" fill="var(--color-accent)" />}
            {shape === 1 && <circle r="5" fill="var(--color-accent)" />}
            {shape === 2 && <polygon points="0,-8 8,8 -8,8" fill="var(--color-accent)" />}
          </motion.g>
        )
      })}
    </svg>
  )
}
