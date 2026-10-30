/**
 * Skeleton
 *
 * Animated skeleton loader with shimmer effect.
 * Shows placeholder while content is loading.
 *
 * Animation spec:
 * - Shimmer loop: 1.2 seconds
 * - Linear easing
 * - Background gradient sweep left-to-right
 * - Respects prefers-reduced-motion (shows static placeholder)
 *
 * Usage:
 * <Skeleton width="100%" height="40px" />
 * <Skeleton variant="circle" />
 * <Skeleton variant="title" />
 * <Skeleton count={3} />
 */

import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { duration, easing } from '../../motion'
import './Skeleton.css'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'title' | 'circle' | 'rect' | 'button'
  count?: number
  className?: string
}

export function Skeleton({
  width = '100%',
  height = '16px',
  variant = 'text',
  count = 1,
  className = '',
}: SkeletonProps) {
  const prefersReducedMotion = useReducedMotion()

  // Variant presets
  const variants = {
    text: { width: '100%', height: '16px' },
    title: { width: '60%', height: '24px' },
    circle: { width: '40px', height: '40px', borderRadius: '50%' },
    rect: { width: '100%', height: '120px' },
    button: { width: '100%', height: '52px' },
  }

  const preset = variants[variant]
  const styles = {
    width: width || preset.width,
    height: height || preset.height,
    borderRadius:
      variant === 'circle'
        ? '50%'
        : variant === 'text' || variant === 'title'
          ? '8px'
          : '12px',
  }

  const skeletons = Array.from({ length: count })

  return (
    <div className={`skeleton-container ${className}`.trim()}>
      {skeletons.map((_, index) => (
        <SkeletonItem
          key={index}
          style={styles}
          reducedMotion={prefersReducedMotion}
        />
      ))}
    </div>
  )
}

interface SkeletonItemProps {
  style: React.CSSProperties
  reducedMotion: boolean
}

function SkeletonItem({ style, reducedMotion }: SkeletonItemProps) {
  if (reducedMotion) {
    return <div className="skeleton skeleton--static" style={style} />
  }

  return (
    <motion.div
      className="skeleton"
      style={style}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: duration.base / 1000 * 5, // ~1.1s shimmer
        ease: 'linear',
        repeat: Infinity,
      }}
    />
  )
}

/**
 * SkeletonGroup
 *
 * Convenience component for loading multiple skeleton items.
 * Useful for list placeholders.
 *
 * Usage:
 * <SkeletonGroup itemCount={5} itemHeight="64px" spacing="12px" />
 */

export interface SkeletonGroupProps {
  itemCount: number
  itemHeight?: string
  itemWidth?: string
  spacing?: string
  variant?: 'text' | 'title' | 'circle' | 'rect' | 'button'
}

export function SkeletonGroup({
  itemCount,
  itemHeight = '64px',
  itemWidth = '100%',
  spacing = '12px',
  variant = 'rect',
}: SkeletonGroupProps) {
  const prefersReducedMotion = useReducedMotion()

  const items = Array.from({ length: itemCount })

  if (prefersReducedMotion) {
    return (
      <div
        style={{
          display: 'grid',
          gap: spacing,
        }}
      >
        {items.map((_, index) => (
          <div
            key={index}
            className="skeleton skeleton--static"
            style={{
              width: itemWidth,
              height: itemHeight,
              borderRadius: '12px',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      style={{
        display: 'grid',
        gap: spacing,
      }}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 50 / 1000,
          },
        },
      }}
    >
      {items.map((_, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="skeleton"
            style={{
              width: itemWidth,
              height: itemHeight,
              borderRadius: '12px',
            }}
            animate={{
              backgroundPosition: ['200% 0', '-200% 0'],
            }}
            transition={{
              duration: 1.1,
              ease: 'linear',
              repeat: Infinity,
            }}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

/**
 * Shimmer effect background
 *
 * Used standalone for custom skeleton layouts.
 * Apply with CSS class: `background-shimmer`
 */
export const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .background-shimmer {
    background: linear-gradient(
      90deg,
      var(--color-secondary-surface, #F3F3F3) 25%,
      var(--color-surface-elevated, #FFFFFF) 50%,
      var(--color-secondary-surface, #F3F3F3) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
  }
`
