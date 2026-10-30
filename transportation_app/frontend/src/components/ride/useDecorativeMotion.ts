import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export function useDecorativeMotion(paused: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = Boolean(useReducedMotion())
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )
  const [offscreen, setOffscreen] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.05 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    reducedMotion,
    shouldPause: paused || hidden || reducedMotion || offscreen,
  }
}
