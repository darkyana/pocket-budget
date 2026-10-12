/**
 * 时间工具：所有「今天 / 本周 / 本月」的边界都从这里出，不许散落到别处。
 * 本文件是纯函数、零依赖、可测试——周月翻转的正确性靠它保证。
 */

export function startOfDay(d: Date | number): Date {
  const t = new Date(d)
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

export function isSameDay(a: Date | number, b: Date | number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** 周一为一周之始（原型裁定） */
export function startOfWeek(d: Date | number): Date {
  const t = startOfDay(d)
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7))
  return t
}

export function isSameWeek(a: Date | number, b: Date | number): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

/** 月键 'YYYY-MM'：义务状态按它归属月份 */
export function monthKeyOf(d: Date | number): string {
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

/** 年键 'YYYY'：年付义务的归属周期 */
export function yearKeyOf(d: Date | number): string {
  return String(new Date(d).getFullYear())
}

/** 日键 'YYYY-MM-DD'（本地时区）：流水按天分组用 */
export function dayKeyOf(d: Date | number): string {
  const t = new Date(d)
  return `${monthKeyOf(t)}-${String(t.getDate()).padStart(2, '0')}`
}

export function dayOfMonth(d: Date | number): number {
  return new Date(d).getDate()
}

export function daysInMonth(d: Date | number): number {
  const t = new Date(d)
  return new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
}

/** 按本月已过天数的比例，外推月底总额（净支出为负数时推算同样为负） */
export function projectMonthEnd(monthSpent: number, now: Date): number {
  return (monthSpent * daysInMonth(now)) / dayOfMonth(now)
}
