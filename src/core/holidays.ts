import { holidayCalendars } from './holiday-data'
import { dayKeyOf } from './time'

export function isRestDay(d: Date): boolean {
  const k = dayKeyOf(d)
  const calendar = holidayCalendars[d.getFullYear()]
  if (calendar?.workingDays.includes(k)) return false
  if (calendar?.restRanges.some(([a, b]) => a <= k && k <= b)) return true
  const wd = d.getDay()
  return wd === 0 || wd === 6
}
