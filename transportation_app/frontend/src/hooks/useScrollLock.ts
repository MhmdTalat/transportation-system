import { useEffect } from 'react'

let scrollLockCount = 0
let previousBodyStyles: {
  overflow: string
  paddingRight: string
  position: string
  top: string
  width: string
} | null = null
let scrollY = 0

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    if (scrollLockCount === 0) {
      const body = document.body
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      scrollY = window.scrollY
      previousBodyStyles = {
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
      }

      body.style.overflow = 'hidden'
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.width = '100%'
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight || '0') + scrollbarWidth}px`
      }
    }

    scrollLockCount += 1

    return () => {
      scrollLockCount -= 1
      if (scrollLockCount > 0 || !previousBodyStyles) return

      const body = document.body
      body.style.overflow = previousBodyStyles.overflow
      body.style.paddingRight = previousBodyStyles.paddingRight
      body.style.position = previousBodyStyles.position
      body.style.top = previousBodyStyles.top
      body.style.width = previousBodyStyles.width
      previousBodyStyles = null
      window.scrollTo(0, scrollY)
    }
  }, [active])
}
