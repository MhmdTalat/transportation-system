/**
 * RadarSweep Effect
 *
 * Rotating 70-degree wedge with 3 range rings and fading blips.
 * Used for: searching for driver, dispatch waiting, tracking active.
 *
 * Animation spec:
 * - 4s continuous rotation
 * - 3 rings expanding outward
 * - Blips fade as wedge passes
 * - 30% opacity
 *
 * Performance: ~6 animated nodes (1 wedge + 3 rings + 2 blip groups)
 * FPS: 60fps on low-end device
 */

import { motion } from 'motion/react'
import { effectsConfig, getOpacity, getDuration } from '../../../effects.config'
import './RadarSweep.css'

export interface RadarSweepProps {
  color?: string
  intensity?: number
  speed?: number
  paused?: boolean
}

export function RadarSweep({
  color = 'var(--color-accent, #1D9E75)',
  intensity = 1,
  speed = 1,
  paused = false,
}: RadarSweepProps) {
  const opacity = getOpacity('radarSweep', intensity)
  const blipOpacity = getOpacity('radarBlip', intensity)
  const duration = getDuration('radarSweep', speed)
  const maxRadius = effectsConfig.sizes.radarRingMaxRadius

  // Three range rings at different radii
  const rings = [
    { radius: maxRadius * 0.33, delay: 0 },
    { radius: maxRadius * 0.66, delay: -duration * 0.33 },
    { radius: maxRadius, delay: -duration * 0.66 },
  ]

  return (
    <svg
      className="radar-sweep"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* Gradient for wedge (fade out at edges) */}
        <linearGradient id="radarWedgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity={opacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>

        {/* Gradient for rings */}
        <radialGradient id="radarRingGradient">
          <stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Static center pin */}
      <circle
        cx="200"
        cy="200"
        r="6"
        fill={color}
        opacity={opacity}
        className="radar-center"
      />

      {/* Animated rotating wedge (70 degrees) */}
      <motion.g
        className="radar-wedge-group"
        animate={paused ? {} : { rotate: 360 }}
        transition={{
          duration: duration / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
        style={{ transformOrigin: '200px 200px' }}
      >
        <path
          className="radar-wedge"
          d={generateWedgePath(200, 200, effectsConfig.sizes.radarRingMaxRadius, 70)}
          fill="url(#radarWedgeGradient)"
          opacity={opacity}
        />
      </motion.g>

      {/* Three range rings with staggered animation */}
      {rings.map((ring, idx) => (
        <motion.circle
          key={`ring-${idx}`}
          cx="200"
          cy="200"
          r={ring.radius}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity={opacity * 0.6}
          className="radar-ring"
          animate={
            paused
              ? {}
              : {
                  opacity: [opacity * 0.6, opacity * 0.2, opacity * 0.6],
                }
          }
          transition={{
            duration: duration / 1000,
            ease: 'linear',
            repeat: Infinity,
            delay: ring.delay / 1000,
          }}
        />
      ))}

      {/* Blips that fade as wedge passes */}
      {Array.from({ length: effectsConfig.counts.radarBlips }).map((_, idx) => {
        const angle = (idx * 360) / effectsConfig.counts.radarBlips
        const blipRadius = maxRadius * 0.5

        return (
          <motion.g
            key={`blip-${idx}`}
            className="radar-blip-group"
            animate={
              paused
                ? {}
                : {
                    opacity: [blipOpacity, 0, blipOpacity],
                  }
            }
            transition={{
              duration: duration / 1000,
              ease: 'linear',
              repeat: Infinity,
              delay: (-angle / 360) * (duration / 1000),
            }}
          >
            <circle
              cx={200 + blipRadius * Math.cos((angle * Math.PI) / 180)}
              cy={200 + blipRadius * Math.sin((angle * Math.PI) / 180)}
              r="4"
              fill={color}
              opacity={blipOpacity}
            />
          </motion.g>
        )
      })}
    </svg>
  )
}

/**
 * Generate SVG path for 70-degree radar wedge
 * Centered at (cx, cy) with given radius
 */
function generateWedgePath(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): string {
  const angleRad = (angleDegrees * Math.PI) / 180
  const startAngle = -angleRad / 2
  const endAngle = angleRad / 2

  const x1 = cx + radius * Math.cos(startAngle)
  const y1 = cy + radius * Math.sin(startAngle)
  const x2 = cx + radius * Math.cos(endAngle)
  const y2 = cy + radius * Math.sin(endAngle)

  const largeArc = angleDegrees > 180 ? 1 : 0

  return `
    M ${cx} ${cy}
    L ${x1} ${y1}
    A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
    Z
  `
}
