/**
 * BackgroundEffect
 *
 * Unified wrapper component for all background animations.
 * Selects effect by type and passes props through.
 *
 * Usage:
 * <BackgroundEffect type="radarSweep" intensity={0.8} speed={1} />
 * <BackgroundEffect type="skyline" color="var(--color-accent)" />
 *
 * Props:
 * - type: 'radarSweep' | 'skyline' | 'speedLines' | 'contours' | 'dotWave' | 'rain' | 'glow' | 'glass'
 * - color?: CSS color string (defaults to brand color from theme)
 * - intensity?: 0-1 (opacity multiplier; default 1)
 * - speed?: 0.5-2 (duration multiplier; default 1)
 * - paused?: boolean (pause animations)
 * - style?: React.CSSProperties (additional container styles)
 */

import { CSSProperties, Suspense, lazy } from 'react'
import { useReducedMotion } from 'motion/react'
import { useScreenFocus } from '../../hooks/useScreenFocus'
import './BackgroundEffect.css'

// Lazy-load effect components (code-split)
const RadarSweepEffect = lazy(() =>
  import('./effects/RadarSweep').then((m) => ({ default: m.RadarSweep })),
)
const SkylineEffect = lazy(() =>
  import('./effects/Skyline').then((m) => ({ default: m.Skyline })),
)
const SpeedLinesEffect = lazy(() =>
  import('./effects/SpeedLines').then((m) => ({ default: m.SpeedLines })),
)
const ContoursEffect = lazy(() =>
  import('./effects/Contours').then((m) => ({ default: m.Contours })),
)
const DotWaveEffect = lazy(() =>
  import('./effects/DotWave').then((m) => ({ default: m.DotWave })),
)
const RainEffect = lazy(() =>
  import('./effects/Rain').then((m) => ({ default: m.Rain })),
)
const GlowEffect = lazy(() =>
  import('./effects/Glow').then((m) => ({ default: m.Glow })),
)
const GlassEffect = lazy(() =>
  import('./effects/Glass').then((m) => ({ default: m.Glass })),
)

export type EffectType =
  | 'radarSweep'
  | 'skyline'
  | 'speedLines'
  | 'contours'
  | 'dotWave'
  | 'rain'
  | 'glow'
  | 'glass'

export interface BackgroundEffectProps {
  type: EffectType
  color?: string
  intensity?: number
  speed?: number
  paused?: boolean
  style?: CSSProperties
  className?: string
}

export function BackgroundEffect({
  type,
  color = 'var(--color-accent, #1D9E75)',
  intensity = 1,
  speed = 1,
  paused: externalPaused = false,
  style,
  className = '',
}: BackgroundEffectProps) {
  const reducedMotion = useReducedMotion()
  const isFocused = useScreenFocus()
  const paused = externalPaused || reducedMotion || !isFocused

  const containerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
    ...style,
  }

  // Render appropriate effect or fallback
  const renderEffect = () => {
    const commonProps = {
      color,
      intensity,
      speed,
      paused,
    }

    switch (type) {
      case 'radarSweep':
        return <RadarSweepEffect {...commonProps} />
      case 'skyline':
        return <SkylineEffect {...commonProps} />
      case 'speedLines':
        return <SpeedLinesEffect {...commonProps} />
      case 'contours':
        return <ContoursEffect {...commonProps} />
      case 'dotWave':
        return <DotWaveEffect {...commonProps} />
      case 'rain':
        return <RainEffect {...commonProps} />
      case 'glow':
        return <GlowEffect {...commonProps} />
      case 'glass':
        return <GlassEffect {...commonProps} />
      default:
        console.warn(`Unknown effect type: ${type}`)
        return null
    }
  }

  return (
    <div
      className={`background-effect background-effect--${type}${paused ? ' is-paused' : ''}${reducedMotion ? ' is-static' : ''} ${className}`.trim()}
      style={containerStyle}
      aria-hidden="true"
      data-testid={`effect-${type}`}
    >
      <Suspense fallback={null}>{renderEffect()}</Suspense>
    </div>
  )
}
