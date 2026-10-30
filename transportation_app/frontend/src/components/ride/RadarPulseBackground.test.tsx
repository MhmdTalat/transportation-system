import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { RadarPulseBackground } from './RadarPulseBackground'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
})

describe('RadarPulseBackground', () => {
  it('renders three rings, three dots, and a pickup pin', () => {
    const { container, getByTestId } = render(<RadarPulseBackground />)
    expect(container.querySelectorAll('.radar-ring')).toHaveLength(3)
    expect(container.querySelectorAll('.radar-dot')).toHaveLength(3)
    expect(container.querySelector('.radar-pin')).toBeTruthy()
    expect(getByTestId('radar-pulse-background')).toBeTruthy()
    expect(getByTestId('radar-pulse-background').style.pointerEvents).toBe('none')
  })

  it('matches a snapshot when paused', () => {
    const { container } = render(<RadarPulseBackground paused />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
