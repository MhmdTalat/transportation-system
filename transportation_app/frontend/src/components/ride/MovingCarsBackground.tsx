import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

import { useDecorativeMotion } from './useDecorativeMotion'

export interface MovingCarsBackgroundProps {
  color?: string
  speed?: number
  intensity?: number
  paused?: boolean
}

/**
 * Usage: <MovingCarsBackground color="var(--color-accent)" speed={1} intensity={0.75} />
 * Home map preview only. Do not place behind a live tracking map.
 */
export function MovingCarsBackground({
  color,
  speed = 1,
  intensity = 0.75,
  paused = false,
}: MovingCarsBackgroundProps) {
  const { ref, shouldPause, reducedMotion } = useDecorativeMotion(paused)
  const durationScale = Math.max(0.25, speed)
  const style = {
    '--moving-cars-color': color || 'var(--color-accent)',
    '--moving-cars-opacity': Math.max(0, Math.min(1, intensity)).toString(),
    pointerEvents: 'none',
  } as CSSProperties
  const durationA = 6 / durationScale
  const durationB = 7 / durationScale
  const durationC = 8 / durationScale
  const loop = shouldPause ? undefined : {
    ease: 'linear' as const,
  }

  return (
    <div
      ref={ref}
      className={`moving-cars-background${shouldPause ? ' is-paused' : ''}${reducedMotion ? ' is-static' : ''}`}
      style={style}
      aria-hidden="true"
      data-testid="moving-cars-background"
    >
      <svg className="moving-cars-roads" viewBox="0 0 800 280" preserveAspectRatio="none">
        <path className="moving-cars-grid-road" d="M-20 76H820 M-20 208H820 M178 -20V300 M610 -20V300" />
        <motion.path
          className="moving-cars-route"
          d="M82 218H300V138H535V70H718"
          animate={shouldPause ? undefined : { strokeDashoffset: [0, -24] }}
          transition={{ duration: 2.5 / durationScale, repeat: Infinity, ease: 'linear' }}
        />
        <circle className="moving-cars-destination" cx="718" cy="70" r="9" />
        <motion.g
          className="moving-car moving-car-a"
          animate={loop ? { x: [40, 760], y: [76, 76], rotate: [0, 0] } : undefined}
          transition={{ duration: durationA, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '0 0' }}
        >
          <CarShape />
        </motion.g>
        <motion.g
          className="moving-car moving-car-b"
          animate={loop ? { x: [760, 40], y: [208, 208], rotate: [180, 180] } : undefined}
          transition={{ duration: durationB, repeat: Infinity, ease: 'linear' }}
        >
          <CarShape truck />
        </motion.g>
        <motion.g
          className="moving-car moving-car-c"
          animate={loop ? { x: [178, 178], y: [260, 20], rotate: [-90, -90] } : undefined}
          transition={{ duration: durationC, repeat: Infinity, ease: 'linear' }}
        >
          <CarShape />
        </motion.g>
      </svg>
    </div>
  )
}

function CarShape({ truck = false }: { truck?: boolean }) {
  return (
    <g className="moving-car-shape" transform="translate(-13 -13)">
      <circle cx="13" cy="13" r="13" />
      <path
        d={truck
          ? 'M5 10h12v7H5zm1 7v3h3v-3m8 0v3h3v-3M8 7h6l2 3H6z'
          : 'M6 10l2-4h10l2 4h1v7H5v-7zm3 0h8l-1-2H10z'}
        fill="var(--color-text-on-accent)"
        stroke="none"
      />
    </g>
  )
}
