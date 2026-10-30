/**
 * AnimatedButton
 *
 * Primary button with press feedback, loading spinner, and success checkmark.
 * Uses transform scale for visual feedback (no width/height changes).
 *
 * Rules:
 * - Respects prefers-reduced-motion
 * - Minimum 52px height for touch targets
 * - Press scale: 0.97
 * - Never blocks user interaction
 *
 * Usage:
 * <AnimatedButton onClick={handleClick}>Book Now</AnimatedButton>
 * <AnimatedButton variant="secondary">Cancel</AnimatedButton>
 * <AnimatedButton isLoading>Processing...</AnimatedButton>
 * <AnimatedButton isSuccess>Confirmed!</AnimatedButton>
 */

import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { duration, interaction, easing } from '../../motion'
import { colors, radius } from '../../theme'
import type { ReactNode } from 'react'
import './AnimatedButton.css'

export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'tertiary'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  isSuccess?: boolean
  fullWidth?: boolean
}

export function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isSuccess = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: AnimatedButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const isInteractive = !disabled && !isLoading && !isSuccess

  const baseClass = `
    animated-button
    animated-button--${variant}
    animated-button--${size}
    ${fullWidth ? 'animated-button--full-width' : ''}
    ${className}
  `.trim()

  return (
    <motion.button
      className={baseClass}
      disabled={disabled || isLoading || isSuccess}
      whileTap={isInteractive && !prefersReducedMotion ? { scale: interaction.press.scale } : undefined}
      transition={{ duration: duration.fast / 1000 }}
      {...props}
    >
      {isSuccess ? (
        <motion.span
          className="button-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.fast / 1000 }}
        >
          <SuccessCheckmark />
        </motion.span>
      ) : isLoading ? (
        <motion.span
          className="button-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.fast / 1000 }}
        >
          <LoadingSpinner />
        </motion.span>
      ) : (
        <span className="button-content">{children}</span>
      )}
    </motion.button>
  )
}

/**
 * Animated loading spinner
 */
function LoadingSpinner() {
  return (
    <motion.svg
      className="loading-spinner"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ rotate: 360 }}
      transition={{
        duration: duration.base / 1000,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.2"
      />
      <motion.path
        d="M 10 2 A 8 8 0 0 1 17.07 17.07"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </motion.svg>
  )
}

/**
 * Success checkmark animation
 */
function SuccessCheckmark() {
  return (
    <motion.svg
      className="success-checkmark"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        ...{ damping: 18, stiffness: 180, mass: 1 },
      }}
    >
      <motion.path
        d="M 3 10 L 8 15 L 17 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          duration: duration.base / 1000,
          ease: easing.out,
        }}
      />
    </motion.svg>
  )
}
