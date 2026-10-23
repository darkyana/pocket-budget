import type { DayStatus } from '../core/derive'

/** 状态→语义色单点映射：与 core/derive.ts 的 statusOfRatio 同源（'over'→--over / 'warn'→--warn / 'ok'→--ok） */
export const statusColor = (s: DayStatus) => (s === 'over' ? 'var(--over)' : s === 'warn' ? 'var(--warn)' : 'var(--ok)')
