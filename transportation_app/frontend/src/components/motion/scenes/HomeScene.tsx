/**
 * HOME Scene: "City Drive"
 *
 * Parallax skyline (3 layers) + road with dashes + 2-3 crossing cars.
 * Duration: 24s (far layer is hero)
 * Easing: linear (parallax)
 * Opacity: 15% far, 20% mid, 25% road+cars
 */

import { motion } from 'motion/react'
import { getOpacity, getDuration } from '../../../effects.config'
import './HomeScene.css'

export interface HomeSceneProps {
  intensity?: number
  speed?: number
  paused?: boolean
  onComplete?: () => void
}

export function HomeScene({
  intensity = 1,
  speed = 1,
  paused = false,
}: HomeSceneProps) {
  const opacityFar = getOpacity('skyline', intensity) * 0.6  // 15%
  const opacityMid = getOpacity('skyline', intensity) * 0.8  // 20%
  const opacityRoad = getOpacity('skyline', intensity)       // 25%

  const durationFar = getDuration('skylineFar', speed)   // 24s
  const durationMid = getDuration('skylineNear', speed)  // 16s
  const durationRoad = getDuration('skylineRoad', speed) // 8s

  return (
    <svg
      className="home-scene"
      viewBox="0 0 1080 1920"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="homeFarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={opacityFar * 0.3} />
          <stop offset="60%" stopColor="var(--color-accent)" stopOpacity={opacityFar} />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={opacityFar * 0.5} />
        </linearGradient>

        <linearGradient id="homeMidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={opacityMid * 0.4} />
          <stop offset="50%" stopColor="var(--color-accent)" stopOpacity={opacityMid * 1.2} />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={opacityMid} />
        </linearGradient>
      </defs>

      {/* FAR BUILDINGS LAYER (slowest, smallest) */}
      <motion.g
        className="home-far"
        animate={paused ? {} : { x: [-1080, 0] }}
        transition={{
          duration: durationFar / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        <path
          d="M 50 600 L 120 450 L 180 480 L 250 400 L 320 470 L 390 420 L 460 490 L 530 400 L 600 470 L 670 450 L 740 480 L 810 430 L 880 470 L 950 440 L 1000 480 L 1080 500 L 1080 900 L 0 900 Z"
          fill="url(#homeFarGradient)"
          className="home-far-path"
        />
        <path
          d="M 50 600 L 120 450 L 180 480 L 250 400 L 320 470 L 390 420 L 460 490 L 530 400 L 600 470 L 670 450 L 740 480 L 810 430 L 880 470 L 950 440 L 1000 480 L 1080 500 L 1080 900 L 0 900 Z"
          fill="url(#homeFarGradient)"
          className="home-far-path"
          transform="translate(1080, 0)"
        />
      </motion.g>

      {/* MID BUILDINGS LAYER (medium speed) */}
      <motion.g
        className="home-mid"
        animate={paused ? {} : { x: [-1080, 0] }}
        transition={{
          duration: durationMid / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        <path
          d="M 0 900 L 80 650 L 160 680 L 240 600 L 320 700 L 400 620 L 480 750 L 560 650 L 640 720 L 720 680 L 800 760 L 880 700 L 960 750 L 1040 680 L 1080 750 L 1080 1200 L 0 1200 Z"
          fill="url(#homeMidGradient)"
          className="home-mid-path"
        />
        <path
          d="M 0 900 L 80 650 L 160 680 L 240 600 L 320 700 L 400 620 L 480 750 L 560 650 L 640 720 L 720 680 L 800 760 L 880 700 L 960 750 L 1040 680 L 1080 750 L 1080 1200 L 0 1200 Z"
          fill="url(#homeMidGradient)"
          className="home-mid-path"
          transform="translate(1080, 0)"
        />
      </motion.g>

      {/* ROAD LAYER (fast, seamless dashes) */}
      <motion.g
        className="home-road"
        animate={paused ? {} : { x: [-1080, 0] }}
        transition={{
          duration: durationRoad / 1000,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {/* Road background */}
        <rect x="0" y="1200" width="2160" height="300" fill="var(--color-accent)" opacity={opacityRoad * 0.15} />

        {/* Lane dashes */}
        {Array.from({ length: 40 }).map((_, i) => (
          <line
            key={`dash-${i}`}
            x1={i * 50 + 25}
            y1="1350"
            x2={i * 50 + 50}
            y2="1350"
            stroke="var(--color-accent)"
            strokeWidth="4"
            opacity={opacityRoad * 0.25}
            strokeDasharray="30,20"
            className="home-dash"
          />
        ))}

        {/* Road background repeat */}
        <rect x="1080" y="1200" width="2160" height="300" fill="var(--color-accent)" opacity={opacityRoad * 0.15} />

        {Array.from({ length: 40 }).map((_, i) => (
          <line
            key={`dash-repeat-${i}`}
            x1={1080 + i * 50 + 25}
            y1="1350"
            x2={1080 + i * 50 + 50}
            y2="1350"
            stroke="var(--color-accent)"
            strokeWidth="4"
            opacity={opacityRoad * 0.25}
            strokeDasharray="30,20"
            className="home-dash"
          />
        ))}
      </motion.g>

      {/* CAR 1 (crossing left to right, 2s loop) */}
      <motion.g
        className="home-car home-car-1"
        animate={paused ? {} : { x: [0, 1080] }}
        transition={{
          duration: 2.5,
          ease: 'linear',
          repeat: Infinity,
          delay: 0,
        }}
      >
        <rect x="200" y="1320" width="40" height="30" fill="var(--color-accent)" opacity={opacityRoad} rx="4" />
        <circle cx="210" cy="1345" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
        <circle cx="230" cy="1345" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
      </motion.g>

      {/* CAR 2 (crossing right to left, 3s loop, staggered start) */}
      <motion.g
        className="home-car home-car-2"
        animate={paused ? {} : { x: [1080, 0] }}
        transition={{
          duration: 3,
          ease: 'linear',
          repeat: Infinity,
          delay: 0.5,
        }}
      >
        <rect x="800" y="1310" width="40" height="30" fill="var(--color-accent)" opacity={opacityRoad} rx="4" />
        <circle cx="810" cy="1335" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
        <circle cx="830" cy="1335" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
      </motion.g>

      {/* CAR 3 (crossing left to right, 3.5s loop, different timing) */}
      <motion.g
        className="home-car home-car-3"
        animate={paused ? {} : { x: [0, 1080] }}
        transition={{
          duration: 3.5,
          ease: 'linear',
          repeat: Infinity,
          delay: 1.2,
        }}
      >
        <rect x="400" y="1330" width="40" height="30" fill="var(--color-accent)" opacity={opacityRoad} rx="4" />
        <circle cx="410" cy="1355" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
        <circle cx="430" cy="1355" r="4" fill="var(--color-accent)" opacity={opacityRoad * 0.8} />
      </motion.g>
    </svg>
  )
}
