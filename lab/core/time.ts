
export function startOfDay(d: Date | number): Date {
  const t = new Date(d)
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

export function isSameDay(a: Date | number, b: Date | number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export function startOfWeek(d: Date | number): Date {
  const t = startOfDay(d)
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7))
  return t
}

export function isSameWeek(a: Date | number, b: Date | number): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

export function monthKeyOf(d: Date | number): string {
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export function yearKeyOf(d: Date | number): string {
  return String(new Date(d).getFullYear())
}

export function dayKeyOf(d: Date | number): string {
  const t = new Date(d)
  return `${monthKeyOf(t)}-${String(t.getDate()).padStart(2, '0')}`
}

export function timestampOf(dateStr: string, now = new Date()): number {
  if (!dateStr) return now.getTime()
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return now.getTime()
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).getTime()
}

export function validateRecordDate(date: string, now = new Date()): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dayKeyOf(timestampOf(date, now)) !== date) {
    throw new Error('请选择有效日期')
  }
  if (date > dayKeyOf(now)) throw new Error('日期不能晚于今天')
}

export function dayOfMonth(d: Date | number): number {
  return new Date(d).getDate()
}

export function daysInMonth(d: Date | number): number {
  const t = new Date(d)
  return new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
}

export function projectMonthEnd(monthSpent: number, now: Date): number {
  return (monthSpent * daysInMonth(now)) / dayOfMonth(now)
}
