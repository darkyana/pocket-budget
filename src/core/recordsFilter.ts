import type { MoneyRecord } from './types'
import { dayKeyOf } from './time'

export function filterRecords(records: MoneyRecord[], dates: { from: string; to: string } = { from: '', to: '' }): MoneyRecord[] {
  if (!dates.from && !dates.to) return records
  if (!dates.from || !dates.to || dates.from > dates.to) throw new Error('请选择完整且有效的日期范围')
  return records.filter((record) => {
    const day = dayKeyOf(record.ts)
    return day >= dates.from && day <= dates.to
  })
}
