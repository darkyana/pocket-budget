import { describe, expect, it } from 'vitest'
import { statusOfRatio } from '../core/derive'
import { barColor, leftStatus, statusColor } from './statusColor'

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

describe('barColor', () => {
  it('renders normal state with the neutral bar token, keeps alert states semantic', () => {
    expect(barColor('ok')).toBe('var(--bar-accent)')
    expect(barColor('warn')).toBe('var(--warn)')
    expect(barColor('over')).toBe('var(--over)')
  })
})

describe('leftStatus', () => {
  it('flags over, warn under 20% left, otherwise ok', () => {
    expect(leftStatus(-1, 100)).toBe('over')
    expect(leftStatus(19, 100)).toBe('warn')
    expect(leftStatus(20, 100)).toBe('ok')
  })
})
