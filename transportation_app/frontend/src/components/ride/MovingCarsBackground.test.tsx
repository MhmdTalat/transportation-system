import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { MovingCarsBackground } from './MovingCarsBackground'

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

describe('MovingCarsBackground', () => {
  it('renders three cars and a route without blocking pointer events', () => {
    const { container, getByTestId } = render(<MovingCarsBackground speed={1.2} intensity={0.8} />)
    expect(container.querySelectorAll('.moving-car')).toHaveLength(3)
    expect(container.querySelector('.moving-cars-route')).toBeTruthy()
    expect(getByTestId('moving-cars-background')).toBeTruthy()
    expect(getByTestId('moving-cars-background').style.pointerEvents).toBe('none')
  })

  it('matches a snapshot when paused', () => {
    const { container } = render(<MovingCarsBackground paused />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
