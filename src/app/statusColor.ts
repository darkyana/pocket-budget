import type { DayStatus } from '../core/derive'

export const statusColor = (s: DayStatus) => (s === 'over' ? 'var(--over)' : s === 'warn' ? 'var(--warn)' : 'var(--ok)')

export const barColor = (s: DayStatus) => (s === 'ok' ? 'var(--bar-accent)' : statusColor(s))

export const pct = (n: number) => `${Math.max(0, Math.min(100, n * 100))}%`

export const remainBar = (left: number, limit: number) => ({
  width: limit > 0 ? pct(left / limit) : '0%',
  background: barColor(leftStatus(left, limit)),
})

export const leftStatus = (left: number, limit: number): DayStatus =>
  left < 0 ? 'over' : left < limit * 0.2 ? 'warn' : 'ok'
