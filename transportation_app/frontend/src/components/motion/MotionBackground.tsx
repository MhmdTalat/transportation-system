/**
 * MotionBackground Component
 *
 * Unified wrapper for all 9 motion graphics scenes.
 * Lazy-loads scenes, handles pausing on focus loss, respects reduce-motion.
 *
 * Usage:
 * <MotionBackground scene="home" intensity={0.8} speed={1} paused={false} loop />
 *
 * Props:
 * - scene: 'home' | 'searching' | 'matched' | 'inTrip' | 'payment' | 'login' | 'rating' | 'error' | 'idle'
 * - intensity?: 0-1 (opacity multiplier, default 1)
 * - speed?: 0.5-2 (duration multiplier, default 1)
 * - paused?: boolean (pause animation)
 * - loop?: boolean (restart after completion, default true)
 */

import { Suspense, lazy, CSSProperties, useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useScreenFocus } from '../../hooks/useScreenFocus'
import './MotionBackground.css'

// Lazy-load all scene components
const HomeScene = lazy(() => import('./scenes/HomeScene').then(m => ({ default: m.HomeScene })))
const SearchingScene = lazy(() => import('./scenes/SearchingScene').then(m => ({ default: m.SearchingScene })))
const MatchedScene = lazy(() => import('./scenes/MatchedScene').then(m => ({ default: m.MatchedScene })))
const InTripScene = lazy(() => import('./scenes/InTripScene').then(m => ({ default: m.InTripScene })))
const PaymentScene = lazy(() => import('./scenes/PaymentScene').then(m => ({ default: m.PaymentScene })))
const LoginScene = lazy(() => import('./scenes/LoginScene').then(m => ({ default: m.LoginScene })))
const RatingScene = lazy(() => import('./scenes/RatingScene').then(m => ({ default: m.RatingScene })))
const ErrorScene = lazy(() => import('./scenes/ErrorScene').then(m => ({ default: m.ErrorScene })))
const IdleScene = lazy(() => import('./scenes/IdleScene').then(m => ({ default: m.IdleScene })))

export type SceneType = 'home' | 'searching' | 'matched' | 'inTrip' | 'payment' | 'login' | 'rating' | 'error' | 'idle'

export interface MotionBackgroundProps {
  scene: SceneType
  intensity?: number
  speed?: number
  paused?: boolean
  loop?: boolean
  style?: CSSProperties
  className?: string
  onComplete?: () => void
}

export function MotionBackground({
  scene,
  intensity = 1,
  speed = 1,
  paused: externalPaused = false,
  loop = true,
  style,
  className = '',
  onComplete,
}: MotionBackgroundProps) {
  const reducedMotion = useReducedMotion()
  const isFocused = useScreenFocus()
  const paused = externalPaused || reducedMotion || !isFocused
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete()
    }
  }, [isComplete, onComplete])

  const handleComplete = () => {
    if (!loop) {
      setIsComplete(true)
    }
  }

  const containerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
    ...style,
  }

  const sceneProps = {
    intensity,
    speed,
    paused,
    onComplete: handleComplete,
  }

  const renderScene = () => {
    switch (scene) {
      case 'home':
        return <HomeScene {...sceneProps} />
      case 'searching':
        return <SearchingScene {...sceneProps} />
      case 'matched':
        return <MatchedScene {...sceneProps} />
      case 'inTrip':
        return <InTripScene {...sceneProps} />
      case 'payment':
        return <PaymentScene {...sceneProps} />
      case 'login':
        return <LoginScene {...sceneProps} />
      case 'rating':
        return <RatingScene {...sceneProps} />
      case 'error':
        return <ErrorScene {...sceneProps} />
      case 'idle':
        return <IdleScene {...sceneProps} />
      default:
        return null
    }
  }

  return (
    <div
      className={`motion-background motion-background--${scene}${paused ? ' is-paused' : ''}${reducedMotion ? ' is-static' : ''} ${className}`.trim()}
      style={containerStyle}
      aria-hidden="true"
      data-testid={`scene-${scene}`}
    >
      <Suspense fallback={null}>
        {renderScene()}
      </Suspense>
    </div>
  )
}
