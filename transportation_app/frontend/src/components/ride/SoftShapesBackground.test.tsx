import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { SoftShapesBackground } from './SoftShapesBackground'

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

describe('SoftShapesBackground', () => {
  it('renders four flat shapes and clamps opacity to the 10-20% range', () => {
    const { container, getByTestId } = render(<SoftShapesBackground intensity={1} speed={0.5} />)
    expect(container.querySelectorAll('.soft-shape')).toHaveLength(4)
    expect(getByTestId('soft-shapes-background').getAttribute('style')).toContain('--soft-shape-opacity: 0.2')
    expect(getByTestId('soft-shapes-background').style.pointerEvents).toBe('none')
  })

  it('matches a snapshot when paused', () => {
    const { container } = render(<SoftShapesBackground paused />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
