import type { DayStatus } from '../core/derive'

export const statusColor = (s: DayStatus) => (s === 'over' ? 'var(--over)' : s === 'warn' ? 'var(--warn)' : 'var(--ok)')

export const barColor = (s: DayStatus) => (s === 'ok' ? 'var(--bar-accent)' : statusColor(s))

export const leftStatus = (left: number, limit: number): DayStatus =>
  left < 0 ? 'over' : left < limit * 0.2 ? 'warn' : 'ok'
