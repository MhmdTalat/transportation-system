/**
 * BackgroundEffect Tests
 *
 * Verify all effects render correctly, respect preferences, and perform well.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BackgroundEffect } from './BackgroundEffect'

describe('BackgroundEffect', () => {
  beforeEach(() => {
    // Mock prefers-reduced-motion
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ========== RENDERING TESTS ==========

  it('renders radarSweep effect', async () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    await waitFor(() => {
      const effect = container.querySelector('[data-testid="effect-radarSweep"]')
      expect(effect).toBeInTheDocument()
    })
  })

  it('renders skyline effect', async () => {
    const { container } = render(
      <BackgroundEffect type="skyline" />,
    )

    await waitFor(() => {
      const effect = container.querySelector('[data-testid="effect-skyline"]')
      expect(effect).toBeInTheDocument()
    })
  })

  it('applies is-paused class when paused=true', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" paused={true} />,
    )

    const effect = container.querySelector('.background-effect.is-paused')
    expect(effect).toBeInTheDocument()
  })

  it('applies is-static class when reducedMotion is true', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    await waitFor(() => {
      const effect = container.querySelector('.background-effect.is-static')
      expect(effect).toBeInTheDocument()
    })
  })

  // ========== PROP TESTS ==========

  it('accepts custom color prop', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" color="#FF0000" />,
    )

    const effect = container.querySelector('[data-testid="effect-radarSweep"]')
    expect(effect).toBeInTheDocument()
  })

  it('accepts intensity prop (0-1)', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" intensity={0.5} />,
    )

    const effect = container.querySelector('[data-testid="effect-radarSweep"]')
    expect(effect).toBeInTheDocument()
  })

  it('accepts speed prop (0.5-2)', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" speed={1.5} />,
    )

    const effect = container.querySelector('[data-testid="effect-radarSweep"]')
    expect(effect).toBeInTheDocument()
  })

  // ========== ACCESSIBILITY TESTS ==========

  it('sets aria-hidden="true" for decorative effect', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    const effect = container.querySelector('[aria-hidden="true"]')
    expect(effect).toBeInTheDocument()
  })

  it('applies pointer-events: none so effect does not block clicks', () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    const effect = container.querySelector('.background-effect')
    expect(effect).toHaveStyle('pointer-events: none')
  })

  // ========== SNAPSHOT TESTS ==========

  it('matches snapshot for radarSweep', async () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    await waitFor(() => {
      expect(container.querySelector('[data-testid="effect-radarSweep"]')).toBeInTheDocument()
    })

    expect(container).toMatchSnapshot()
  })

  it('matches snapshot for skyline', async () => {
    const { container } = render(
      <BackgroundEffect type="skyline" />,
    )

    await waitFor(() => {
      expect(container.querySelector('[data-testid="effect-skyline"]')).toBeInTheDocument()
    })

    expect(container).toMatchSnapshot()
  })

  // ========== PERFORMANCE TESTS ==========

  it('does not render multiple effect nodes for a single effect type', async () => {
    const { container } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    await waitFor(() => {
      const effectContainers = container.querySelectorAll('[data-testid^="effect-"]')
      expect(effectContainers).toHaveLength(1)
    })
  })

  // ========== CLEANUP TESTS ==========

  it('cleans up event listeners on unmount', () => {
    const { unmount } = render(
      <BackgroundEffect type="radarSweep" />,
    )

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalled()
  })
})
