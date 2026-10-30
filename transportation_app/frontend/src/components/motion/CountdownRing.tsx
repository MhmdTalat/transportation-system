/**
 * CountdownRing
 *
 * Circular countdown animation for driver offer screen.
 * Ring fills from empty to full over 15 seconds.
 * Optional haptic feedback tick each second.
 *
 * Animation spec:
 * - Duration: 15 seconds
 * - Linear easing (constant speed)
 * - Stroke animation (strokeDashoffset)
 * - Optional haptic vibration each second
 * - Never blocks interaction
 *
 * Usage:
 * <CountdownRing totalSeconds={15} onTick={handleTick} />
 * <CountdownRing size="120px" color="var(--color-accent)" />
 * <CountdownRing isFinished={true} />
 */

import { useEffect, useState, useRef } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { duration, easing } from '../../motion'
import './CountdownRing.css'

export interface CountdownRingProps {
  totalSeconds?: number
  size?: string
  strokeWidth?: number
  color?: string
  onTick?: (secondsRemaining: number) => void
  onComplete?: () => void
  isFinished?: boolean
  hapticFeedback?: boolean
}

export function CountdownRing({
  totalSeconds = 15,
  size = '120px',
  strokeWidth = 4,
  color = 'var(--color-accent)',
  onTick,
  onComplete,
  isFinished = false,
  hapticFeedback = true,
}: CountdownRingProps) {
  const prefersReducedMotion = useReducedMotion()
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasCompletedRef = useRef(false)

  // Extract numeric size value
  const sizeValue = parseInt(size)
  const radius = (sizeValue - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius

  // Start countdown on mount
  useEffect(() => {
    if (isFinished || prefersReducedMotion) return

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1

        // Haptic feedback (if available and enabled)
        if (hapticFeedback && navigator.vibrate) {
          navigator.vibrate(50)
        }

        // Call tick callback
        onTick?.(next)

        // Complete callback on zero
        if (next <= 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true
          onComplete?.()
        }

        return Math.max(0, next)
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isFinished, prefersReducedMotion, onTick, onComplete, hapticFeedback])

  // Calculate dash offset (progress from full to empty)
  const progress = 1 - secondsRemaining / totalSeconds
  const strokeDashoffset = circumference * (1 - progress)

  // Reduced motion: show static indicator
  if (prefersReducedMotion) {
    return (
      <div
        className="countdown-ring countdown-ring--reduced"
        style={{ width: size, height: size }}
      >
        <div className="countdown-ring__label">
          <span className="countdown-ring__time">{secondsRemaining}s</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`countdown-ring ${isFinished ? 'countdown-ring--finished' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        className="countdown-ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${sizeValue} ${sizeValue}`}
      >
        {/* Background circle */}
        <circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          className="countdown-ring__background"
        />

        {/* Progress ring */}
        <motion.circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          className="countdown-ring__progress"
          style={{
            stroke: color,
            strokeWidth,
            strokeDasharray: circumference,
            strokeDashoffset: isFinished ? 0 : strokeDashoffset,
          }}
          animate={{
            strokeDashoffset: isFinished ? 0 : circumference * 0,
          }}
          transition={{
            duration: totalSeconds,
            ease: easing.linear,
          }}
        />
      </svg>

      {/* Center label with time */}
      <div className="countdown-ring__label">
        <span className="countdown-ring__time">{secondsRemaining}s</span>
      </div>
    </div>
  )
}

/**
 * CountdownRingCompact
 *
 * Smaller variant for use in buttons or headers.
 * Shows only ring without time label.
 */

export function CountdownRingCompact({
  totalSeconds = 15,
  size = '48px',
  color = 'var(--color-accent)',
}: Omit<CountdownRingProps, 'onTick' | 'onComplete' | 'isFinished'>) {
  const prefersReducedMotion = useReducedMotion()
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds)

  useEffect(() => {
    if (prefersReducedMotion) return

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  const sizeValue = parseInt(size)
  const strokeWidth = 2
  const radius = (sizeValue - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = 1 - secondsRemaining / totalSeconds
  const strokeDashoffset = circumference * (1 - progress)

  if (prefersReducedMotion) {
    return (
      <div
        className="countdown-ring-compact countdown-ring-compact--reduced"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <svg
      className="countdown-ring-compact"
      width={size}
      height={size}
      viewBox={`0 0 ${sizeValue} ${sizeValue}`}
    >
      <circle
        cx={sizeValue / 2}
        cy={sizeValue / 2}
        r={radius}
        className="countdown-ring-compact__background"
      />

      <motion.circle
        cx={sizeValue / 2}
        cy={sizeValue / 2}
        r={radius}
        className="countdown-ring-compact__progress"
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: circumference,
          strokeDashoffset,
        }}
        animate={{
          strokeDashoffset: 0,
        }}
        transition={{
          duration: totalSeconds,
          ease: easing.linear,
        }}
      />
    </svg>
  )
}
