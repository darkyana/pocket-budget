import { describe, expect, it } from 'vitest'
import { statusOfRatio } from '../core/derive'
import { barColor, leftStatus, pct, remainBar, statusColor } from './statusColor'

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

describe('pct', () => {
  it('converts a ratio to a clamped percentage string', () => {
    expect(pct(0)).toBe('0%')
    expect(pct(0.42)).toBe('42%')
    expect(pct(1)).toBe('100%')
  })

  it('clamps below zero and above one', () => {
    expect(pct(-0.3)).toBe('0%')
    expect(pct(1.7)).toBe('100%')
  })
})

describe('remainBar', () => {
  it('builds a remaining-fraction bar style with semantic colors', () => {
    expect(remainBar(50, 100)).toEqual({ width: '50%', background: 'var(--bar-accent)' })
    expect(remainBar(15, 100)).toEqual({ width: '15%', background: 'var(--warn)' })
    expect(remainBar(-10, 100)).toEqual({ width: '0%', background: 'var(--over)' })
  })

  it('renders a zero-width over bar when the limit is not positive', () => {
    expect(remainBar(-30, 0)).toEqual({ width: '0%', background: 'var(--over)' })
  })
})

describe('leftStatus', () => {
  it('flags over, warn under 20% left, otherwise ok', () => {
    expect(leftStatus(-1, 100)).toBe('over')
    expect(leftStatus(19, 100)).toBe('warn')
    expect(leftStatus(20, 100)).toBe('ok')
  })
})
