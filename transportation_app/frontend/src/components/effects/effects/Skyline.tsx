/**
 * Skyline Effect
 *
 * Three animated layers for home screen ambient feeling:
 * - Far buildings: 24s slow loop (15% opacity)
 * - Near buildings: 10s medium loop (20% opacity)
 * - Road with dashed lane marks: 1.6s fast loop (seamless)
 *
 * Performance: ~3 animated nodes (3 SVG paths with different durations)
 * FPS: 60fps on low-end device
 */

import { motion } from 'motion/react'
import { effectsConfig, getOpacity, getDuration } from '../../../effects.config'
import './Skyline.css'

export interface SkylineProps {
  color?: string
  intensity?: number
  speed?: number
  paused?: boolean
}

export function Skyline({
  color = 'var(--color-accent, #1D9E75)',
  intensity = 1,
  speed = 1,
  paused = false,
}: SkylineProps) {
  const opacitySkyline = getOpacity('skyline', intensity)
  const durationFar = getDuration('skylineFar', speed)
  const durationNear = getDuration('skylineNear', speed)
  const durationRoad = getDuration('skylineRoad', speed)

  return (
    <svg
      className="skyline"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* Gradient for buildings (fade in from top) */}
        <linearGradient
          id="skylineGradientFar"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor={color} stopOpacity={opacitySkyline * 0.3} />
          <stop
            offset="60%"
            stopColor={color}
            stopOpacity={opacitySkyline}
          />
          <stop offset="100%" stopColor={color} stopOpacity={opacitySkyline * 0.5} />
        </linearGradient>

        <linearGradient
          id="skylineGradientNear"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor={color} stopOpacity={opacitySkyline * 0.4} />
          <stop
            offset="50%"
            stopColor={color}
            stopOpacity={opacitySkyline * 1.2}
          />
          <stop offset="100%" stopColor={color} stopOpacity={opacitySkyline} />
        </linearGradient>
      </defs>

      {/* FAR BUILDINGS LAYER (slowest, smallest) */}
      <motion.g
        className="skyline-far"
        animate={paused ? {} : { x: [-1000, 0] }}
        transition={{
          duration: durationFar / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        <path
          d={generateFarBuildingsPath()}
          fill="url(#skylineGradientFar)"
          className="skyline-far-path"
        />
        {/* Seamless loop: repeat pattern */}
        <path
          d={generateFarBuildingsPath()}
          fill="url(#skylineGradientFar)"
          className="skyline-far-path"
          transform="translate(1000, 0)"
        />
      </motion.g>

      {/* NEAR BUILDINGS LAYER (medium speed, larger) */}
      <motion.g
        className="skyline-near"
        animate={paused ? {} : { x: [-1000, 0] }}
        transition={{
          duration: durationNear / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        <path
          d={generateNearBuildingsPath()}
          fill="url(#skylineGradientNear)"
          className="skyline-near-path"
        />
        {/* Seamless loop: repeat pattern */}
        <path
          d={generateNearBuildingsPath()}
          fill="url(#skylineGradientNear)"
          className="skyline-near-path"
          transform="translate(1000, 0)"
        />
      </motion.g>

      {/* ROAD LAYER with DASHED LANE MARKS (fastest loop) */}
      <motion.g
        className="skyline-road"
        animate={paused ? {} : { x: [-1000, 0] }}
        transition={{
          duration: durationRoad / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {/* Road background */}
        <rect
          x="0"
          y="450"
          width="2000"
          height="150"
          fill={color}
          opacity={opacitySkyline * 0.15}
        />

        {/* Dashed lane marks */}
        {Array.from({ length: 40 }).map((_, i) => (
          <line
            key={`dash-${i}`}
            x1={i * 50 + 25}
            y1="525"
            x2={i * 50 + 50}
            y2="525"
            stroke={color}
            strokeWidth="3"
            opacity={opacitySkyline * 0.25}
            strokeDasharray="30,20"
            className="skyline-dash"
          />
        ))}

        {/* Repeat for seamless loop */}
        <rect
          x="1000"
          y="450"
          width="2000"
          height="150"
          fill={color}
          opacity={opacitySkyline * 0.15}
        />

        {Array.from({ length: 40 }).map((_, i) => (
          <line
            key={`dash-repeat-${i}`}
            x1={1000 + i * 50 + 25}
            y1="525"
            x2={1000 + i * 50 + 50}
            y2="525"
            stroke={color}
            strokeWidth="3"
            opacity={opacitySkyline * 0.25}
            strokeDasharray="30,20"
            className="skyline-dash"
          />
        ))}
      </motion.g>
    </svg>
  )
}

/**
 * Generate far buildings silhouette (smaller, more distant)
 */
function generateFarBuildingsPath(): string {
  const buildings = [
    { x: 50, height: 150 },
    { x: 120, height: 200 },
    { x: 180, height: 120 },
    { x: 250, height: 180 },
    { x: 320, height: 140 },
    { x: 390, height: 210 },
    { x: 460, height: 160 },
    { x: 530, height: 190 },
    { x: 600, height: 130 },
    { x: 670, height: 170 },
    { x: 740, height: 180 },
    { x: 810, height: 150 },
    { x: 880, height: 200 },
    { x: 950, height: 140 },
  ]

  let path = 'M 0 400'

  for (const building of buildings) {
    path += ` L ${building.x} ${400 - building.height}`
    path += ` L ${building.x + 60} ${400 - building.height}`
    path += ` L ${building.x + 60} 400`
  }

  path += ' L 1000 400 Z'
  return path
}

/**
 * Generate near buildings silhouette (larger, closer)
 */
function generateNearBuildingsPath(): string {
  const buildings = [
    { x: 0, height: 220 },
    { x: 100, height: 280 },
    { x: 200, height: 240 },
    { x: 300, height: 260 },
    { x: 400, height: 200 },
    { x: 500, height: 290 },
    { x: 600, height: 210 },
    { x: 700, height: 250 },
    { x: 800, height: 270 },
    { x: 900, height: 220 },
  ]

  let path = 'M 0 350'

  for (const building of buildings) {
    path += ` L ${building.x} ${350 - building.height}`
    path += ` L ${building.x + 90} ${350 - building.height}`
    path += ` L ${building.x + 90} 350`
  }

  path += ' L 1000 350 Z'
  return path
}
