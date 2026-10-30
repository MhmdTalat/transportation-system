/**
 * FadeInView
 *
 * Simple fade + slide animation for entering elements.
 * Used for screen transitions and individual items.
 *
 * Animation spec:
 * - Fade + 12px slide
 * - Duration: 220ms
 * - Easing: out (cubic-bezier)
 * - Respects prefers-reduced-motion
 *
 * Usage:
 * <FadeInView delay={0}>Content</FadeInView>
 * <FadeInView delayMs={100}>More Content</FadeInView>
 */

import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { duration, easing, animations } from '../../motion'
import type { ReactNode } from 'react'

export interface FadeInViewProps {
  children: ReactNode
  delay?: number
  delayMs?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  className?: string
}

export function FadeInView({
  children,
  delay = 0,
  delayMs = 0,
  duration: customDuration,
  direction = 'up',
  className = '',
}: FadeInViewProps) {
  const prefersReducedMotion = useReducedMotion()
  const delayValue = delayMs || delay * (motion as any)

  // Calculate slide offset based on direction
  const slideValues = {
    up: { y: 12 },
    down: { y: -12 },
    left: { x: 12 },
    right: { x: -12 },
  }

  const slideOffset = slideValues[direction]

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...slideOffset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: (customDuration ?? duration.base) / 1000,
        ease: easing.out,
        delay: delayValue / 1000,
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerContainer + FadeInView
 *
 * Automatically staggered fade-in for list items.
 * Each child gets sequential stagger delay.
 *
 * Usage:
 * <StaggerList>
 *   {items.map((item) => (
 *     <ListItem key={item.id}>{item.name}</ListItem>
 *   ))}
 * </StaggerList>
 */

export interface StaggerListProps {
  children: ReactNode
  staggerDuration?: number
  containerClassName?: string
  itemClassName?: string
}

export function StaggerList({
  children,
  staggerDuration = 40,
  containerClassName = '',
  itemClassName = '',
}: StaggerListProps) {
  const prefersReducedMotion = useReducedMotion()

  // Convert children to array
  const childArray = Array.isArray(children)
    ? children
    : typeof children === 'object' && 'props' in (children as object)
      ? [children]
      : Array.isArray((children as ReactNode[]))
        ? children as ReactNode[]
        : [children]

  if (prefersReducedMotion) {
    return <div className={containerClassName}>{children}</div>
  }

  return (
    <motion.div
      className={containerClassName}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDuration / 1000,
          },
        },
      }}
    >
      {childArray.map((child, index) => (
        <motion.div
          key={index}
          className={itemClassName}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{
            duration: duration.base / 1000,
            ease: easing.out,
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
