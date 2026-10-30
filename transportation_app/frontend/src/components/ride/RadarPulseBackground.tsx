import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

import { useDecorativeMotion } from './useDecorativeMotion'

export interface RadarPulseBackgroundProps {
  color?: string
  speed?: number
  intensity?: number
  paused?: boolean
}

/**
 * Usage: <RadarPulseBackground color="var(--color-accent)" speed={1} intensity={0.75} />
 * Waiting / searching states only.
 */
export function RadarPulseBackground({
  color,
  speed = 1,
  intensity = 0.75,
  paused = false,
}: RadarPulseBackgroundProps) {
  const { ref, shouldPause, reducedMotion } = useDecorativeMotion(paused)
  const durationScale = Math.max(0.25, speed)
  const style = {
    '--radar-color': color || 'var(--color-accent)',
    '--radar-opacity': Math.max(0, Math.min(1, intensity)).toString(),
    pointerEvents: 'none',
  } as CSSProperties
  const duration = 3 / durationScale
  const ringAnimation = shouldPause ? undefined : { scale: [0.22, 1], opacity: [0.8, 0] }
  const dotAnimation = shouldPause ? undefined : { opacity: [0.25, 1, 0.25] }

  return (
    <div
      ref={ref}
      className={`radar-pulse-background${shouldPause ? ' is-paused' : ''}${reducedMotion ? ' is-static' : ''}`}
      style={style}
      aria-hidden="true"
      data-testid="radar-pulse-background"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          className={`radar-ring radar-ring-${['a', 'b', 'c'][index]}`}
          key={index}
          animate={ringAnimation}
          transition={{ duration, repeat: Infinity, delay: index / durationScale, ease: 'easeOut' }}
        />
      ))}
      {[0, 1, 2].map((index) => (
        <motion.span
          className={`radar-dot radar-dot-${['a', 'b', 'c'][index]}`}
          key={index}
          animate={dotAnimation}
          transition={{ duration: 2.4 / durationScale, repeat: Infinity, delay: index * 0.8 / durationScale, ease: 'easeInOut' }}
        />
      ))}
      <span className="radar-pin"><i className="bi bi-geo-alt-fill" /></span>
    </div>
  )
}
