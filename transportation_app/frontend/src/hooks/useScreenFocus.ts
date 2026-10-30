/**
 * useScreenFocus
 *
 * Pause background animations when screen loses focus (app backgrounded).
 * Resume when screen returns. Critical for battery life on mobile.
 *
 * Usage:
 * const isFocused = useScreenFocus()
 * const animatePaused = !isFocused
 */

import { useEffect, useState } from 'react'

export function useScreenFocus(): boolean {
  const [isFocused, setIsFocused] = useState(
    typeof document !== 'undefined' && !document.hidden,
  )

  useEffect(() => {
    const handleFocus = () => {
      setIsFocused(true)
    }

    const handleBlur = () => {
      setIsFocused(false)
    }

    const handleVisibilityChange = () => {
      setIsFocused(!document.hidden)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isFocused
}
