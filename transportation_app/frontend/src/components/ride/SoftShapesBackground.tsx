import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

import { useDecorativeMotion } from './useDecorativeMotion'

export interface SoftShapesBackgroundProps {
  color?: string
  speed?: number
  intensity?: number
  paused?: boolean
}

/**
 * Usage: <SoftShapesBackground color="var(--color-accent)" speed={1} intensity={0.15} />
 * Login, recovery, and booking-complete surfaces.
 */
export function SoftShapesBackground({
  color,
  speed = 1,
  intensity = 0.15,
  paused = false,
}: SoftShapesBackgroundProps) {
  const { ref, shouldPause, reducedMotion } = useDecorativeMotion(paused)
  const durationScale = Math.max(0.25, speed)
  const shapeOpacity = Math.max(0.1, Math.min(0.2, intensity))
  const style = {
    '--soft-shape-color': color || 'var(--color-accent)',
    '--soft-shape-opacity': shapeOpacity.toString(),
    pointerEvents: 'none',
  } as CSSProperties

  return (
    <div
      ref={ref}
      className={`soft-shapes-background${shouldPause ? ' is-paused' : ''}${reducedMotion ? ' is-static' : ''}`}
      style={style}
      aria-hidden="true"
      data-testid="soft-shapes-background"
    >
      <motion.span
        className="soft-shape soft-shape-a"
        animate={shouldPause ? undefined : { x: [0, 36, 0], y: [0, 28, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 7 / durationScale, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="soft-shape soft-shape-b"
        animate={shouldPause ? undefined : { x: [0, -28, 0], y: [0, 36, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 9 / durationScale, repeat: Infinity, ease: 'easeInOut', delay: 0.4 / durationScale }}
      />
      <motion.span
        className="soft-shape soft-shape-c"
        animate={shouldPause ? undefined : { x: [0, 24, 0], y: [0, -42, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 11 / durationScale, repeat: Infinity, ease: 'easeInOut', delay: 0.8 / durationScale }}
      />
      <span className="soft-shape soft-shape-neutral" />
    </div>
  )
}
