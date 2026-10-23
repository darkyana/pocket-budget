import { describe, expect, it } from 'vitest'
import { statusOfRatio } from '../core/derive'
import { statusColor } from './statusColor'

describe('statusColor', () => {
  it('maps each day status to its semantic color token', () => {
    expect(statusColor('over')).toBe('var(--over)')
    expect(statusColor('warn')).toBe('var(--warn)')
    expect(statusColor('ok')).toBe('var(--ok)')
  })

  it('stays in sync with statusOfRatio thresholds', () => {
    expect(statusColor(statusOfRatio(1.2))).toBe('var(--over)')
    expect(statusColor(statusOfRatio(0.9))).toBe('var(--warn)')
    expect(statusColor(statusOfRatio(0.5))).toBe('var(--ok)')
  })
})
